# Sprint 1: Document Lifecycle Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5 critical document lifecycle bugs: Kanban draft visibility, draft deletion UI, ghost-draft prevention, garbage collection, and stats user-scoping.

**Architecture:** Backend-first approach. Each fix is independently deployable. Kanban endpoint injects drafts as virtual cards with negative IDs. Stats endpoint adds user ownership filtering. Scheduler gains draft cleanup. Frontend hooks and components adapt to new backend behavior.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React 19 + TanStack Query + @dnd-kit (frontend), Tailwind CSS + shadcn/ui (styling)

---

## Task 1: Backend — Kanban Endpoint Injects Drafts

Add `source` field to `KanbanCardItem` schema and inject `DocumentDraft` records into the "entwurf" column of the Kanban response.

**Files:**
- Modify: `backend/app/api/v1/endpoints/documents/repository.py:88-99` (KanbanCardItem schema)
- Modify: `backend/app/api/v1/endpoints/documents/repository.py:621-742` (get_kanban_board endpoint)

**Step 1: Add `source` field to KanbanCardItem schema**

In `repository.py`, update the `KanbanCardItem` class (line 88):

```python
class KanbanCardItem(BaseModel):
    id: int
    title: Optional[str] = None
    document_type_name: Optional[str] = None
    employee_name: Optional[str] = None
    pipeline_stage: str
    created_at: Optional[str] = None
    next_due_date: Optional[str] = None
    has_open_actions: bool = False
    source: str = "document"  # "document" or "draft"

    class Config:
        from_attributes = True
```

**Step 2: Add DocumentDraft import**

At the top of `repository.py` (around line 27), add:

```python
from app.models.enterprise import DocumentAction, DocumentApproval, DocumentDraft
```

**Step 3: Inject drafts into Kanban endpoint**

Inside `get_kanban_board()`, after building the `stage_counts` and before building `stage_docs`, add draft injection logic. Insert this block after line 698 (`all_docs = all_docs_result.scalars().all()`):

```python
    # ── Draft injection into "entwurf" column ────────────────────────────
    draft_filters = [DocumentDraft.user_id == str(current_user.id)]
    if search:
        search_term = f"%{search}%"
        draft_filters.append(DocumentDraft.name.ilike(search_term))
    if document_type_id:
        draft_filters.append(DocumentDraft.document_type_id == document_type_id)
    if country_code:
        draft_filters.append(DocumentDraft.country_code == country_code)

    draft_result = await db.execute(
        select(DocumentDraft)
        .where(and_(*draft_filters))
        .order_by(desc(DocumentDraft.updated_at))
    )
    drafts = draft_result.scalars().all()

    # Load document type names for drafts
    draft_type_ids = list(set(d.document_type_id for d in drafts if d.document_type_id))
    for dt_id in draft_type_ids:
        if dt_id not in doc_types:
            dt = await db.get(DocumentType, dt_id)
            if dt:
                doc_types[dt_id] = dt.name
```

**Step 4: Merge draft cards into the "entwurf" column**

Replace the "Response bauen" block (lines 717-742) with:

```python
    # Response bauen
    columns = []
    total = 0
    for stage in PIPELINE_STAGE_ORDER:
        count = stage_counts.get(stage, 0)
        cards = [
            KanbanCardItem(
                id=doc.id,
                title=doc.title,
                document_type_name=doc_types.get(doc.document_type_id),
                employee_name=doc.employee_name,
                pipeline_stage=stage,
                created_at=doc.created_at.isoformat() if doc.created_at else None,
                next_due_date=doc.next_due_date.isoformat() if doc.next_due_date else None,
                has_open_actions=doc.has_open_actions or False,
                source="document",
            )
            for doc in stage_docs[stage]
        ]

        # Inject drafts into "entwurf" column
        if stage == "entwurf":
            draft_cards = [
                KanbanCardItem(
                    id=draft.id * -1,  # Negative ID to distinguish from documents
                    title=draft.name or "Unbenannter Entwurf",
                    document_type_name=doc_types.get(draft.document_type_id),
                    employee_name=None,
                    pipeline_stage="entwurf",
                    created_at=draft.updated_at.isoformat() if draft.updated_at else (draft.created_at.isoformat() if draft.created_at else None),
                    next_due_date=None,
                    has_open_actions=False,
                    source="draft",
                )
                for draft in drafts[:per_column]
            ]
            # Merge: drafts first, then documents, limited to per_column total
            cards = (draft_cards + cards)[:per_column]
            count += len(drafts)

        total += count
        columns.append(KanbanColumn(
            stage=stage,
            label=PIPELINE_STAGE_LABELS.get(stage, stage),
            count=count,
            documents=cards,
        ))

    return KanbanBoardResponse(columns=columns, total=total)
```

