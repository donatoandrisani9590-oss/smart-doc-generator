# Sprint 2: Backend-Hygiene & Datenqualität — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 45 timezone bugs, 6 missing cascade deletes, 4 bare except blocks, 1 N+1 query, and 1 missing index.

**Architecture:** Mechanical find-and-replace for timezone migration, Alembic migration for cascade + index, targeted code fixes for exceptions and N+1. Each fix is independently committable.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, Python 3.11

---

## Task 1: Timezone Migration — Services Layer (5 files, 7 instances)

Replace `datetime.utcnow()` with `datetime.now(timezone.utc)` in all service files.

**Files:**
- Modify: `backend/app/services/consistency_service.py` (lines 247, 338)
- Modify: `backend/app/services/document_analyzer.py` (line 262)
- Modify: `backend/app/services/legal_auditor_service.py` (line 112)
- Modify: `backend/app/services/compliance_service.py` (line 415)

**Step 1: Fix each file**

For each file, ensure `from datetime import datetime, timezone` is imported, then replace all `datetime.utcnow()` with `datetime.now(timezone.utc)`.

Pattern per file:
```python
# OLD
checked_at=datetime.utcnow().isoformat()
# NEW
checked_at=datetime.now(timezone.utc).isoformat()
```

**Step 2: Verify backend builds**

Run: `cd backend && python -c "from app.services.consistency_service import ConsistencyService; print('OK')"`

**Step 3: Commit**

```bash
git add backend/app/services/consistency_service.py backend/app/services/document_analyzer.py backend/app/services/legal_auditor_service.py backend/app/services/compliance_service.py
git commit -m "fix(timezone): migrate services to datetime.now(timezone.utc)

Replace 7 instances of deprecated datetime.utcnow() with
timezone-aware datetime.now(timezone.utc) in 4 service files.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Timezone Migration — Tasks Layer (2 files, 4 instances)

**Files:**
- Modify: `backend/app/tasks/retention.py` (lines 26, 79, 160)
- Modify: `backend/app/tasks/pdf_tasks.py` (line 49)

**Step 1: Fix retention.py**

```python
# Line 26: now = datetime.utcnow() → now = datetime.now(timezone.utc)
# Line 79: cutoff_date = datetime.utcnow() - timedelta(...) → datetime.now(timezone.utc) - timedelta(...)
# Line 160: "timestamp": datetime.utcnow().isoformat() → datetime.now(timezone.utc).isoformat()
```

Ensure import: `from datetime import datetime, timezone, timedelta`

**Step 2: Fix pdf_tasks.py**

```python
# Line 49: "updated_at": datetime.utcnow().isoformat() → datetime.now(timezone.utc).isoformat()
```

**Step 3: Commit**

```bash
git add backend/app/tasks/retention.py backend/app/tasks/pdf_tasks.py
git commit -m "fix(timezone): migrate tasks to datetime.now(timezone.utc)

Replace 4 instances in retention.py and pdf_tasks.py.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Timezone Migration — Documents Endpoints (4 files, 9 instances)

**Files:**
- Modify: `backend/app/api/v1/endpoints/documents/repository.py` (lines 256, 499, 865, 1162)
- Modify: `backend/app/api/v1/endpoints/documents/drafts.py` (lines 179, 513)
- Modify: `backend/app/api/v1/endpoints/documents/locks.py` (line 83)
- Modify: `backend/app/api/v1/endpoints/documents/approvals.py` (lines 718, 808, 896, 983)

**Step 1: Fix all 4 files**

Same pattern: `datetime.utcnow()` → `datetime.now(timezone.utc)`, ensure `timezone` imported.

**Step 2: Verify builds**

Run: `cd backend && python -c "from app.api.v1.endpoints.documents.repository import router; print('OK')"`

**Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/documents/repository.py backend/app/api/v1/endpoints/documents/drafts.py backend/app/api/v1/endpoints/documents/locks.py backend/app/api/v1/endpoints/documents/approvals.py
git commit -m "fix(timezone): migrate document endpoints to timezone-aware datetimes

Replace 9 instances across repository, drafts, locks, approvals.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Timezone Migration — User & Admin Endpoints (7 files, 16 instances)

