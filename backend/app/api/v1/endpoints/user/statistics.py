"""
Statistics endpoints for HR Dashboard.

Provides real-time statistics about document generation,
usage patterns, and team activity.
"""

from __future__ import annotations
from typing import Any, Annotated, Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel

from app.db import get_db
from app.api import deps
from app.models import documents as doc_models
from app.models import core as core_models
from app.models import enterprise as enterprise_models

# Unified model references for statistics queries
# DocumentType, Clause, DocumentTypeClause are in documents.py
# GeneratedDocument, DocumentDraft, BulkJob are in enterprise.py
class models:
    """Namespace combining document and enterprise models for queries."""
    DocumentType = doc_models.DocumentType
    Clause = doc_models.Clause
    DocumentTypeClause = doc_models.DocumentTypeClause
    GeneratedDocument = enterprise_models.GeneratedDocument
    DocumentDraft = enterprise_models.DocumentDraft
    BulkJob = enterprise_models.BulkJob

router = APIRouter()


class DocumentTypeStats(BaseModel):
    """Statistics for a single document type."""
    document_type_id: int
    document_type_name: str
    count: int
    percentage: float


class UserActivityStats(BaseModel):
    """Activity statistics for a user."""
    user_id: str
    user_name: str
    document_count: int
    draft_count: int
    last_activity: Optional[datetime] = None