**Step 5: Verify backend builds**

Run: `cd backend && python -c "from app.api.v1.endpoints.documents.repository import router; print('OK')"`
Expected: `OK`

**Step 6: Commit**

```bash
git add backend/app/api/v1/endpoints/documents/repository.py
git commit -m "feat(kanban): inject drafts as virtual cards in entwurf column

Adds source field to KanbanCardItem (document|draft).
Drafts appear with negative IDs in the entwurf column,
merged with documents and sorted by updated_at.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Frontend — Kanban Displays Draft Cards

Update types, card styling, and click handler to support draft cards from the Kanban endpoint.

**Files:**
- Modify: `frontend/src/hooks/api/useKanbanQueries.ts:18-27` (KanbanCardItem type)
- Modify: `frontend/src/components/documents/KanbanCard.tsx:42-121` (draft styling)
- Modify: `frontend/src/components/documents/KanbanBoard.tsx:77-80` (click handler)

**Step 1: Add `source` field to frontend KanbanCardItem type**

In `useKanbanQueries.ts`, update the interface (line 18):

```typescript
export interface KanbanCardItem {
    id: number;
    title: string | null;
    document_type_name: string | null;
    employee_name: string | null;
    pipeline_stage: string;
    created_at: string | null;
    next_due_date: string | null;
    has_open_actions: boolean;
    source?: "document" | "draft";  // NEW
}
```

**Step 2: Add draft visual distinction to KanbanCard**

In `KanbanCard.tsx`, update the card container (line 60-73). Replace the outer `<div>` className:

```tsx
    const isDraft = card.source === "draft" || card.id < 0;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={() => onClick?.(card.id)}
            className={`
                border-l-4 rounded-lg bg-background p-3 cursor-grab active:cursor-grabbing
                shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elevated)]
                transition-shadow
                ${isDragging ? "opacity-50 ring-2 ring-primary/30" : ""}
                ${isDraft ? "border-dashed border-warm-300 bg-warm-50/50" : ""}
            `}
        >
```

Also add a "Entwurf" badge after the overdue indicator (after line 94):

```tsx
                {isDraft && (
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                        Entwurf
                    </span>
                )}
