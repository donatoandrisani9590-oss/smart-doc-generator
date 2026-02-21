"""
Document Repository API endpoints (16.3 - DMS).

Central repository for all generated documents with:
- Advanced filtering and search
- Sorting and pagination
- Document metadata
- Status tracking
"""

from __future__ import annotations
import json
import logging
from typing import Any, Annotated, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, asc, func
from sqlalchemy.orm import joinedload
from datetime import datetime, timedelta, timezone

from app.db import get_db
from app.api import deps
from app.models import core as core_models
from app.models import enterprise as models
from app.models.documents import DocumentType
from app.models.enterprise import DocumentAction, DocumentApproval, DocumentDraft

logger = logging.getLogger(__name__)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class DocumentListItem(BaseModel):
    id: int
    title: Optional[str] = None
    document_type_id: int
    document_type_name: Optional[str] = None
    employee_name: Optional[str] = None
    employee_id: Optional[str] = None
    file_path: str
    current_version: int
    is_correctable: bool
    created_at: str
    created_by_id: Optional[int] = None
    created_by_email: Optional[str] = None
    retention_date: Optional[str] = None
    has_versions: bool = False
    version_count: int = 1
    pipeline_stage: Optional[str] = None
    has_open_actions: bool = False
    next_due_date: Optional[str] = None

    class Config:
        from_attributes = True