**Files:**
- Modify: `backend/app/api/v1/endpoints/user/comments.py` (lines 632, 706, 765)
- Modify: `backend/app/api/v1/endpoints/user/notifications.py` (lines 412, 475, 500, 524)
- Modify: `backend/app/api/v1/endpoints/user/deadlines.py` (lines 78, 114, 165)
- Modify: `backend/app/api/v1/endpoints/admin/llm_usage.py` (lines 121, 317)
- Modify: `backend/app/api/v1/endpoints/admin/legal_audit.py` (line 389)
- Modify: `backend/app/api/v1/endpoints/admin/audit.py` (lines 285, 478, 655, 704)
- Modify: `backend/app/api/v1/endpoints/core/clauses.py` (line 185)
- Modify: `backend/app/api/v1/endpoints/core/custom_clauses.py` (line 230)

**Step 1: Fix all files**

Same pattern across all files.

**Step 2: Commit**

```bash
git add backend/app/api/v1/endpoints/user/ backend/app/api/v1/endpoints/admin/llm_usage.py backend/app/api/v1/endpoints/admin/legal_audit.py backend/app/api/v1/endpoints/admin/audit.py backend/app/api/v1/endpoints/core/clauses.py backend/app/api/v1/endpoints/core/custom_clauses.py
git commit -m "fix(timezone): migrate user/admin/core endpoints to timezone-aware datetimes

Replace 16 instances across comments, notifications, deadlines,
llm_usage, legal_audit, audit, clauses, custom_clauses.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Timezone Migration — Integration & Smart Endpoints (4 files, 6 instances)

**Files:**
- Modify: `backend/app/api/v1/endpoints/auth/guest.py` (line 30)
- Modify: `backend/app/api/v1/endpoints/integration/copilot_studio.py` (line 217)
- Modify: `backend/app/api/v1/endpoints/integration/webhooks.py` (lines 159, 433, 532)
- Modify: `backend/app/api/v1/endpoints/smart/bulk_smart.py` (line 760)

**Step 1: Fix all files**

Same pattern.

**Step 2: Verify no remaining utcnow calls**

Run: `cd backend && grep -rn "utcnow" app/ --include="*.py" | grep -v "__pycache__" | grep -v ".pyc"`
Expected: 0 results

**Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/auth/guest.py backend/app/api/v1/endpoints/integration/ backend/app/api/v1/endpoints/smart/bulk_smart.py
git commit -m "fix(timezone): complete migration — zero utcnow() remaining

Replace final 6 instances in auth, integration, smart endpoints.
Verified: grep finds 0 remaining datetime.utcnow() calls.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Cascade Deletes + Missing Index (Alembic Migration)

**Files:**
- Modify: `backend/app/models/documents.py` (6 ForeignKey definitions)
- Create: `backend/migrations/versions/019_add_cascade_deletes_and_index.py`

**Step 1: Update SQLAlchemy model ForeignKeys**

In `documents.py`, add `ondelete="CASCADE"` to 6 ForeignKeys:

```python
# Line 156 (DocumentTypeClause.document_type_id):
document_type_id = Column(Integer, ForeignKey("document_types.id", ondelete="CASCADE"), primary_key=True)

# Line 157 (DocumentTypeClause.clause_id):
clause_id = Column(Integer, ForeignKey("clauses.id", ondelete="CASCADE"), primary_key=True)

# Line 221 (ClauseVariant.group_id):
group_id = Column(Integer, ForeignKey("clause_variant_groups.id", ondelete="CASCADE"), nullable=False, index=True)

# Line 222 (ClauseVariant.clause_id):
clause_id = Column(Integer, ForeignKey("clauses.id", ondelete="CASCADE"), nullable=False, index=True)

# Line 303 (ClauseVersion.clause_id):
clause_id = Column(Integer, ForeignKey("clauses.id", ondelete="CASCADE"), nullable=False, index=True)

# Line 349 (ClauseNote.clause_id):
clause_id = Column(Integer, ForeignKey("clauses.id", ondelete="CASCADE"), nullable=False, index=True)
```

**Step 2: Create Alembic migration**

Create `backend/migrations/versions/019_add_cascade_deletes_and_index.py`:

```python
"""Add CASCADE deletes to clause ForeignKeys and index on document_type_clauses.clause_id

Revision ID: 019
"""
from alembic import op

revision = "019_cascade_index"
down_revision = "018_add_approval_groups"