```

**Step 3: Route draft clicks to the editor**

In `KanbanBoard.tsx`, update the `onCardClick` prop handling. Replace the `KanbanBoardProps` interface and the pass-through (line 77-80):

```typescript
interface KanbanBoardProps {
    filters?: KanbanFilters;
    onCardClick?: (id: number) => void;
    onDraftClick?: (draftId: number) => void;  // NEW
}
```

Update the component signature:

```typescript
export function KanbanBoard({ filters = {}, onCardClick, onDraftClick }: KanbanBoardProps) {
```

Update the `KanbanColumn` rendering to pass a wrapped click handler. Replace the `onCardClick={onCardClick}` prop in the JSX (around line 287):

```tsx
    onCardClick={(id) => {
        if (id < 0) {
            // Negative ID = draft, convert back to positive
            onDraftClick?.(Math.abs(id));
        } else {
            onCardClick?.(id);
        }
    }}
```

**Step 4: Wire up draft routing in Repository.tsx**

In `Repository.tsx`, where `KanbanBoard` is rendered, add the `onDraftClick` handler using `useNavigate`:

```tsx
<KanbanBoard
    filters={kanbanFilters}
    onCardClick={(id) => navigate(`/documents/${id}`)}
    onDraftClick={(draftId) => navigate(`/generate?draft=${draftId}`)}
/>
```

**Step 5: Build check**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no TypeScript errors.

**Step 6: Commit**

```bash
git add frontend/src/hooks/api/useKanbanQueries.ts frontend/src/components/documents/KanbanCard.tsx frontend/src/components/documents/KanbanBoard.tsx frontend/src/pages/Repository.tsx
git commit -m "feat(kanban): display draft cards with dashed border and routing

Draft cards show dashed border + 'Entwurf' badge.
Clicking a draft navigates to /generate?draft={id}.
Negative IDs distinguish drafts from documents.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Frontend — useDeleteDraft Hook + UI

The backend DELETE endpoint already exists (`DELETE /drafts/{id}` at `drafts.py:278`). Add the frontend hook and delete button in Repository and Kanban.

**Files:**
- Modify: `frontend/src/hooks/api/useDraftQueries.ts` (add useDeleteDraft hook)
- Modify: `frontend/src/components/documents/KanbanCard.tsx` (add delete button for drafts)
- Modify: `frontend/src/pages/Repository.tsx` (add delete action for draft items in list view)

**Step 1: Add useDeleteDraft hook**

In `useDraftQueries.ts`, add after the `useSaveDraft` hook (after line 54):

```typescript
export const useDeleteDraft = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (draftId: number) => {
            const res = await fetch(`${API_BASE}/drafts/${draftId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Entwurf konnte nicht gelöscht werden");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["drafts"] });
            queryClient.invalidateQueries({ queryKey: ["kanban"] });
            queryClient.invalidateQueries({ queryKey: ["repository-stats"] });
        },
    });
};
```

**Step 2: Add delete button to KanbanCard for drafts**

In `KanbanCard.tsx`, import `Trash2` icon and add a delete button. Add to imports:

```typescript
import { Clock, AlertCircle, Trash2 } from "lucide-react";
```

Update the `KanbanCardProps` interface:

```typescript
interface KanbanCardProps {
    card: KanbanCardItem;
    onClick?: (id: number) => void;
    onDelete?: (id: number) => void;  // NEW
}
```

Add a delete button in the date row (after the due date span, inside the flex container at line 108), only for drafts:

```tsx
            {/* Row 3: Date + Due date + Delete */}
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                {card.created_at && (
                    <span>{formatDistanceToNow(card.created_at)}</span>
                )}
                {card.next_due_date && (
                    <span className={`flex items-center gap-0.5 ${overdue ? "text-red-600 dark:text-red-400 font-medium" : ""}`}>
                        <Clock className="w-3 h-3" />
                        {formatDueDate(card.next_due_date)}
                    </span>
                )}
                {isDraft && onDelete && (
                    <button
                        className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(Math.abs(card.id));
                        }}
                        title="Entwurf löschen"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