class RepositoryResponse(BaseModel):
    documents: List[DocumentListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    filters_applied: dict


class DocumentStats(BaseModel):
    total_documents: int
    documents_this_month: int
    documents_with_corrections: int
    documents_by_type: List[dict]
    documents_by_month: List[dict]


class BulkActionRequest(BaseModel):
    document_ids: List[int]
    action: str  # "delete", "archive", "export"


# ═══════════════════════════════════════════════════════════════════════════
# KANBAN SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

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


class KanbanColumn(BaseModel):
    stage: str
    label: str
    count: int
    documents: List[KanbanCardItem]


class KanbanBoardResponse(BaseModel):
    columns: List[KanbanColumn]
    total: int


class StageChangeRequest(BaseModel):
    target_stage: str = Field(..., description="Ziel-Stage (entwurf, freigabe, versendet, ruecklauf, abgeschlossen, archiv)")
    note: Optional[str] = Field(None, max_length=2000, description="Optionaler Kommentar zum Wechsel")
    metadata: Optional[dict] = Field(None, description="Zusätzliche Metadaten (z.B. Versandart, Frist)")


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("", response_model=RepositoryResponse)
async def list_documents(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    # Pagination
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    # Filtering
    search: Optional[str] = None,
    document_type_id: Optional[int] = None,
    country_code: Optional[str] = None,
    employee_name: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    has_corrections: Optional[bool] = None,
    include_archived: bool = False,  # By default, hide archived docs
    ownership: Optional[str] = Query(None, pattern="^(owned|shared)$"),
    action_filter: Optional[str] = Query(
        None,
        pattern="^(ohne_versand|ruecksendung_ausstehend|wiedervorlage_faellig|freigabe_offen|entwuerfe_ablaufend)$",
    ),
    # Sorting
    sort_by: str = Query("created_at", pattern="^(created_at|employee_name|document_type|title)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
) -> Any:
    """
    List all documents with filtering, sorting and pagination.

    This is the main endpoint for the document repository/DMS.
    """
    is_admin = getattr(current_user, "role", "user") == "admin"

    # Base query - exclude deleted, optionally exclude archived
    base_conditions = [models.GeneratedDocument.is_deleted == False]
    if not include_archived:
        base_conditions.append(models.GeneratedDocument.is_archived == False)

    if ownership == "owned" or (not ownership and not is_admin):
        # Wenn 'owned' oder kein expliziter Filter (und kein Admin), zeige nur eigene Dokumente
        base_conditions.append(models.GeneratedDocument.created_by_id == current_user.id)
    elif ownership == "shared":
        # Zeige nur Dokumente, die mit dem Nutzer (über Teams) geteilt wurden, aber nicht ihm gehören
        team_ids_sub = select(models.TeamMember.team_id).where(models.TeamMember.user_id == str(current_user.id))
        shared_doc_ids_sub = select(models.TeamDocumentShare.document_id).where(
            and_(
                models.TeamDocumentShare.team_id.in_(team_ids_sub),
                models.TeamDocumentShare.document_id.isnot(None)
            )
        )
        base_conditions.append(
            and_(
                models.GeneratedDocument.created_by_id != current_user.id,
                models.GeneratedDocument.id.in_(shared_doc_ids_sub)
            )
        )

    query = select(models.GeneratedDocument).where(and_(*base_conditions))

    # Count query for total
    count_query = select(func.count(models.GeneratedDocument.id)).where(and_(*base_conditions))

    filters_applied = {"include_archived": include_archived}

    # Apply filters
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                models.GeneratedDocument.title.ilike(search_term),
                models.GeneratedDocument.employee_name.ilike(search_term),
                models.GeneratedDocument.employee_id.ilike(search_term),
            )
        )
        count_query = count_query.where(
            or_(
                models.GeneratedDocument.title.ilike(search_term),
                models.GeneratedDocument.employee_name.ilike(search_term),
                models.GeneratedDocument.employee_id.ilike(search_term),
            )
        )
        filters_applied["search"] = search

    if document_type_id:
        query = query.where(models.GeneratedDocument.document_type_id == document_type_id)
        count_query = count_query.where(models.GeneratedDocument.document_type_id == document_type_id)
        filters_applied["document_type_id"] = document_type_id

    if employee_name:
        query = query.where(models.GeneratedDocument.employee_name.ilike(f"%{employee_name}%"))
        count_query = count_query.where(models.GeneratedDocument.employee_name.ilike(f"%{employee_name}%"))
        filters_applied["employee_name"] = employee_name

    if date_from:
        try:
            from_date = datetime.fromisoformat(date_from)
            query = query.where(models.GeneratedDocument.created_at >= from_date)
            count_query = count_query.where(models.GeneratedDocument.created_at >= from_date)
            filters_applied["date_from"] = date_from
        except ValueError:
            pass

    if date_to:
        try:
            to_date = datetime.fromisoformat(date_to)
            query = query.where(models.GeneratedDocument.created_at <= to_date)
            count_query = count_query.where(models.GeneratedDocument.created_at <= to_date)
            filters_applied["date_to"] = date_to
        except ValueError:
            pass

    if has_corrections is not None:
        if has_corrections:
            query = query.where(models.GeneratedDocument.current_version > 1)
            count_query = count_query.where(models.GeneratedDocument.current_version > 1)
        else:
            query = query.where(
                or_(
                    models.GeneratedDocument.current_version == 1,
                    models.GeneratedDocument.current_version.is_(None)
                )
            )
            count_query = count_query.where(
                or_(
                    models.GeneratedDocument.current_version == 1,
                    models.GeneratedDocument.current_version.is_(None)
                )
            )
        filters_applied["has_corrections"] = has_corrections

    # Action-based filtering (Handlungsbedarf-Karten)
    if action_filter:
        now = datetime.now(timezone.utc)
        if action_filter == "ohne_versand":
            action_cond = models.GeneratedDocument.workflow_status == "erstellt"
            query = query.where(action_cond)
            count_query = count_query.where(action_cond)
        elif action_filter == "ruecksendung_ausstehend":
            doc_ids_sub = select(DocumentAction.document_id).where(
                and_(
                    DocumentAction.action_type == "return_pending",
                    DocumentAction.is_completed == False,  # noqa: E712
                )
            )
            query = query.where(models.GeneratedDocument.id.in_(doc_ids_sub))
            count_query = count_query.where(models.GeneratedDocument.id.in_(doc_ids_sub))
        elif action_filter == "wiedervorlage_faellig":
            doc_ids_sub = select(DocumentAction.document_id).where(
                and_(
                    DocumentAction.action_type == "reminder_set",
                    DocumentAction.is_completed == False,  # noqa: E712
                    DocumentAction.due_date <= now,
                )
            )
            query = query.where(models.GeneratedDocument.id.in_(doc_ids_sub))
            count_query = count_query.where(models.GeneratedDocument.id.in_(doc_ids_sub))
        elif action_filter == "freigabe_offen":
            doc_ids_sub = select(DocumentAction.document_id).where(
                and_(
                    DocumentAction.action_type == "approval_requested",
                    DocumentAction.is_completed == False,  # noqa: E712
                )
            )
            query = query.where(models.GeneratedDocument.id.in_(doc_ids_sub))
            count_query = count_query.where(models.GeneratedDocument.id.in_(doc_ids_sub))
        elif action_filter == "entwuerfe_ablaufend":
            threshold = now + timedelta(days=30)
            query = query.where(
                and_(
                    models.GeneratedDocument.retention_date.isnot(None),
                    models.GeneratedDocument.retention_date <= threshold,
                    models.GeneratedDocument.retention_date > now,
                )
            )
            count_query = count_query.where(
                and_(
                    models.GeneratedDocument.retention_date.isnot(None),
                    models.GeneratedDocument.retention_date <= threshold,
                    models.GeneratedDocument.retention_date > now,
                )
            )
        filters_applied["action_filter"] = action_filter

    # Apply sorting
    sort_column = {
        "created_at": models.GeneratedDocument.created_at,
        "employee_name": models.GeneratedDocument.employee_name,
        "title": models.GeneratedDocument.title,
    }.get(sort_by, models.GeneratedDocument.created_at)

    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    # Execute query
    result = await db.execute(query)
    documents = result.scalars().all()

    # Get document type names
    doc_type_ids = list(set(d.document_type_id for d in documents if d.document_type_id))
    doc_types_result = await db.execute(
        select(DocumentType).where(DocumentType.id.in_(doc_type_ids))
    )
    doc_types = {dt.id: dt.name for dt in doc_types_result.scalars().all()}

    # Get version counts
    version_counts = {}
    if documents:
        doc_ids = [d.id for d in documents]
        version_result = await db.execute(
            select(
                models.DocumentVersion.document_id,
                func.count(models.DocumentVersion.id).label("count")
            )
            .where(models.DocumentVersion.document_id.in_(doc_ids))
            .group_by(models.DocumentVersion.document_id)
        )
        for row in version_result:
            version_counts[row.document_id] = row.count

    # Build response
    items = []
    for doc in documents:
        version_count = version_counts.get(doc.id, 0)
        items.append(DocumentListItem(
            id=doc.id,
            title=doc.title,
            document_type_id=doc.document_type_id,
            document_type_name=doc_types.get(doc.document_type_id),
            employee_name=doc.employee_name,
            employee_id=doc.employee_id,
            file_path=doc.file_path,
            current_version=doc.current_version or 1,
            is_correctable=doc.is_correctable if doc.is_correctable is not None else True,
            created_at=doc.created_at.isoformat() if doc.created_at else "",
            created_by_id=doc.created_by_id,
            retention_date=doc.retention_date.isoformat() if doc.retention_date else None,
            has_versions=version_count > 0,
            version_count=max(version_count, 1),
            pipeline_stage=doc.pipeline_stage or "entwurf",
            has_open_actions=doc.has_open_actions or False,
            next_due_date=doc.next_due_date.isoformat() if doc.next_due_date else None,
        ))

    total_pages = (total + page_size - 1) // page_size

    return RepositoryResponse(
        documents=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        filters_applied=filters_applied,
    )


