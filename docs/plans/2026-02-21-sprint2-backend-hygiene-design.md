# Sprint 2: Backend-Hygiene & Datenqualität — Design

**Datum:** 2026-02-21
**Scope:** 5 kritische Backend-Fixes aus dem System-Audit
**Ziel:** Timezone-Konsistenz, referentielle Integrität, Error-Hygiene, Query-Performance

---

## Fix 1: Timezone-Migration (datetime.utcnow → datetime.now(timezone.utc))

### Problem
45 Stellen in 24 Dateien verwenden `datetime.utcnow()` (deprecated, gibt naive datetime ohne Timezone-Info). Wird mit `datetime.now(timezone.utc)` (aware) gemischt → Vergleiche zwischen naiv und aware schlagen fehl oder liefern falsche Ergebnisse.

### Lösung
Globales Find-and-Replace mit manuellem Review:
1. `from datetime import datetime` → `from datetime import datetime, timezone` (wo nötig)
2. `datetime.utcnow()` → `datetime.now(timezone.utc)` (alle 45 Stellen)
3. Review: Stellen die `.replace(tzinfo=timezone.utc)` nutzen können vereinfacht werden

### Betroffene Dateien (24)
- `services/consistency_service.py` (2x: 247, 338)
- `services/document_analyzer.py` (1x: 262)
- `services/legal_auditor_service.py` (1x: 112)
- `services/compliance_service.py` (1x: 415)
- `tasks/retention.py` (3x: 26, 79, 160)
- `tasks/pdf_tasks.py` (1x: 49)
- `api/v1/endpoints/documents/repository.py` (4x: 256, 499, 865, 1162)
- `api/v1/endpoints/documents/drafts.py` (2x: 179, 513)
- `api/v1/endpoints/documents/locks.py` (1x: 83)
- `api/v1/endpoints/documents/approvals.py` (4x: 718, 808, 896, 983)
- `api/v1/endpoints/user/comments.py` (3x: 632, 706, 765)
- `api/v1/endpoints/user/notifications.py` (4x: 412, 475, 500, 524)
- `api/v1/endpoints/user/deadlines.py` (3x: 78, 114, 165)
- `api/v1/endpoints/admin/llm_usage.py` (2x: 121, 317)
- `api/v1/endpoints/admin/legal_audit.py` (1x: 389)
- `api/v1/endpoints/admin/audit.py` (4x: 285, 478, 655, 704)
- `api/v1/endpoints/core/clauses.py` (1x: 185)
- `api/v1/endpoints/core/custom_clauses.py` (1x: 230)
- `api/v1/endpoints/auth/guest.py` (1x: 30)
- `api/v1/endpoints/integration/copilot_studio.py` (1x: 217)
- `api/v1/endpoints/integration/webhooks.py` (3x: 159, 433, 532)
- `api/v1/endpoints/smart/bulk_smart.py` (1x: 760)

### Risiko
Niedrig — rein mechanische Änderung, kein Verhaltensunterschied bei UTC.

---

## Fix 2: Cascade-Deletes auf ForeignKeys

### Problem
6 ForeignKeys in `documents.py` haben kein `ondelete`-Attribut. Wird ein Parent (Clause, DocumentType, ClauseVariantGroup) gelöscht, bleiben verwaiste Kinder-Records in der DB.

### Lösung
1. SQLAlchemy-Modell: `ForeignKey("clauses.id", ondelete="CASCADE")` auf 6 Stellen
2. Alembic-Migration: `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ... ON DELETE CASCADE`

### Betroffene Stellen (documents.py)
| Tabelle | Column | FK Target | Zeile |
|---------|--------|-----------|-------|
| `document_type_clauses` | `document_type_id` | `document_types.id` | 156 |
| `document_type_clauses` | `clause_id` | `clauses.id` | 157 |
| `clause_variants` | `group_id` | `clause_variant_groups.id` | 222 |
| `clause_variants` | `clause_id` | `clauses.id` | 223 |
| `clause_versions` | `clause_id` | `clauses.id` | 303 |
| `clause_notes` | `clause_id` | `clauses.id` | 349 |

### Risiko
Mittel — CASCADE bedeutet echtes Löschen. Sichergestellt durch:
- DocumentType.is_active=False (Soft-Delete, kein Hard-Delete in UI)
- Clause Soft-Delete Pattern bereits vorhanden
- Migration mit Datenbank-Backup als Voraussetzung

---

## Fix 3: Exception-Hygiene

### Problem
4 bare `except:` Blöcke (fangen SystemExit, KeyboardInterrupt) und ~30 `except Exception:` ohne Logging. Fehler werden verschluckt, Debugging unmöglich.

### Lösung

**Priorität A — bare `except:` → spezifisch (4 Stellen, KRITISCH):**
- `repository.py:1305` — Cell-Width-Berechnung: `except: pass` → `except (ValueError, TypeError): pass`
- `clause_versions.py:156` — Versions-Vergleich: `except:` → `except Exception as e: logger.warning(...)`
- `generation.py:461` — Paragraph-Styling: `except:` → `except (AttributeError, KeyError): ...`
- `chat.py:508` — Chat-Response: `except:` → `except Exception as e: logger.exception(...)`

**Priorität B — Top-10 dangerous `except Exception:` (mit Logging):**
- `cache.py` (5x) — Redis-Fallback: OK, aber `logger.debug()` → `logger.warning()` anheben
- `cloud_sync.py` (3x) — Silent failures bei Cloud-Sync
- `sentry.py` (2x) — Ironie: Error-Tracking swallowed errors

### Betroffene Dateien
14 Dateien total (4 kritisch, 10 high)

---

## Fix 4: N+1 Query Fix (clauses.py Impact Analysis)

### Problem
`clauses.py:180-207`: Für jeden DocumentType im Loop wird ein separater COUNT-Query ausgeführt.

```python
for dt in document_types:
    usage_query = select(func.count()).select_from(GeneratedDocument)
        .where(GeneratedDocument.document_type_id == dt.id)
    usage_result = await db.execute(usage_query)  # N separate Queries!
```

Bei 50 DocumentTypes = 50 DB-Roundtrips.

### Lösung
Single aggregated Query:

```python
usage_counts = await db.execute(
    select(
        GeneratedDocument.document_type_id,
        func.count().label("usage_count")
    )
    .where(GeneratedDocument.created_at >= thirty_days_ago)
    .group_by(GeneratedDocument.document_type_id)
)
counts_map = {row.document_type_id: row.usage_count for row in usage_counts}
```

### Betroffene Dateien
- `backend/app/api/v1/endpoints/core/clauses.py:180-207`

---

## Fix 5: Missing Index (DocumentTypeClause.clause_id)

### Problem
`DocumentTypeClause` hat Composite-PK `(document_type_id, clause_id)` — Lookups nach `document_type_id` sind schnell (PK-Prefix), aber Reverse-Lookups nach `clause_id` ("welche Dokumenttypen nutzen Clause X?") machen Full-Table-Scan.

### Lösung
Alembic-Migration:

```python
op.create_index("ix_dtc_clause_id", "document_type_clauses", ["clause_id"])
```

### Betroffene Dateien
- `backend/migrations/versions/007_add_cascade_deletes_and_indexes.py` (zusammen mit Fix 2)

---

## Nicht im Scope

- Soft-Delete-Validierung (neue Dokumente mit inaktivem DocumentType verhindern)
- Cache.py Redis-Fallback-Architektur (funktional korrekt, nur Logging-Level)
- LLM Service Streaming Error-Handling (Sprint 4)