```

**Step 3: Wire delete through KanbanColumn and KanbanBoard**

In `KanbanBoard.tsx`, import `useDeleteDraft` and add a confirm + delete flow.

Add import:
```typescript
import { useDeleteDraft } from "@/hooks/api/useDraftQueries";
```

Inside the component, add the mutation:
```typescript
const deleteDraftMutation = useDeleteDraft();
```

Pass `onDelete` to the `KanbanColumn` → `KanbanCard` chain. This requires updating `KanbanColumn.tsx` to pass through an `onDeleteDraft` prop. Alternatively, handle it in the board-level `onCardClick` wrapper — simpler approach:

Add a `handleDeleteDraft` callback:

```typescript
const handleDeleteDraft = useCallback(
    async (draftId: number) => {
        if (!window.confirm("Entwurf endgültig löschen?")) return;
        try {
            await deleteDraftMutation.mutateAsync(draftId);
            toast.success("Gelöscht", "Entwurf wurde gelöscht");
        } catch {
            toast.error("Fehler", "Entwurf konnte nicht gelöscht werden");
        }
    },
    [deleteDraftMutation, toast]
);
```

Pass it through the KanbanColumn to KanbanCard. Note: this requires `KanbanColumn.tsx` to accept and forward `onDeleteDraft`. Check the file first and add the prop pass-through.

**Step 4: Add delete action for drafts in Repository list view**

In `Repository.tsx`, where draft items are rendered in the table, add a delete icon button that calls `useDeleteDraft`. The unified list already distinguishes drafts by their `status === "draft"` property.

**Step 5: Build check**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add frontend/src/hooks/api/useDraftQueries.ts frontend/src/components/documents/KanbanCard.tsx frontend/src/components/documents/KanbanBoard.tsx frontend/src/components/documents/KanbanColumn.tsx frontend/src/pages/Repository.tsx
git commit -m "feat(drafts): add useDeleteDraft hook + delete UI in kanban and list

Frontend can now delete drafts via the existing DELETE endpoint.
Invalidates drafts, kanban, and repository-stats on success.
Delete button appears on draft cards with confirmation dialog.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Backend — Ghost-Draft Guard (Validation)

Prevent creation of empty drafts by validating form_data has at least one non-empty value.

**Files:**
- Modify: `backend/app/api/v1/endpoints/documents/drafts.py:33-40` (DraftCreate validator)

**Step 1: Strengthen the form_data validator**

In `drafts.py`, replace the `validate_form_data` method on `DraftCreate` (lines 33-40):

```python
    @field_validator("form_data")
    @classmethod
    def validate_form_data(cls, v: dict) -> dict:
        """Ensure form_data is a valid dict, not excessively large, and not empty."""
        serialized = json.dumps(v)
        if len(serialized) > 500_000:  # 500KB max
            raise ValueError("form_data ist zu groß (max 500KB)")
        # Prevent ghost drafts: at least one field must have a non-empty value
        non_empty = [
            val for val in v.values()
            if isinstance(val, str) and val.strip()
        ]
        if not non_empty:
            raise ValueError("form_data muss mindestens ein ausgefülltes Feld enthalten")
        return v
```

**Step 2: Verify backend builds**

Run: `cd backend && python -c "from app.api.v1.endpoints.documents.drafts import router; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/documents/drafts.py
git commit -m "fix(drafts): reject empty form_data to prevent ghost drafts

Validator now requires at least one non-empty string field.
POST /drafts with form_data={} returns 422.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Frontend — Ghost-Draft Guard (Auto-Save)

Prevent the auto-save from creating a new draft when form data is empty.

**Files:**
- Modify: `frontend/src/hooks/wizard/useWizardDrafts.ts:148-176` (performAutoSave callback)

**Step 1: Add substantive data check**

In `useWizardDrafts.ts`, update `performAutoSave` (line 148). Add a guard after the `documentTypeId` check:

```typescript
    const performAutoSave = useCallback(async (data: typeof autoSaveData): Promise<void> => {
        if (!data.documentTypeId) return;

        // Prevent ghost drafts: don't create a new draft if form has no real data
        const hasSubstantiveData = Object.values(data.formData).some(
            v => typeof v === "string" && v.trim().length > 0
        );
        if (!hasSubstantiveData && !loadedDraftId) return;  // Only block NEW drafts, allow updates

        const draftName = data.documentTitle?.trim() || "Unbenannter Entwurf";
        // ... rest unchanged
```

The key detail: we only skip creation of *new* drafts (`!loadedDraftId`). If a draft already exists, we still allow updates even with empty form data (user might be clearing fields temporarily).

**Step 2: Build check**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/hooks/wizard/useWizardDrafts.ts
git commit -m "fix(drafts): prevent auto-save from creating ghost drafts