@router.get("/stats", response_model=DocumentStats)
async def get_repository_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    country_code: Optional[str] = None,
) -> Any:
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


@router.get("/action-summary")
async def get_action_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
) -> Any:
    """
    Liefert Zähler für die Repository-Filterkarten.

    Alle Zähler beziehen sich nur auf Dokumente des angemeldeten Benutzers
    (created_by_id), sofern kein Admin. Admins sehen alle Dokumente.
    """
    is_admin = getattr(current_user, "role", "user") == "admin"
    now = datetime.now(timezone.utc)

    # Basis-Filter: nicht gelöschte Dokumente
    base_filters = [models.GeneratedDocument.is_deleted == False]  # noqa: E712

    if not is_admin:
        base_filters.append(models.GeneratedDocument.created_by_id == current_user.id)

    # 1) ohne_versand — Status "erstellt" (kein Versand erfolgt)
    ohne_versand_q = await db.execute(
        select(func.count(models.GeneratedDocument.id)).where(
            and_(*base_filters, models.GeneratedDocument.workflow_status == "erstellt")
        )
    )
    ohne_versand = ohne_versand_q.scalar() or 0

    # 2) ruecksendung_ausstehend — offene return_pending Aktionen
    rueck_q = await db.execute(
        select(func.count(func.distinct(DocumentAction.document_id))).where(
            and_(
                DocumentAction.action_type == "return_pending",
                DocumentAction.is_completed == False,  # noqa: E712
                DocumentAction.document_id.in_(
                    select(models.GeneratedDocument.id).where(and_(*base_filters))
                ),
            )
        )
    )
    ruecksendung_ausstehend = rueck_q.scalar() or 0

    # 3) wiedervorlage_faellig — reminder_set mit due_date <= jetzt
    wv_q = await db.execute(
        select(func.count(func.distinct(DocumentAction.document_id))).where(
            and_(
                DocumentAction.action_type == "reminder_set",
                DocumentAction.is_completed == False,  # noqa: E712
                DocumentAction.due_date <= now,
                DocumentAction.document_id.in_(
                    select(models.GeneratedDocument.id).where(and_(*base_filters))
                ),
            )
        )
    )
    wiedervorlage_faellig = wv_q.scalar() or 0

    # 4) freigabe_offen — offene approval_requested Aktionen
    freigabe_q = await db.execute(
        select(func.count(func.distinct(DocumentAction.document_id))).where(
            and_(
                DocumentAction.action_type == "approval_requested",
                DocumentAction.is_completed == False,  # noqa: E712
                DocumentAction.document_id.in_(
                    select(models.GeneratedDocument.id).where(and_(*base_filters))
                ),
            )
        )
    )
    freigabe_offen = freigabe_q.scalar() or 0

    # 5) entwuerfe_ablaufend — Retention-Datum in nächsten 30 Tagen
    threshold = now + timedelta(days=30)
    ablauf_q = await db.execute(
        select(func.count(models.GeneratedDocument.id)).where(
            and_(
                *base_filters,
                models.GeneratedDocument.retention_date.isnot(None),
                models.GeneratedDocument.retention_date <= threshold,
                models.GeneratedDocument.retention_date > now,
            )
        )
    )
    entwuerfe_ablaufend = ablauf_q.scalar() or 0

    # 6) ruecksendung_ueberfaellig — return_pending mit due_date in der Vergangenheit
    rueck_ueberf_q = await db.execute(
        select(func.count(func.distinct(DocumentAction.document_id))).where(
            and_(
                DocumentAction.action_type == "return_pending",
                DocumentAction.is_completed == False,  # noqa: E712
                DocumentAction.due_date.isnot(None),
                DocumentAction.due_date < now,
                DocumentAction.document_id.in_(
                    select(models.GeneratedDocument.id).where(and_(*base_filters))
                ),
            )
        )
    )
    ruecksendung_ueberfaellig = rueck_ueberf_q.scalar() or 0

    # 7) freigabe_ueberfaellig — pending_approval mit due_date in der Vergangenheit
    freigabe_ueberf_q = await db.execute(
        select(func.count(func.distinct(DocumentApproval.document_id))).where(
            and_(
                DocumentApproval.status == "pending_approval",
                DocumentApproval.due_date.isnot(None),
                DocumentApproval.due_date < now,
                DocumentApproval.document_id.in_(
                    select(models.GeneratedDocument.id).where(and_(*base_filters))
                ),
            )
        )
    )
    freigabe_ueberfaellig = freigabe_ueberf_q.scalar() or 0

    return {
        "ohne_versand": ohne_versand,
        "ruecksendung_ausstehend": ruecksendung_ausstehend,
        "wiedervorlage_faellig": wiedervorlage_faellig,
        "freigabe_offen": freigabe_offen,
        "entwuerfe_ablaufend": entwuerfe_ablaufend,
        "ruecksendung_ueberfaellig": ruecksendung_ueberfaellig,
        "freigabe_ueberfaellig": freigabe_ueberfaellig,
    }


