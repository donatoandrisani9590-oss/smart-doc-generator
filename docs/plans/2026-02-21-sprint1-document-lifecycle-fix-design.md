# Sprint 1: Dokumenten-Lifecycle reparieren — Design

**Datum:** 2026-02-21
**Scope:** 5 kritische Fixes aus dem System-Audit
**Ziel:** Kanban-Board funktionsfähig machen, Ghost-Drafts eliminieren, Stats korrigieren

---

## Fix 1: Kanban zeigt Drafts nativ

### Problem
`GET /repository/kanban` liefert nur `GeneratedDocument`-Records. `DocumentDraft`-Records werden ignoriert. Counter zeigen Drafts (via `useDrafts()`), aber Kanban-Spalten sind leer.

### Lösung (Backend-nativ)
Der `/kanban`-Endpoint injiziert Drafts als virtuelle Einträge in die "Entwurf"-Spalte:

1. Query `DocumentDraft` mit denselben Filtern (user_id, search, document_type_id)
2. Mappe Drafts auf `KanbanCardItem`-Schema mit:
   - `id`: Negative ID (`draft.id * -1`) zur Unterscheidung
   - `pipeline_stage`: `"entwurf"` (immer)
   - `title`: `draft.name or "Unbenannter Entwurf"`
   - `source`: `"draft"` (neues Feld)
3. Merge in die "entwurf"-Spalte, sortiert nach `updated_at DESC`
4. `count` der Entwurf-Spalte = GeneratedDocuments im Entwurf + Drafts

### Frontend-Änderung
- `KanbanCard`: Erkennt `source === "draft"` oder negative ID
- Click-Handler: Negative ID → `/generate?draft={abs(id)}`, positive → `/documents/{id}`
- Draft-Cards bekommen dezenten visuellen Unterschied (gestrichelte Border)

### Betroffene Dateien
- `backend/app/api/v1/endpoints/documents/repository.py` (Kanban-Endpoint)
- `frontend/src/hooks/api/useKanbanQueries.ts` (KanbanCardItem-Type erweitern)
- `frontend/src/components/documents/KanbanCard.tsx` (Draft-Erkennung)
- `frontend/src/components/documents/KanbanBoard.tsx` (Click-Handler)

---

## Fix 2: DELETE /drafts/{id}

### Problem
Kein Delete-Endpoint. Benutzer können Drafts nicht löschen.

### Lösung
Neuer `DELETE /drafts/{id}` Endpoint:
- Prüft `user_id == current_user.id` (Ownership)
- Hard-Delete (kein Soft-Delete nötig für Drafts)
- Returns 204 No Content

### Frontend
- `useDeleteDraft()` Hook in `useDraftQueries.ts`
- `onSuccess`: Invalidiert `["drafts"]`, `["kanban"]`, `["repository-stats"]`
- UI: Delete-Button in Repository-Liste und Kanban-Card (bei Drafts)

### Betroffene Dateien
- `backend/app/api/v1/endpoints/documents/drafts.py` (+DELETE Endpoint)
- `frontend/src/hooks/api/useDraftQueries.ts` (+useDeleteDraft Hook)
- `frontend/src/pages/Repository.tsx` (Delete-Action für Draft-Items)

---

## Fix 3: Ghost-Draft-Guard

### Problem
`POST /drafts` akzeptiert `form_data={}` → erzeugt leere "Unbenannter Entwurf"-Einträge.

### Lösung

**Backend-Validierung** in `DraftCreate.validate_form_data()`:
```python
# Mindestens 1 Feld mit nicht-leerem Wert
non_empty = [v for v in v.values() if isinstance(v, str) and v.strip()]
if not non_empty:
    raise ValueError("form_data muss mindestens ein ausgefülltes Feld enthalten")
```

**Frontend-Guard** im Auto-Save-Hook:
```typescript
const hasSubstantiveData = (data: Record<string, string>) =>
  Object.values(data).some(v => typeof v === "string" && v.trim().length > 0);

// Nur speichern wenn echte Daten vorhanden
if (!hasSubstantiveData(formData)) return;
```

### Betroffene Dateien
- `backend/app/api/v1/endpoints/documents/drafts.py` (Validator verschärfen)
- `frontend/src/hooks/useDocumentWizard.ts` (Auto-Save Guard)

---

## Fix 4: Garbage-Collection-Job

### Problem
Abgelaufene Drafts (>30 Tage) werden nie gelöscht. Kein Cleanup für leere Drafts.

### Lösung
Neuer Check `_cleanup_expired_drafts()` in `scheduler.py`:

1. Löscht Drafts mit `created_at < NOW() - 30 Tage`
2. Löscht Drafts mit leerem form_data UND `created_at < NOW() - 24h`
3. Loggt Anzahl gelöschter Records
4. Idempotent, läuft im bestehenden 15-Minuten-Intervall

### Betroffene Dateien
- `backend/app/services/scheduler.py` (+_cleanup_expired_drafts)

---

## Fix 5: Stats-Endpoint mit User-Filterung

### Problem
`GET /repository/stats` zählt global ohne User-Filter. Normaler Benutzer sieht Admin-Zahlen.

### Lösung
Dieselbe Ownership-Logik wie `/kanban` und `/repository`:
- Nicht-Admin: `WHERE created_by_id = current_user.id`
- Admin: Sieht alles
- Zusätzlich: `WHERE is_archived = False` (Default-Konsistenz)

Betrifft alle 5 Queries in `get_repository_stats()`: total, this_month, corrections, by_type, by_month.

### Betroffene Dateien
- `backend/app/api/v1/endpoints/documents/repository.py` (Stats-Endpoint)

---

## Nicht im Scope

- Dashboard Hero-Prompt-Bar (Sprint 3)
- Listen-Typografie Linear.app-Stil (Sprint 3)
- Radien-Vereinheitlichung (Sprint 3)
- Cascade-Delete Fixes (Sprint 2)
- Preview-Caching (Sprint 4)