Skip draft creation when form has no substantive data.
Existing drafts can still be updated (user may be clearing fields).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Backend — Garbage Collection Job

Add periodic cleanup of expired and empty drafts to the existing scheduler.

**Files:**
- Modify: `backend/app/services/scheduler.py:90-126` (_run_all_checks + new function)

**Step 1: Add the cleanup function**

At the bottom of `scheduler.py` (after `_check_due_reminders`), add:

```python
# ═══════════════════════════════════════════════════════════════════════════
# CHECK 4: DRAFT GARBAGE COLLECTION
# ═══════════════════════════════════════════════════════════════════════════

async def _cleanup_expired_drafts(db: AsyncSession) -> int:
    """
    Löscht abgelaufene und leere Entwürfe:
    1. Drafts älter als 30 Tage (expired TTL)
    2. Leere Drafts (form_data='{}') älter als 24 Stunden
    """
    from app.models.enterprise import DocumentDraft

    now = datetime.now(timezone.utc)
    deleted = 0

    # 1) Expired drafts (>30 days old)
    ttl_cutoff = now - timedelta(days=30)
    expired_result = await db.execute(
        select(DocumentDraft).where(DocumentDraft.created_at < ttl_cutoff)
    )
    expired_drafts = expired_result.scalars().all()
    for draft in expired_drafts:
        await db.delete(draft)
        deleted += 1

    # 2) Empty drafts (form_data='{}') older than 24 hours
    empty_cutoff = now - timedelta(hours=24)
    empty_result = await db.execute(
        select(DocumentDraft).where(
            and_(
                DocumentDraft.created_at < empty_cutoff,
                DocumentDraft.form_data.in_(['{}', '""', '']),
            )
        )
    )
    empty_drafts = empty_result.scalars().all()
    for draft in empty_drafts:
        await db.delete(draft)
        deleted += 1

    if deleted > 0:
        logger.info("Draft-Garbage-Collection: %d Entwürfe gelöscht", deleted)

    return deleted
```

**Step 2: Wire into _run_all_checks**

In `_run_all_checks()` (line 90), add the cleanup call. After the `due_reminders` try/except block (after line 114), add:

```python
        try:
            stats["expired_drafts"] = await _cleanup_expired_drafts(db)
        except Exception:
            logger.exception("Fehler bei Draft-Garbage-Collection")
```

Also update the `stats` dict initialization (line 95) to include:
```python
        stats = {
            "overdue_approvals": 0,
            "overdue_returns": 0,
            "due_reminders": 0,
            "expired_drafts": 0,
        }
```