# ═══════════════════════════════════════════════════════════════════════════
# KANBAN ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

PIPELINE_STAGE_LABELS = {
    "entwurf": "Entwurf",
    "freigabe": "Freigabe",
    "versendet": "Versendet",
    "ruecklauf": "Rücklauf",
    "abgeschlossen": "Abgeschlossen",
    "archiv": "Archiv",
}

# Ordered stages for Kanban columns
PIPELINE_STAGE_ORDER = ["entwurf", "freigabe", "versendet", "ruecklauf", "abgeschlossen", "archiv"]


@router.get("/kanban", response_model=KanbanBoardResponse, summary="Kanban-Board laden")
async def get_kanban_board(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    per_column: int = Query(20, ge=1, le=100, description="Dokumente pro Spalte"),
    search: Optional[str] = None,
    document_type_id: Optional[int] = None,
    country_code: Optional[str] = None,
    include_archived: bool = False,
    ownership: Optional[str] = Query(None, pattern="^(owned|shared)$"),
) -> Any:
    """
    Dokumente gruppiert nach pipeline_stage für das Kanban-Board.

    Jede Spalte enthält bis zu `per_column` Dokumente (neueste zuerst)
    und die Gesamtzahl pro Stage.
    """
    is_admin = getattr(current_user, "role", "user") == "admin"

    # Basis-Filter
    base_filters = [models.GeneratedDocument.is_deleted == False]  # noqa: E712
    if not include_archived:
        base_filters.append(models.GeneratedDocument.is_archived == False)  # noqa: E712

    if ownership == "owned" or (not ownership and not is_admin):
        base_filters.append(models.GeneratedDocument.created_by_id == current_user.id)
    elif ownership == "shared":
        team_ids_sub = select(models.TeamMember.team_id).where(models.TeamMember.user_id == str(current_user.id))
        shared_doc_ids_sub = select(models.TeamDocumentShare.document_id).where(
            and_(
                models.TeamDocumentShare.team_id.in_(team_ids_sub),
                models.TeamDocumentShare.document_id.isnot(None)
            )
        )
        base_filters.append(
            and_(
                models.GeneratedDocument.created_by_id != current_user.id,
                models.GeneratedDocument.id.in_(shared_doc_ids_sub)
            )
        )

    # Optionale Filter
    if search:
        search_term = f"%{search}%"
        base_filters.append(
            or_(
                models.GeneratedDocument.title.ilike(search_term),
                models.GeneratedDocument.employee_name.ilike(search_term),
                models.GeneratedDocument.employee_id.ilike(search_term),
            )
        )
    if document_type_id:
        base_filters.append(models.GeneratedDocument.document_type_id == document_type_id)
    if country_code:
        base_filters.append(models.GeneratedDocument.country_code == country_code)

    # Zähler pro Stage (eine einzige Abfrage)
    count_result = await db.execute(
        select(
            models.GeneratedDocument.pipeline_stage,
            func.count(models.GeneratedDocument.id).label("cnt"),
        )
        .where(and_(*base_filters))
        .group_by(models.GeneratedDocument.pipeline_stage)
    )
    stage_counts = {row.pipeline_stage: row.cnt for row in count_result}

    # Dokument-IDs für alle Stages sammeln (batch-laden statt N Queries)
    # Lade alle passenden Dokumente mit pipeline_stage
    all_docs_result = await db.execute(
        select(models.GeneratedDocument)
        .where(and_(*base_filters))
        .order_by(
            models.GeneratedDocument.pipeline_stage,
            desc(models.GeneratedDocument.created_at),
        )
    )
    all_docs = all_docs_result.scalars().all()

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

    # Dokumenttyp-Namen batch-laden (Dokumente + Entwürfe)
    doc_type_ids = list(set(d.document_type_id for d in all_docs if d.document_type_id))
    draft_type_ids = list(set(d.document_type_id for d in drafts if d.document_type_id))
    all_type_ids = list(set(doc_type_ids + draft_type_ids))
    doc_types: dict[int, str] = {}
    if all_type_ids:
        dt_result = await db.execute(
            select(DocumentType).where(DocumentType.id.in_(all_type_ids))
        )
        doc_types = {dt.id: dt.name for dt in dt_result.scalars().all()}

    # Gruppieren und limitieren
    stage_docs: dict[str, list[models.GeneratedDocument]] = {s: [] for s in PIPELINE_STAGE_ORDER}
    for doc in all_docs:
        stage = doc.pipeline_stage or "entwurf"
        if stage in stage_docs and len(stage_docs[stage]) < per_column:
            stage_docs[stage].append(doc)

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