def upgrade() -> None:
    # DocumentTypeClause.document_type_id → CASCADE
    op.drop_constraint("document_type_clauses_document_type_id_fkey", "document_type_clauses", type_="foreignkey")
    op.create_foreign_key("document_type_clauses_document_type_id_fkey", "document_type_clauses", "document_types", ["document_type_id"], ["id"], ondelete="CASCADE")

    # DocumentTypeClause.clause_id → CASCADE
    op.drop_constraint("document_type_clauses_clause_id_fkey", "document_type_clauses", type_="foreignkey")
    op.create_foreign_key("document_type_clauses_clause_id_fkey", "document_type_clauses", "clauses", ["clause_id"], ["id"], ondelete="CASCADE")

    # ClauseVariant.group_id → CASCADE
    op.drop_constraint("clause_variants_group_id_fkey", "clause_variants", type_="foreignkey")
    op.create_foreign_key("clause_variants_group_id_fkey", "clause_variants", "clause_variant_groups", ["group_id"], ["id"], ondelete="CASCADE")

    # ClauseVariant.clause_id → CASCADE
    op.drop_constraint("clause_variants_clause_id_fkey", "clause_variants", type_="foreignkey")
    op.create_foreign_key("clause_variants_clause_id_fkey", "clause_variants", "clauses", ["clause_id"], ["id"], ondelete="CASCADE")

    # ClauseVersion.clause_id → CASCADE
    op.drop_constraint("clause_versions_clause_id_fkey", "clause_versions", type_="foreignkey")
    op.create_foreign_key("clause_versions_clause_id_fkey", "clause_versions", "clauses", ["clause_id"], ["id"], ondelete="CASCADE")

    # ClauseNote.clause_id → CASCADE
    op.drop_constraint("clause_notes_clause_id_fkey", "clause_notes", type_="foreignkey")
    op.create_foreign_key("clause_notes_clause_id_fkey", "clause_notes", "clauses", ["clause_id"], ["id"], ondelete="CASCADE")

    # Add index for reverse lookups on DocumentTypeClause.clause_id
    op.create_index("ix_dtc_clause_id", "document_type_clauses", ["clause_id"])


def downgrade() -> None:
    op.drop_index("ix_dtc_clause_id", "document_type_clauses")
    # Revert CASCADE (drop and re-create without ondelete)
    for table, col, ref_table in [
        ("document_type_clauses", "document_type_id", "document_types"),
        ("document_type_clauses", "clause_id", "clauses"),
        ("clause_variants", "group_id", "clause_variant_groups"),
        ("clause_variants", "clause_id", "clauses"),
        ("clause_versions", "clause_id", "clauses"),
        ("clause_notes", "clause_id", "clauses"),
    ]:
        fk_name = f"{table}_{col}_fkey"
        op.drop_constraint(fk_name, table, type_="foreignkey")
        op.create_foreign_key(fk_name, table, ref_table, [col], ["id"])
```

**Step 3: Verify**

Run: `cd backend && python -c "from app.models.documents import DocumentTypeClause, ClauseVariant, ClauseVersion, ClauseNote; print('OK')"`

**Step 4: Commit**

```bash
git add backend/app/models/documents.py backend/migrations/versions/019_add_cascade_deletes_and_index.py
git commit -m "fix(db): add CASCADE deletes to 6 ForeignKeys + clause_id index

Prevents orphaned records when Clause/DocumentType/VariantGroup deleted.
Adds reverse-lookup index on document_type_clauses.clause_id.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Fix Bare `except:` Blocks (4 Critical)

**Files:**
- Modify: `backend/app/api/v1/endpoints/documents/repository.py:1302-1306`
- Modify: `backend/app/api/v1/endpoints/core/clause_versions.py:153-157`
- Modify: `backend/app/api/v1/endpoints/documents/generation.py:458-462`
- Modify: `backend/app/api/v1/endpoints/user/chat.py:504-509`

**Step 1: Fix repository.py:1305**

```python
# OLD (line 1302-1306):
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass

# NEW:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except (ValueError, TypeError):
                        pass
```

**Step 2: Fix clause_versions.py:156**

```python
# OLD (line 153-157):
    try:
        major, minor = clause.version.split('.')
        clause.version = f"{major}.{int(minor) + 1}"
    except:
        clause.version = f"{clause.version}.restored"

# NEW:
    try:
        major, minor = clause.version.split('.')
        clause.version = f"{major}.{int(minor) + 1}"
    except (ValueError, AttributeError):
        clause.version = f"{clause.version}.restored"
```

**Step 3: Fix generation.py:461**

```python
# OLD (line 458-462):
                try:
                    style = 'List Bullet' if element.name == 'ul' else 'List Number'
                    para = doc.add_paragraph(style=style)
                except:
                    para = doc.add_paragraph()

# NEW:
                try:
                    style = 'List Bullet' if element.name == 'ul' else 'List Number'
                    para = doc.add_paragraph(style=style)
                except (KeyError, ValueError):
                    para = doc.add_paragraph()
```