Add `timedelta` to the imports at the top (line 23, it's not imported yet):
```python
from datetime import datetime, timezone, timedelta
```

**Step 3: Verify backend builds**

Run: `cd backend && python -c "from app.services.scheduler import start_scheduler; print('OK')"`
Expected: `OK`

**Step 4: Commit**

```bash
git add backend/app/services/scheduler.py
git commit -m "feat(scheduler): add draft garbage collection job

Deletes drafts >30 days old and empty drafts >24h old.
Runs in existing 15-minute scheduler loop. Idempotent.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Backend — Stats Endpoint User Filtering

Add user ownership filtering to the stats endpoint so non-admin users only see their own document counts.

**Files:**
- Modify: `backend/app/api/v1/endpoints/documents/repository.py:388-474` (get_repository_stats)

**Step 1: Add ownership + archived filter**

Replace the entire `get_repository_stats` function body (lines 394-474) with:

```python
    """Get statistics for the document repository."""
    is_admin = getattr(current_user, "role", "user") == "admin"

    # Base filters: not deleted, not archived, user-scoped
    base_filters = [
        models.GeneratedDocument.is_deleted == False,  # noqa: E712
        models.GeneratedDocument.is_archived == False,  # noqa: E712
    ]
    if not is_admin:
        base_filters.append(models.GeneratedDocument.created_by_id == current_user.id)
    if country_code:
        base_filters.append(models.GeneratedDocument.country_code == country_code)

    # Total documents
    total_query = select(func.count(models.GeneratedDocument.id)).where(and_(*base_filters))
    total_result = await db.execute(total_query)
    total_documents = total_result.scalar() or 0

    # Documents this month
    first_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_query = select(func.count(models.GeneratedDocument.id)).where(
        and_(
            *base_filters,
            models.GeneratedDocument.created_at >= first_of_month,
        )
    )
    month_result = await db.execute(month_query)
    documents_this_month = month_result.scalar() or 0

    # Documents with corrections
    corrections_query = select(func.count(models.GeneratedDocument.id)).where(
        and_(
            *base_filters,
            models.GeneratedDocument.current_version > 1,
        )
    )
    corrections_result = await db.execute(corrections_query)
    documents_with_corrections = corrections_result.scalar() or 0

    # Documents by type (top 5)
    by_type_query = (
        select(
            DocumentType.name,
            func.count(models.GeneratedDocument.id).label("count")
        )
        .join(DocumentType, models.GeneratedDocument.document_type_id == DocumentType.id)
        .where(and_(*base_filters))
        .group_by(DocumentType.id, DocumentType.name)
        .order_by(desc("count"))
        .limit(5)
    )
    by_type_result = await db.execute(by_type_query)
    documents_by_type = [
        {"name": row.name, "count": row.count}
        for row in by_type_result
    ]

    # Documents by month (last 6 months)
    documents_by_month = []
    for i in range(5, -1, -1):
        target_date = datetime.now() - timedelta(days=i * 30)
        month_start = target_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if month_start.month == 12:
            month_end = month_start.replace(year=month_start.year + 1, month=1)
        else:
            month_end = month_start.replace(month=month_start.month + 1)

        month_count_query = select(func.count(models.GeneratedDocument.id)).where(
            and_(
                *base_filters,
                models.GeneratedDocument.created_at >= month_start,
                models.GeneratedDocument.created_at < month_end,
            )
        )
        month_count_result = await db.execute(month_count_query)
        count = month_count_result.scalar() or 0

        documents_by_month.append({
            "month": month_start.strftime("%Y-%m"),
            "label": month_start.strftime("%b %Y"),
            "count": count,
        })

    return DocumentStats(
        total_documents=total_documents,
        documents_this_month=documents_this_month,
        documents_with_corrections=documents_with_corrections,
        documents_by_type=documents_by_type,
        documents_by_month=documents_by_month,
    )
```

**Step 2: Verify backend builds**

Run: `cd backend && python -c "from app.api.v1.endpoints.documents.repository import router; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/documents/repository.py
git commit -m "fix(stats): scope repository stats to current user

Non-admin users now only see their own document counts.
Also excludes archived documents from all stats queries.
Same ownership pattern as /kanban and /repository endpoints.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Final Build + Backend Test

**Step 1: Run backend tests**

Run: `cd backend && python -m pytest tests/ -x -q`
Expected: Existing tests pass (20 pre-existing failures are known).

**Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors.

**Step 3: Final commit (if any adjustments needed)**

If any fixes were needed, commit them with descriptive messages.

---

## Summary of Changes

| Fix | Backend | Frontend | Status |
|-----|---------|----------|--------|
| 1. Kanban drafts | `repository.py` +source field, +draft injection | `useKanbanQueries.ts`, `KanbanCard.tsx`, `KanbanBoard.tsx` | New |
| 2. DELETE drafts | Already exists at `drafts.py:278` | `useDraftQueries.ts` +hook, `KanbanCard.tsx` +button | Frontend only |
| 3. Ghost guard | `drafts.py` validator | `useWizardDrafts.ts` auto-save guard | Both |
| 4. GC job | `scheduler.py` +cleanup function | — | Backend only |
| 5. Stats scoping | `repository.py` stats endpoint | — | Backend only |