@router.patch(
    "/{document_id}/stage",
    summary="Pipeline-Stage wechseln (Drag-and-Drop)",
)
async def change_document_stage(
    document_id: int,
    body: StageChangeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
) -> Any:
    """
    Ändert die Pipeline-Stage eines Dokuments.

    Erzeugt ein DocumentAction-Event 'stage_changed' und
    aktualisiert die denormalisierte pipeline_stage auf dem Dokument.
    Unterstützt flexible Transitions (Stages können übersprungen werden).
    """
    from app.api.v1.endpoints.documents.document_actions import (
        VALID_PIPELINE_STAGES,
        STAGE_TRANSITIONS,
        recalculate_document_lifecycle,
    )

    # Validierung: Ziel-Stage
    if body.target_stage not in VALID_PIPELINE_STAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ungültige Stage '{body.target_stage}'. "
                   f"Erlaubt: {', '.join(sorted(VALID_PIPELINE_STAGES))}",
        )

    # Dokument laden
    result = await db.execute(
        select(models.GeneratedDocument).where(
            and_(
                models.GeneratedDocument.id == document_id,
                models.GeneratedDocument.is_deleted == False,  # noqa: E712
            )
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokument nicht gefunden",
        )

    current_stage = doc.pipeline_stage or "entwurf"

    # Gleiche Stage → kein Wechsel nötig
    if current_stage == body.target_stage:
        return {
            "id": doc.id,
            "pipeline_stage": current_stage,
            "message": "Keine Änderung",
        }

    # Transition validieren
    allowed = STAGE_TRANSITIONS.get(current_stage, frozenset())
    if body.target_stage not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Wechsel von '{current_stage}' nach '{body.target_stage}' "
                   f"ist nicht erlaubt. Erlaubt: {', '.join(sorted(allowed))}",
        )

    # Sonderfälle: Archivieren / Entarchivieren
    if body.target_stage == "archiv":
        doc.is_archived = True
        doc.archived_at = datetime.now(timezone.utc)
        doc.archived_by = str(current_user.id)
    elif current_stage == "archiv" and body.target_stage != "archiv":
        doc.is_archived = False
        doc.archived_at = None
        doc.archived_by = None

    # Metadaten für das Event
    event_metadata = {
        "from_stage": current_stage,
        "to_stage": body.target_stage,
    }
    if body.metadata:
        event_metadata.update(body.metadata)

    # DocumentAction Event erzeugen
    performer_name = current_user.display_name or current_user.email
    action = DocumentAction(
        document_id=doc.id,
        action_type="stage_changed",
        performed_by_id=current_user.id,
        performed_by_name=performer_name,
        note=body.note,
        metadata_json=json.dumps(event_metadata, ensure_ascii=False, default=str),
        is_completed=False,
    )
    db.add(action)
    await db.flush()

    # Pipeline-Stage direkt setzen (Priorität: expliziter Wechsel)
    doc.pipeline_stage = body.target_stage

    # Lifecycle-Felder neu berechnen
    await recalculate_document_lifecycle(db, doc.id)

    # Falls recalculate die Stage überschrieben hat (z.B. durch Events),
    # den expliziten Wechsel bevorzugen
    doc.pipeline_stage = body.target_stage

    await db.commit()

    logger.info(
        "Pipeline-Stage geändert: document_id=%d, %s → %s, user=%s",
        doc.id,
        current_stage,
        body.target_stage,
        current_user.email,
    )

    return {
        "id": doc.id,
        "pipeline_stage": body.target_stage,
        "previous_stage": current_stage,
        "message": f"Stage geändert: {PIPELINE_STAGE_LABELS.get(current_stage, current_stage)} → {PIPELINE_STAGE_LABELS.get(body.target_stage, body.target_stage)}",
    }