class DashboardStats(BaseModel):
    """Complete dashboard statistics."""
    # Counts
    documents_this_month: int
    documents_total: int
    open_drafts: int
    bulk_jobs_this_month: int
    bulk_documents_this_month: int

    # Comparisons
    documents_change_percent: Optional[float] = None  # vs last month

    # Top document types
    top_document_types: list[DocumentTypeStats]

    # Unused clauses (last 90 days)
    unused_clause_count: int

    # Team stats (for team leads)
    team_document_count: Optional[int] = None
    team_draft_count: Optional[int] = None
    team_members: Optional[list[UserActivityStats]] = None


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    country_code: Optional[str] = None,
) -> Any:
    """
    Get comprehensive dashboard statistics.

    Returns document counts, trends, top types, and team activity
    for the authenticated user's country/team.
    """
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)

    # Use user's country_code if not specified
    if not country_code:
        country_code = getattr(current_user, 'country_code', 'DE')

    # ═══════════════════════════════════════════════════════════════════════════
    # DOCUMENT COUNTS
    # ═══════════════════════════════════════════════════════════════════════════

    # Documents this month (exclude deleted and archived)
    docs_this_month_query = select(func.count(models.GeneratedDocument.id)).where(
        and_(
            models.GeneratedDocument.country_code == country_code,
            models.GeneratedDocument.created_at >= month_start,
            models.GeneratedDocument.is_deleted == False,
            models.GeneratedDocument.is_archived == False,
        )
    )
    docs_this_month_result = await db.execute(docs_this_month_query)
    documents_this_month = docs_this_month_result.scalar() or 0

    # Documents last month (for comparison, exclude deleted and archived)
    docs_last_month_query = select(func.count(models.GeneratedDocument.id)).where(
        and_(
            models.GeneratedDocument.country_code == country_code,
            models.GeneratedDocument.created_at >= last_month_start,
            models.GeneratedDocument.created_at < month_start,
            models.GeneratedDocument.is_deleted == False,
            models.GeneratedDocument.is_archived == False,
        )
    )
    docs_last_month_result = await db.execute(docs_last_month_query)
    documents_last_month = docs_last_month_result.scalar() or 0

    # Calculate change percentage
    if documents_last_month > 0:
        change_percent = ((documents_this_month - documents_last_month) / documents_last_month) * 100
    else:
        change_percent = 100.0 if documents_this_month > 0 else 0.0

    # Total documents (exclude deleted)
    total_docs_query = select(func.count(models.GeneratedDocument.id)).where(
        and_(
            models.GeneratedDocument.country_code == country_code,
            models.GeneratedDocument.is_deleted == False,
        )
    )
    total_docs_result = await db.execute(total_docs_query)
    documents_total = total_docs_result.scalar() or 0

    # ═══════════════════════════════════════════════════════════════════════════
    # DRAFTS
    # ═══════════════════════════════════════════════════════════════════════════

    drafts_query = select(func.count(models.DocumentDraft.id)).where(
        and_(
            models.DocumentDraft.country_code == country_code,
            models.DocumentDraft.user_id == str(current_user.id),
        )
    )
    drafts_result = await db.execute(drafts_query)
    open_drafts = drafts_result.scalar() or 0

    # ═══════════════════════════════════════════════════════════════════════════
    # BULK JOBS
    # ═══════════════════════════════════════════════════════════════════════════

    bulk_jobs_query = select(
        func.count(models.BulkJob.id),
        func.coalesce(func.sum(models.BulkJob.total_records), 0)
    ).where(
        models.BulkJob.created_at >= month_start,
    )
    bulk_result = await db.execute(bulk_jobs_query)
    bulk_row = bulk_result.first()
    bulk_jobs_this_month = (bulk_row[0] or 0) if bulk_row else 0
    bulk_documents_this_month = (bulk_row[1] or 0) if bulk_row else 0

    # ═══════════════════════════════════════════════════════════════════════════
    # TOP DOCUMENT TYPES (last 30 days)
    # ═══════════════════════════════════════════════════════════════════════════

    thirty_days_ago = now - timedelta(days=30)

    top_types_query = (
        select(
            models.GeneratedDocument.document_type_id,
            models.DocumentType.name,
            func.count(models.GeneratedDocument.id).label('count')
        )
        .join(models.DocumentType, models.GeneratedDocument.document_type_id == models.DocumentType.id)
        .where(
            and_(
                models.GeneratedDocument.country_code == country_code,
                models.GeneratedDocument.created_at >= thirty_days_ago,
                models.GeneratedDocument.is_deleted == False,
                models.GeneratedDocument.is_archived == False,
            )
        )
        .group_by(models.GeneratedDocument.document_type_id, models.DocumentType.name)
        .order_by(func.count(models.GeneratedDocument.id).desc())
        .limit(5)
    )

    top_types_result = await db.execute(top_types_query)
    top_types_rows = top_types_result.all()

    # Calculate total for percentage
    total_last_30_days = sum(row[2] for row in top_types_rows)

    top_document_types = [
        DocumentTypeStats(
            document_type_id=row[0],
            document_type_name=row[1],
            count=row[2],
            percentage=round((row[2] / total_last_30_days) * 100, 1) if total_last_30_days > 0 else 0
        )
        for row in top_types_rows
    ]

    # ═══════════════════════════════════════════════════════════════════════════
    # UNUSED CLAUSES (last 90 days)
    # ═══════════════════════════════════════════════════════════════════════════

    ninety_days_ago = now - timedelta(days=90)

    # Get all active clauses
    all_clauses_query = select(func.count(models.Clause.id)).where(
        and_(
            models.Clause.country_code == country_code,
            models.Clause.is_active == True,
        )
    )
    all_clauses_result = await db.execute(all_clauses_query)
    all_clauses_count = all_clauses_result.scalar() or 0

    # Get clauses used in document types that were generated
    used_clauses_subquery = (
        select(models.DocumentTypeClause.clause_id.distinct())
        .join(models.GeneratedDocument, models.DocumentTypeClause.document_type_id == models.GeneratedDocument.document_type_id)
        .where(models.GeneratedDocument.created_at >= ninety_days_ago)
    )

    used_clauses_result = await db.execute(used_clauses_subquery)
    used_clause_ids = {row[0] for row in used_clauses_result.all()}

    unused_clause_count = all_clauses_count - len(used_clause_ids)
    unused_clause_count = max(0, unused_clause_count)  # Ensure non-negative

    # ═══════════════════════════════════════════════════════════════════════════
    # BUILD RESPONSE
    # ═══════════════════════════════════════════════════════════════════════════

    # ═══════════════════════════════════════════════════════════════════════════
    # TEAM STATISTICS (für Team-Owner und Admins)
    # ═══════════════════════════════════════════════════════════════════════════

    team_document_count = None
    team_draft_count = None
    team_members = None

    # Prüfen ob der User Team-Owner oder Admin ist
    user_id_str = str(current_user.id)

    # Teams finden wo der User Owner oder Admin ist
    team_leader_query = (
        select(enterprise_models.TeamMember.team_id)
        .where(
            and_(
                enterprise_models.TeamMember.user_id == user_id_str,
                enterprise_models.TeamMember.role.in_(["owner", "admin"])
            )
        )
    )
    team_leader_result = await db.execute(team_leader_query)
    managed_team_ids = [row[0] for row in team_leader_result.all()]

    if managed_team_ids:
        # Alle Mitglieder der Teams holen (außer sich selbst)
        team_members_query = (
            select(enterprise_models.TeamMember.user_id)
            .where(
                and_(
                    enterprise_models.TeamMember.team_id.in_(managed_team_ids),
                    enterprise_models.TeamMember.user_id != user_id_str
                )
            )
            .distinct()
        )
        team_members_result = await db.execute(team_members_query)
        team_member_ids = [row[0] for row in team_members_result.all()]

        if team_member_ids:
            # Team-Dokumente zählen (diesen Monat, ohne gelöschte/archivierte)
            team_docs_query = select(func.count(models.GeneratedDocument.id)).where(
                and_(
                    models.GeneratedDocument.country_code == country_code,
                    models.GeneratedDocument.created_by.in_(team_member_ids),
                    models.GeneratedDocument.created_at >= month_start,
                    models.GeneratedDocument.is_deleted == False,
                    models.GeneratedDocument.is_archived == False,
                )
            )
            team_docs_result = await db.execute(team_docs_query)
            team_document_count = team_docs_result.scalar() or 0

            # Team-Entwürfe zählen
            team_drafts_query = select(func.count(enterprise_models.DocumentDraft.id)).where(
                and_(
                    enterprise_models.DocumentDraft.country_code == country_code,
                    enterprise_models.DocumentDraft.user_id.in_(team_member_ids),
                )
            )
            team_drafts_result = await db.execute(team_drafts_query)
            team_draft_count = team_drafts_result.scalar() or 0

            # Aktivität pro Team-Mitglied
            team_members = []
            for member_id in team_member_ids:
                # Dokumente des Mitglieds (ohne gelöschte/archivierte)
                member_docs_query = select(func.count(models.GeneratedDocument.id)).where(
                    and_(
                        models.GeneratedDocument.country_code == country_code,
                        models.GeneratedDocument.created_by == member_id,
                        models.GeneratedDocument.is_deleted == False,
                        models.GeneratedDocument.is_archived == False,
                    )
                )
                member_docs_result = await db.execute(member_docs_query)
                member_doc_count = member_docs_result.scalar() or 0

                # Entwürfe des Mitglieds
                member_drafts_query = select(func.count(enterprise_models.DocumentDraft.id)).where(
                    and_(
                        enterprise_models.DocumentDraft.country_code == country_code,
                        enterprise_models.DocumentDraft.user_id == member_id,
                    )
                )
                member_drafts_result = await db.execute(member_drafts_query)
                member_draft_count = member_drafts_result.scalar() or 0

                # Letzte Aktivität
                last_activity_query = (
                    select(models.GeneratedDocument.created_at)
                    .where(models.GeneratedDocument.created_by == member_id)
                    .order_by(models.GeneratedDocument.created_at.desc())
                    .limit(1)
                )
                last_activity_result = await db.execute(last_activity_query)
                last_activity_row = last_activity_result.first()
                last_activity = last_activity_row[0] if last_activity_row else None

                # User-Info holen (falls verfügbar)
                user_info_query = select(core_models.User).where(
                    core_models.User.id == int(member_id) if member_id.isdigit() else core_models.User.email == member_id
                )
                user_info_result = await db.execute(user_info_query)
                user_info = user_info_result.scalar_one_or_none()

                user_name = "Unbekannt"
                if user_info:
                    if hasattr(user_info, 'full_name') and user_info.full_name:
                        user_name = user_info.full_name
                    elif hasattr(user_info, 'email'):
                        user_name = user_info.email

                team_members.append(UserActivityStats(
                    user_id=member_id,
                    user_name=user_name,
                    document_count=member_doc_count,
                    draft_count=member_draft_count,
                    last_activity=last_activity
                ))

            # Nach Aktivität sortieren (aktivste zuerst)
            team_members.sort(key=lambda m: m.document_count, reverse=True)

    return DashboardStats(
        documents_this_month=documents_this_month,
        documents_total=documents_total,
        open_drafts=open_drafts,
        bulk_jobs_this_month=bulk_jobs_this_month,
        bulk_documents_this_month=bulk_documents_this_month,
        documents_change_percent=round(change_percent, 1),
        top_document_types=top_document_types,
        unused_clause_count=unused_clause_count,
        team_document_count=team_document_count,
        team_draft_count=team_draft_count,
        team_members=team_members,
    )


