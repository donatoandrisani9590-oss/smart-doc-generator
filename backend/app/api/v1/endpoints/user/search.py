"""
Global Search API endpoints.

Provides full-text search across documents and drafts.
"""

from __future__ import annotations
from typing import Any, Annotated, Optional, List
from datetime import datetime
import json
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func, cast, String
from pydantic import BaseModel

from app.db import get_db

logger = logging.getLogger(__name__)
from app.api import deps
from app.models import core as core_models
from app.models import enterprise as models
from app.models import documents as doc_models

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class SearchResult(BaseModel):
    """Single search result."""
    id: int
    result_type: str  # 'document' or 'draft'
    document_type_name: str
    employee_name: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    status: str  # 'final' or 'draft'
    relevance_score: float = 1.0


class SearchResponse(BaseModel):
    """Response from search endpoint."""
    query: str
    total_results: int
    results: List[SearchResult]
    search_time_ms: float


class SearchSuggestion(BaseModel):
    """Search suggestion for autocomplete."""
    text: str
    type: str  # 'employee', 'document_type'
    count: int


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def extract_employee_name(form_data: dict) -> str:
    """Extract employee name from form data."""
    if not form_data:
        return ""

    vorname = form_data.get("mitarbeiter_vorname", "")
    nachname = form_data.get("mitarbeiter_nachname", "")

    if vorname and nachname:
        return f"{nachname}, {vorname}"
    elif nachname:
        return nachname
    elif vorname:
        return vorname

    return ""


def matches_query(text: str, query: str) -> bool:
    """Check if text matches query (case-insensitive contains)."""
    if not text or not query:
        return False
    return query.lower() in text.lower()


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("", response_model=SearchResponse)
async def global_search(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    q: str,
    country_code: Optional[str] = None,
    result_type: Optional[str] = None,  # 'document', 'draft', or None for both
    limit: int = 50,
) -> Any:
    """
    Global search across documents and drafts.

    Searches by:
    - Employee name (from form_data)
    - Document type name

    Supports filtering by country_code and result_type.
    """
    import time
    start_time = time.time()

    if not country_code:
        country_code = getattr(current_user, 'country_code', 'DE')

    query_lower = q.lower().strip()
    results: List[SearchResult] = []

    # ═══════════════════════════════════════════════════════════════════════
    # SEARCH DOCUMENTS
    # ═══════════════════════════════════════════════════════════════════════

    if result_type in (None, "document"):
        docs_query = (
            select(
                models.GeneratedDocument.id,
                models.GeneratedDocument.created_at,
                models.GeneratedDocument.form_data,
                doc_models.DocumentType.name.label("document_type_name"),
            )
            .join(doc_models.DocumentType, models.GeneratedDocument.document_type_id == doc_models.DocumentType.id)
            .where(
                and_(
                    models.GeneratedDocument.country_code == country_code,
                    models.GeneratedDocument.is_deleted == False,
                )
            )
            .order_by(models.GeneratedDocument.created_at.desc())
            .limit(limit * 2)  # Fetch more to filter
        )

        docs_result = await db.execute(docs_query)
        docs_rows = docs_result.all()

        for row in docs_rows:
            doc_id, created_at, form_data, dt_name = row

            # Extract employee name from form_data (JSON)
            employee_name = ""
            if form_data:
                if isinstance(form_data, str):
                    try:
                        form_data = json.loads(form_data)
                    except (json.JSONDecodeError, TypeError) as e:
                        logger.warning(f"Failed to parse form_data JSON: {e}")
                        form_data = {}
                employee_name = extract_employee_name(form_data)

            # Check if matches query
            matches = (
                matches_query(employee_name, query_lower) or
                matches_query(dt_name, query_lower)
            )

            if matches:
                # Calculate relevance score
                score = 1.0
                if employee_name and query_lower in employee_name.lower():
                    score += 2.0  # Employee name match is more relevant
                if dt_name and query_lower in dt_name.lower():
                    score += 1.0

                results.append(SearchResult(
                    id=doc_id,
                    result_type="document",
                    document_type_name=dt_name,
                    employee_name=employee_name or None,
                    created_at=created_at.isoformat() if created_at else None,
                    status="final",
                    relevance_score=score,
                ))

    # ═══════════════════════════════════════════════════════════════════════
    # SEARCH DRAFTS
    # ═══════════════════════════════════════════════════════════════════════

    if result_type in (None, "draft"):
        drafts_query = (
            select(
                models.DocumentDraft.id,
                models.DocumentDraft.updated_at,
                models.DocumentDraft.form_data,
                models.DocumentDraft.name,
                doc_models.DocumentType.name.label("document_type_name"),
            )
            .join(doc_models.DocumentType, models.DocumentDraft.document_type_id == doc_models.DocumentType.id)
            .where(
                and_(
                    models.DocumentDraft.country_code == country_code,
                    models.DocumentDraft.user_id == str(current_user.id),
                )
            )
            .order_by(models.DocumentDraft.updated_at.desc())
            .limit(limit)
        )

        drafts_result = await db.execute(drafts_query)
        drafts_rows = drafts_result.all()

        for row in drafts_rows:
            draft_id, updated_at, form_data, draft_name, dt_name = row

            # Extract employee name from form_data (JSON)
            employee_name = ""
            if form_data:
                if isinstance(form_data, str):
                    try:
                        form_data = json.loads(form_data)
                    except (json.JSONDecodeError, TypeError) as e:
                        logger.warning(f"Failed to parse form_data JSON: {e}")
                        form_data = {}
                employee_name = extract_employee_name(form_data)

            # Use draft name or employee name
            display_name = draft_name or employee_name

            # Check if matches query
            matches = (
                matches_query(display_name, query_lower) or
                matches_query(dt_name, query_lower)
            )

            if matches:
                score = 1.0
                if display_name and query_lower in display_name.lower():
                    score += 2.0
                if dt_name and query_lower in dt_name.lower():
                    score += 1.0

                results.append(SearchResult(
                    id=draft_id,
                    result_type="draft",
                    document_type_name=dt_name,
                    employee_name=display_name or None,
                    updated_at=updated_at.isoformat() if updated_at else None,
                    status="draft",
                    relevance_score=score,
                ))

    # ═══════════════════════════════════════════════════════════════════════
    # SORT BY RELEVANCE AND LIMIT
    # ═══════════════════════════════════════════════════════════════════════

    results.sort(key=lambda x: x.relevance_score, reverse=True)
    results = results[:limit]

    search_time = (time.time() - start_time) * 1000  # Convert to ms

    # ═══════════════════════════════════════════════════════════════════════
    # SAVE SEARCH TO HISTORY
    # ═══════════════════════════════════════════════════════════════════════

    if len(q.strip()) >= 2:  # Nur sinnvolle Suchen speichern
        user_id = str(current_user.id)

        # Neue Suche hinzufügen
        new_search = models.SearchHistory(
            user_id=user_id,
            query=q.strip(),
            result_count=len(results),
            country_code=country_code,
        )
        db.add(new_search)

        # Alte Einträge löschen (max 20 behalten)
        from sqlalchemy import delete

        # Subquery für die IDs die behalten werden sollen
        keep_ids_query = (
            select(models.SearchHistory.id)
            .where(models.SearchHistory.user_id == user_id)
            .order_by(models.SearchHistory.created_at.desc())
            .limit(20)
        )
        keep_ids_result = await db.execute(keep_ids_query)
        keep_ids = [row[0] for row in keep_ids_result.all()]

        if keep_ids:
            # Lösche alle älteren Einträge
            await db.execute(
                delete(models.SearchHistory).where(
                    and_(
                        models.SearchHistory.user_id == user_id,
                        models.SearchHistory.id.not_in(keep_ids)
                    )
                )
            )

        await db.commit()

    return SearchResponse(
        query=q,
        total_results=len(results),
        results=results,
        search_time_ms=round(search_time, 2),
    )