**Step 4: Fix chat.py:508**

```python
# OLD (line 504-509):
        try:
            parsed = json.loads(response.content)
            if "response" in parsed:
                natural_response = parsed["response"]
        except:
            pass

# NEW:
        try:
            parsed = json.loads(response.content)
            if "response" in parsed:
                natural_response = parsed["response"]
        except (json.JSONDecodeError, TypeError, KeyError):
            pass
```

**Step 5: Commit**

```bash
git add backend/app/api/v1/endpoints/documents/repository.py backend/app/api/v1/endpoints/core/clause_versions.py backend/app/api/v1/endpoints/documents/generation.py backend/app/api/v1/endpoints/user/chat.py
git commit -m "fix(exceptions): replace 4 bare except: with specific exception types

repository.py: ValueError, TypeError for cell value conversion
clause_versions.py: ValueError, AttributeError for version parsing
generation.py: KeyError, ValueError for Word style lookup
chat.py: JSONDecodeError, TypeError, KeyError for JSON parsing

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Add Logging to cache.py Exception Handlers

**Files:**
- Modify: `backend/app/services/cache.py` (5 except Exception blocks)

**Step 1: Add logger.warning() to each block**

```python
# Line 66 (get):
            except Exception as e:
                logger.warning("Redis GET failed for key=%s: %s", key, e)

# Line 86 (set):
            except Exception as e:
                logger.warning("Redis SET failed for key=%s: %s", key, e)

# Line 100 (delete):
            except Exception as e:
                logger.warning("Redis DELETE failed for key=%s: %s", key, e)

# Line 118 (delete_pattern):
            except Exception as e:
                logger.warning("Redis SCAN/DELETE failed for pattern=%s: %s", pattern, e)

# Line 138 (clear):
            except Exception as e:
                logger.warning("Redis FLUSHDB failed: %s", e)
```

**Step 2: Commit**

```bash
git add backend/app/services/cache.py
git commit -m "fix(cache): add warning logs to Redis exception handlers

5 except Exception blocks now log warnings instead of silently passing.
Helps diagnose Redis connectivity issues in production.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: N+1 Query Fix (clauses.py Impact Analysis)

**Files:**
- Modify: `backend/app/api/v1/endpoints/core/clauses.py:180-208`

**Step 1: Replace N+1 loop with single GROUP BY query**

Replace lines 177-208:

```python
    # Nutzungsstatistiken für die letzten 30 Tage (single aggregated query)
    from datetime import datetime, timezone, timedelta
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    usage_counts_map: dict[int, int] = {}
    try:
        usage_result = await db.execute(
            select(
                GeneratedDocument.document_type_id,
                func.count().label("usage_count"),
            )
            .where(GeneratedDocument.created_at >= thirty_days_ago)
            .group_by(GeneratedDocument.document_type_id)
        )
        usage_counts_map = {row.document_type_id: row.usage_count for row in usage_result}
    except Exception as e:
        logger.debug("Usage-Abfrage fehlgeschlagen: %s", e)

    affected_types = []
    total_usage = 0
    for dt in document_types:
        usage_count = usage_counts_map.get(dt.id, 0)
        affected_types.append(DocumentTypeUsage(
            id=dt.id,
            name=dt.name,
            category=dt.category,
            is_mandatory=dt.is_mandatory,
            usage_count_30_days=usage_count,
        ))
        total_usage += usage_count
```

**Step 2: Verify**

Run: `cd backend && python -c "from app.api.v1.endpoints.core.clauses import router; print('OK')"`

**Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/core/clauses.py
git commit -m "perf(clauses): fix N+1 in impact analysis with GROUP BY query

Single aggregated query replaces per-DocumentType loop.
N DB roundtrips → 1 roundtrip regardless of type count.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Final Verification

**Step 1: Run backend tests**

Run: `cd backend && python -m pytest tests/ -x -q`
Expected: Existing tests pass (20 pre-existing failures are known).

**Step 2: Verify zero utcnow remaining**

Run: `cd backend && grep -rn "utcnow" app/ --include="*.py" | grep -v "__pycache__"`
Expected: 0 results

**Step 3: Verify zero bare except remaining**

Run: `cd backend && grep -rn "except:" app/ --include="*.py" | grep -v "__pycache__" | grep -v "except Exception" | grep -v "# noqa"`
Expected: 0 results (bare `except:` only)