@router.get("/{document_id}")
async def get_document_detail(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    document_id: int,
) -> Any:
    """Get detailed information about a document."""
    result = await db.execute(
        select(models.GeneratedDocument).where(
            and_(
                models.GeneratedDocument.id == document_id,
                models.GeneratedDocument.is_deleted == False,
            )
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokument nicht gefunden",
        )

    # Get document type
    doc_type_result = await db.execute(
        select(DocumentType).where(DocumentType.id == document.document_type_id)
    )
    doc_type = doc_type_result.scalar_one_or_none()

    # Get versions
    versions_result = await db.execute(
        select(models.DocumentVersion)
        .where(models.DocumentVersion.document_id == document_id)
        .order_by(desc(models.DocumentVersion.version_number))
    )
    versions = versions_result.scalars().all()

    # Parse form data
    form_data = None
    if document.form_data:
        try:
            form_data = json.loads(document.form_data)
        except json.JSONDecodeError:
            form_data = {}

    return {
        "id": document.id,
        "title": document.title,
        "document_type_id": document.document_type_id,
        "document_type_name": doc_type.name if doc_type else None,
        "document_type_category": doc_type.category if doc_type else None,
        "employee_name": document.employee_name,
        "employee_id": document.employee_id,
        "file_path": document.file_path,
        "current_version": document.current_version or 1,
        "is_correctable": document.is_correctable if document.is_correctable is not None else True,
        "created_at": document.created_at.isoformat() if document.created_at else None,
        "created_by_id": document.created_by_id,
        "retention_date": document.retention_date.isoformat() if document.retention_date else None,
        "pipeline_stage": document.pipeline_stage or "entwurf",
        "content_html": document.content_html,
        "form_data": form_data,
        "versions": [
            {
                "id": v.id,
                "version_number": v.version_number,
                "file_path": v.file_path,
                "change_reason": v.change_reason,
                "changed_fields": json.loads(v.changed_fields) if v.changed_fields else [],
                "created_by": v.created_by,
                "created_at": v.created_at.isoformat() if v.created_at else None,
                "is_current": v.is_current,
            }
            for v in versions
        ],
    }


@router.get("/{document_id}/related")
async def get_related_documents(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    document_id: int,
    limit: int = Query(5, ge=1, le=20),
) -> Any:
    """
    Get documents related to the specified document.

    Related documents are:
    - Documents for the same employee (same employee_name or employee_id)
    - Documents of the same type
    """
    # Get the source document
    result = await db.execute(
        select(models.GeneratedDocument).where(
            and_(
                models.GeneratedDocument.id == document_id,
                models.GeneratedDocument.is_deleted == False,
            )
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokument nicht gefunden",
        )

    related = []

    # Find documents for the same employee
    if document.employee_name or document.employee_id:
        employee_conditions = []
        if document.employee_name:
            employee_conditions.append(
                models.GeneratedDocument.employee_name == document.employee_name
            )
        if document.employee_id:
            employee_conditions.append(
                models.GeneratedDocument.employee_id == document.employee_id
            )

        employee_query = (
            select(models.GeneratedDocument)
            .where(
                and_(
                    models.GeneratedDocument.id != document_id,
                    models.GeneratedDocument.is_deleted == False,
                    or_(*employee_conditions),
                )
            )
            .order_by(desc(models.GeneratedDocument.created_at))
            .limit(limit)
        )
        employee_result = await db.execute(employee_query)
        same_employee_docs = employee_result.scalars().all()

        # Batch-load document type names (avoid N+1 query)
        emp_doc_type_ids = list(set(d.document_type_id for d in same_employee_docs if d.document_type_id))
        emp_doc_types = {}
        if emp_doc_type_ids:
            dt_result = await db.execute(
                select(DocumentType).where(DocumentType.id.in_(emp_doc_type_ids))
            )
            emp_doc_types = {dt.id: dt.name for dt in dt_result.scalars().all()}

        for doc in same_employee_docs:
            related.append({
                "id": doc.id,
                "title": doc.title,
                "employee_name": doc.employee_name,
                "document_type_name": emp_doc_types.get(doc.document_type_id),
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
                "relation": "same_employee",
            })

    # Find documents of the same type (if we still have room)
    remaining = limit - len(related)
    if remaining > 0:
        existing_ids = [document_id] + [r["id"] for r in related]
        type_query = (
            select(models.GeneratedDocument)
            .where(
                and_(
                    models.GeneratedDocument.id.not_in(existing_ids),
                    models.GeneratedDocument.is_deleted == False,
                    models.GeneratedDocument.document_type_id == document.document_type_id,
                )
            )
            .order_by(desc(models.GeneratedDocument.created_at))
            .limit(remaining)
        )
        type_result = await db.execute(type_query)
        same_type_docs = type_result.scalars().all()

        # Get document type name
        doc_type_result = await db.execute(
            select(DocumentType.name).where(DocumentType.id == document.document_type_id)
        )
        doc_type_name = doc_type_result.scalar()

        for doc in same_type_docs:
            related.append({
                "id": doc.id,
                "title": doc.title,
                "employee_name": doc.employee_name,
                "document_type_name": doc_type_name,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
                "relation": "same_type",
            })

    return {
        "related_documents": related,
        "total": len(related),
    }


@router.post("/bulk-action")
async def perform_bulk_action(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    request: BulkActionRequest,
) -> Any:
    """Perform bulk action on multiple documents."""
    if not request.document_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Keine Dokumente ausgewählt",
        )

    if request.action not in ["delete", "archive", "export"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ungültige Aktion",
        )

    # Get documents
    result = await db.execute(
        select(models.GeneratedDocument).where(
            models.GeneratedDocument.id.in_(request.document_ids)
        )
    )
    documents = result.scalars().all()

    processed = 0

    if request.action == "delete":
        for doc in documents:
            doc.is_deleted = True
            processed += 1
        await db.commit()
        return {"message": f"{processed} Dokument(e) gelöscht", "processed": processed}

    elif request.action == "archive":
        # Mark documents as archived
        from datetime import datetime
        user_id = str(current_user.id)
        for doc in documents:
            doc.is_archived = True
            doc.archived_at = datetime.now(timezone.utc)
            doc.archived_by = user_id
            processed += 1
        await db.commit()
        return {"message": f"{processed} Dokument(e) archiviert", "processed": processed}

    elif request.action == "unarchive":
        # Restore archived documents
        for doc in documents:
            doc.is_archived = False
            doc.archived_at = None
            doc.archived_by = None
            processed += 1
        await db.commit()
        return {"message": f"{processed} Dokument(e) wiederhergestellt", "processed": processed}

    elif request.action == "export":
        # Return list of file paths for download
        file_paths = [doc.file_path for doc in documents]
        return {
            "message": f"{len(file_paths)} Dokument(e) zum Export bereit",
            "file_paths": file_paths,
            "processed": len(file_paths),
        }

    return {"message": "Keine Aktion durchgeführt", "processed": 0}


@router.get("/export-list")
async def export_document_list(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    # Same filters as list endpoint
    search: Optional[str] = None,
    document_type_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Any:
    """Export document list as CSV or Excel."""
    # Build query with same filters as list
    query = select(models.GeneratedDocument).where(
        models.GeneratedDocument.is_deleted == False
    )

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                models.GeneratedDocument.title.ilike(search_term),
                models.GeneratedDocument.employee_name.ilike(search_term),
            )
        )

    if document_type_id:
        query = query.where(models.GeneratedDocument.document_type_id == document_type_id)

    if date_from:
        try:
            from_date = datetime.fromisoformat(date_from)
            query = query.where(models.GeneratedDocument.created_at >= from_date)
        except ValueError:
            pass

    if date_to:
        try:
            to_date = datetime.fromisoformat(date_to)
            query = query.where(models.GeneratedDocument.created_at <= to_date)
        except ValueError:
            pass

    query = query.order_by(desc(models.GeneratedDocument.created_at))

    result = await db.execute(query)
    documents = result.scalars().all()

    # Get document type names
    doc_type_ids = list(set(d.document_type_id for d in documents if d.document_type_id))
    doc_types_result = await db.execute(
        select(DocumentType).where(DocumentType.id.in_(doc_type_ids))
    )
    doc_types = {dt.id: dt.name for dt in doc_types_result.scalars().all()}

    # Build export data
    export_data = []
    for doc in documents:
        export_data.append({
            "ID": doc.id,
            "Titel": doc.title or "",
            "Dokumenttyp": doc_types.get(doc.document_type_id, ""),
            "Mitarbeitername": doc.employee_name or "",
            "Personalnummer": doc.employee_id or "",
            "Version": doc.current_version or 1,
            "Erstellt am": doc.created_at.strftime("%d.%m.%Y %H:%M") if doc.created_at else "",
        })

    # Generate actual file response
    import io
    from fastapi.responses import StreamingResponse

    if format == "csv":
        import csv
        output = io.StringIO()
        if export_data:
            writer = csv.DictWriter(output, fieldnames=export_data[0].keys())
            writer.writeheader()
            writer.writerows(export_data)
        content = output.getvalue()
        output.close()

        return StreamingResponse(
            io.BytesIO(content.encode("utf-8-sig")),  # BOM for Excel compatibility
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=dokumente_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    else:  # xlsx
        try:
            import openpyxl
            from openpyxl.utils.dataframe import dataframe_to_rows

            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Dokumente"

            # Header
            if export_data:
                headers = list(export_data[0].keys())
                ws.append(headers)

                # Data rows
                for row in export_data:
                    ws.append(list(row.values()))

            # Auto-width columns
            for column in ws.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except (ValueError, TypeError):
                        pass
                adjusted_width = min(max_length + 2, 50)
                ws.column_dimensions[column_letter].width = adjusted_width

            # Save to buffer
            output = io.BytesIO()
            wb.save(output)
            output.seek(0)

            return StreamingResponse(
                output,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f"attachment; filename=dokumente_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
                }
            )
        except ImportError:
            # Fallback to CSV if openpyxl not installed
            import csv
            output = io.StringIO()
            if export_data:
                writer = csv.DictWriter(output, fieldnames=export_data[0].keys())
                writer.writeheader()
                writer.writerows(export_data)
            content = output.getvalue()
            output.close()

            return StreamingResponse(
                io.BytesIO(content.encode("utf-8-sig")),
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=dokumente_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                }
            )