@router.get("/suggestions")
async def search_suggestions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    q: str,
    country_code: Optional[str] = None,
    limit: int = 10,
) -> Any:
    """
    Get search suggestions for autocomplete.

    Returns employee names and document type names that match the query prefix.
    """
    if not country_code:
        country_code = getattr(current_user, 'country_code', 'DE')

    query_lower = q.lower().strip()
    suggestions: List[SearchSuggestion] = []

    # Get document type suggestions
    dt_query = (
        select(doc_models.DocumentType.name)
        .where(
            and_(
                doc_models.DocumentType.country_code == country_code,
                doc_models.DocumentType.is_active == True,
                func.lower(doc_models.DocumentType.name).contains(query_lower),
            )
        )
        .distinct()
        .limit(limit // 2)
    )

    dt_result = await db.execute(dt_query)
    for (dt_name,) in dt_result.all():
        suggestions.append(SearchSuggestion(
            text=dt_name,
            type="document_type",
            count=0,
        ))

    # For employee suggestions, we'd need to scan form_data
    # This is a simplified version - in production, consider a separate search index

    return {"suggestions": suggestions, "query": q}


@router.get("/recent")
async def recent_searches(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    limit: int = 10,
) -> Any:
    """
    Get user's recent search queries.

    Returns the last N unique searches for the current user.
    """
    user_id = str(current_user.id)

    # Letzte Suchen holen (unique Queries)
    recent_query = (
        select(
            models.SearchHistory.query,
            models.SearchHistory.result_count,
            models.SearchHistory.created_at,
        )
        .where(models.SearchHistory.user_id == user_id)
        .order_by(models.SearchHistory.created_at.desc())
        .limit(limit)
    )

    result = await db.execute(recent_query)
    rows = result.all()

    # Unique Queries behalten (erste Vorkommen)
    seen = set()
    recent = []
    for query_text, result_count, created_at in rows:
        if query_text.lower() not in seen:
            seen.add(query_text.lower())
            recent.append({
                "query": query_text,
                "result_count": result_count,
                "searched_at": created_at.isoformat() if created_at else None,
            })

    return {"recent": recent}


@router.delete("/recent")
async def clear_search_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
) -> Any:
    """
    Clear the user's search history.
    """
    from sqlalchemy import delete

    user_id = str(current_user.id)

    await db.execute(
        delete(models.SearchHistory).where(models.SearchHistory.user_id == user_id)
    )
    await db.commit()

    return {"message": "Suchverlauf gelöscht"}