@router.get("/my-activity")
async def get_my_activity(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    limit: int = 10,
) -> Any:
    """
    Get recent activity for the current user.

    Returns the last N documents and drafts created by this user.
    """
    user_id = str(current_user.id)

    # Recent documents (exclude deleted and archived)
    docs_query = (
        select(
            models.GeneratedDocument.id,
            models.GeneratedDocument.document_type_id,
            models.DocumentType.name.label('document_type_name'),
            models.GeneratedDocument.created_at,
            models.GeneratedDocument.form_data,
        )
        .join(models.DocumentType, models.GeneratedDocument.document_type_id == models.DocumentType.id)
        .where(
            and_(
                models.GeneratedDocument.created_by == user_id,
                models.GeneratedDocument.is_deleted == False,
                models.GeneratedDocument.is_archived == False,
            )
        )
        .order_by(models.GeneratedDocument.created_at.desc())
        .limit(limit)
    )

    docs_result = await db.execute(docs_query)
    recent_documents = [
        {
            "id": row[0],
            "document_type_id": row[1],
            "document_type_name": row[2],
            "created_at": row[3].isoformat() if row[3] else None,
            "employee_name": _extract_employee_name(row[4]) if row[4] else None,
        }
        for row in docs_result.all()
    ]

    # Recent drafts
    drafts_query = (
        select(
            models.DocumentDraft.id,
            models.DocumentDraft.document_type_id,
            models.DocumentType.name.label('document_type_name'),
            models.DocumentDraft.updated_at,
            models.DocumentDraft.form_data,
            models.DocumentDraft.name,
        )
        .join(models.DocumentType, models.DocumentDraft.document_type_id == models.DocumentType.id)
        .where(models.DocumentDraft.user_id == user_id)
        .order_by(models.DocumentDraft.updated_at.desc())
        .limit(limit)
    )

    drafts_result = await db.execute(drafts_query)
    recent_drafts = [
        {
            "id": row[0],
            "document_type_id": row[1],
            "document_type_name": row[2],
            "updated_at": row[3].isoformat() if row[3] else None,
            "name": row[5] or _extract_employee_name(row[4]),
        }
        for row in drafts_result.all()
    ]

    return {
        "recent_documents": recent_documents,
        "recent_drafts": recent_drafts,
    }


def _extract_employee_name(form_data: dict) -> str:
    """Extract employee name from form data for display."""
    if not form_data:
        return "Unbekannt"

    vorname = form_data.get("mitarbeiter_vorname", "")
    nachname = form_data.get("mitarbeiter_nachname", "")

    if vorname and nachname:
        return f"{nachname}, {vorname}"
    elif nachname:
        return nachname
    elif vorname:
        return vorname

    return "Unbekannt"
