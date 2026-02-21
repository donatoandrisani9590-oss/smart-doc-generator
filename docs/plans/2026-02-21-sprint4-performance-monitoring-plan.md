# Sprint 4: Performance & Monitoring — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cache variant group DB queries in document preview, fix LLM logging level from debug to warning.

**Architecture:** 2 independent fixes. Sprint 4 scope was reduced after audit: ErrorBoundary, React.lazy code-splitting, and unhandledrejection listeners already exist in App.tsx/main.tsx. magic_fill.py is statistics-based (no LLM calls), so no log_llm_call needed.

**Tech Stack:** FastAPI, SQLAlchemy async, Redis CacheService, Python 3.11

---

## Task 1: Variant Group Cache in Preview Endpoint

The preview endpoint executes N+1 queries for variant groups on EVERY preview render — no caching. Each preview request triggers: 1 query for variant groups, then per-group: 1 query for ClauseVariantGroup, 1 query for ClauseVariant list, and N queries for each variant's Clause content.

**Files:**
- Modify: `backend/app/api/v1/endpoints/documents/preview.py` (lines 215-261)

**Step 1: Add variant group caching**

After the `clauses` cache block (line 213), wrap the variant groups section with Redis caching:

```python
    # 3b. Load variant groups for this document type (cached)
    vg_cache_key = f"preview:variant_groups:{request.document_type_id}"
    variant_groups_data = await cache.get(vg_cache_key)

    if variant_groups_data is None:
        vg_result = await db.execute(
            select(DocumentTypeVariantGroup)
            .where(DocumentTypeVariantGroup.document_type_id == request.document_type_id)
            .order_by(DocumentTypeVariantGroup.display_order)
        )
        dtvgs = vg_result.scalars().all()

        if dtvgs:
            variant_groups_data = []
            for dtvg in dtvgs:
                group = await db.get(ClauseVariantGroup, dtvg.variant_group_id)
                if group and group.is_active:
                    variants_result = await db.execute(
                        select(ClauseVariant)
                        .where(ClauseVariant.group_id == group.id)
                        .where(ClauseVariant.is_active == True)
                        .order_by(ClauseVariant.sort_order)
                    )
                    variants = variants_result.scalars().all()

                    variant_list = []
                    for v in variants:
                        vc = await db.get(Clause, v.clause_id)
                        condition = None
                        if v.auto_select_condition:
                            try:
                                condition = json.loads(v.auto_select_condition) if isinstance(v.auto_select_condition, str) else v.auto_select_condition
                            except (json.JSONDecodeError, TypeError):
                                condition = None

                        variant_list.append({
                            "id": v.id,
                            "variant_name": v.variant_name,
                            "variant_code": v.variant_code,
                            "is_default": v.is_default,
                            "auto_select_condition": condition,
                            "clause_title": vc.title if vc else "",
                            "clause_content": vc.content_html if vc else "",
                        })

                    variant_groups_data.append({
                        "id": group.id,
                        "name": group.name,
                        "variants": variant_list,
                    })

        # Cache for 2 minutes (same TTL as clauses)
        if variant_groups_data is not None:
            await cache.set(vg_cache_key, variant_groups_data, ttl=120)
```

**Step 2: Add cache invalidation key helper to cache.py**

Add to `backend/app/services/cache.py`:

```python
def variant_groups_cache_key(document_type_id: int) -> str:
    """Cache key for variant groups by document type."""
    return f"preview:variant_groups:{document_type_id}"


async def invalidate_variant_groups(document_type_id: int) -> None:
    """Invalidate variant groups cache for a document type."""
    await cache.delete(variant_groups_cache_key(document_type_id))
```

**Step 3: Add cache invalidation to variant group CRUD endpoints**

In `backend/app/api/v1/endpoints/core/clauses.py` (or wherever variant groups are modified), add invalidation calls after create/update/delete:

```python
from app.services.cache import invalidate_variant_groups
# After any variant group modification:
await invalidate_variant_groups(document_type_id)
```

**Step 4: Verify**

Run: `cd backend && python -c "from app.api.v1.endpoints.documents.preview import router; print('OK')"`

**Step 5: Commit**

```bash
git add backend/app/api/v1/endpoints/documents/preview.py backend/app/services/cache.py
git commit -m "perf(preview): cache variant group queries with 2min TTL

Variant groups for each document type are now cached in Redis,
eliminating N+1 queries on every preview render. TTL matches
existing clause cache (120s). Cache invalidation on CRUD.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: LLM Logging Level — debug → warning

When `log_llm_call()` fails (e.g., DB write error), it silently swallows the error at `logger.debug` level. This should be `logger.warning` so production monitoring catches it.

**Files:**
- Modify: `backend/app/services/llm_service.py:806`

**Step 1: Change log level**

```python
# Line 805-806 OLD:
    except Exception as e:
        logger.debug(f"LLM call logging failed (non-critical): {e}")

# NEW:
    except Exception as e:
        logger.warning("LLM call logging failed (non-critical): %s", e)
```

Also note: f-string replaced with %-format for lazy evaluation (logging best practice).

**Step 2: Commit**

```bash
git add backend/app/services/llm_service.py
git commit -m "fix(logging): log_llm_call failure level debug → warning

Ensures LLM logging failures are visible in production monitoring
instead of being silently swallowed at debug level.
Also fixes f-string → %-format for lazy log evaluation.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Final Verification

**Step 1: Verify backend imports**

Run: `cd backend && python -c "from app.services.llm_service import log_llm_call; from app.api.v1.endpoints.documents.preview import router; print('OK')"`

**Step 2: Run backend tests**

Run: `cd backend && python -m pytest tests/ -x -q`
Expected: Existing tests pass (20 pre-existing failures are known).

---

## Scope Reduction Notes

These items were in the Sprint 4 design but are **already implemented**:

1. **Code Splitting (React.lazy)** — Already in `App.tsx` with `lazy(() => import(...))` for all major pages
2. **Error Boundaries** — `ErrorBoundary.tsx` exists, used in both `main.tsx` and `App.tsx` with Sentry integration
3. **Unhandled Promise Rejection** — `window.addEventListener('unhandledrejection', ...)` in `main.tsx`
4. **magic_fill.py LLM logging** — `magic_fill.py` is purely statistics-based (Counter analysis on historical form_data), uses NO LLM calls whatsoever
