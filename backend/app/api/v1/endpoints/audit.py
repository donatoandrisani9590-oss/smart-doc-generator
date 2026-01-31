"""
Audit Log API (15.5.5)

Provides:
- Comprehensive activity logging for all HR actions
- Search and filtering capabilities
- Export functionality for compliance
- Statistics and reporting

Audit entries are immutable - they cannot be modified or deleted through the API.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime, timedelta
import json

from app.db import get_db
from app.models.enterprise import AuditLog, AuditLogRetention
from app.api.deps import get_current_user

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class AuditLogEntry(BaseModel):
    id: int
    timestamp: datetime
    user_id: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    action: str
    action_category: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    entity_name: Optional[str] = None
    description: Optional[str] = None
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    country_code: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    items: List[AuditLogEntry]
    total: int
    page: int
    page_size: int
    total_pages: int


class AuditLogStats(BaseModel):
    total_entries: int
    entries_today: int
    entries_this_week: int
    entries_this_month: int
    by_category: dict
    by_action: dict
    by_user: List[dict]
    recent_errors: List[dict]


class CreateAuditLogRequest(BaseModel):
    action: str
    action_category: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    entity_name: Optional[str] = None
    description: Optional[str] = None
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    metadata: Optional[dict] = None
    country_code: Optional[str] = None
    document_type_id: Optional[int] = None
    status: str = "success"
    error_message: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

async def create_audit_entry(
    db: AsyncSession,
    user_id: str,
    action: str,
    action_category: str,
    entity_type: str = None,
    entity_id: int = None,
    entity_name: str = None,
    description: str = None,
    old_value: dict = None,
    new_value: dict = None,
    metadata: dict = None,
    country_code: str = None,
    document_type_id: int = None,
    ip_address: str = None,
    user_email: str = None,
    user_name: str = None,
    session_id: str = None,
    status: str = "success",
    error_message: str = None,
) -> AuditLog:
    """
    Create an audit log entry.

    This is the core function used throughout the application to log actions.
    """
    entry = AuditLog(
        user_id=user_id,
        user_email=user_email,
        user_name=user_name,
        ip_address=ip_address,
        action=action,
        action_category=action_category,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        description=description,
        old_value=json.dumps(old_value) if old_value else None,
        new_value=json.dumps(new_value) if new_value else None,
        metadata=json.dumps(metadata) if metadata else None,
        country_code=country_code,
        document_type_id=document_type_id,
        session_id=session_id,
        status=status,
        error_message=error_message,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


def parse_audit_entry(entry: AuditLog) -> AuditLogEntry:
    """Convert DB model to API response."""
    return AuditLogEntry(
        id=entry.id,
        timestamp=entry.timestamp,
        user_id=entry.user_id,
        user_email=entry.user_email,
        user_name=entry.user_name,
        action=entry.action,
        action_category=entry.action_category,
        entity_type=entry.entity_type,
        entity_id=entry.entity_id,
        entity_name=entry.entity_name,
        description=entry.description,
        old_value=json.loads(entry.old_value) if entry.old_value else None,
        new_value=json.loads(entry.new_value) if entry.new_value else None,
        country_code=entry.country_code,
        status=entry.status,
    )


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action_category: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    country_code: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List audit log entries with filtering and pagination.

    Filters:
    - action_category: Filter by category (document, clause, form_field, user, bulk, system)
    - action: Filter by specific action (document.create, clause.update, etc.)
    - user_id: Filter by user who performed the action
    - entity_type: Filter by entity type
    - entity_id: Filter by specific entity
    - country_code: Filter by country
    - status: Filter by status (success, failure, partial)
    - date_from/date_to: Date range filter
    - search: Full-text search in description and entity_name
    """
    # Build query
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    conditions = []

    if action_category:
        conditions.append(AuditLog.action_category == action_category)

    if action:
        conditions.append(AuditLog.action == action)

    if user_id:
        conditions.append(AuditLog.user_id == user_id)

    if entity_type:
        conditions.append(AuditLog.entity_type == entity_type)

    if entity_id:
        conditions.append(AuditLog.entity_id == entity_id)

    if country_code:
        conditions.append(AuditLog.country_code == country_code)

    if status:
        conditions.append(AuditLog.status == status)

    if date_from:
        conditions.append(AuditLog.timestamp >= date_from)

    if date_to:
        conditions.append(AuditLog.timestamp <= date_to)

    if search:
        search_term = f"%{search}%"
        conditions.append(
            or_(
                AuditLog.description.ilike(search_term),
                AuditLog.entity_name.ilike(search_term),
                AuditLog.user_name.ilike(search_term),
                AuditLog.user_email.ilike(search_term),
            )
        )

    if conditions:
        query = query.where(and_(*conditions))
        count_query = count_query.where(and_(*conditions))

    # Get total count
    total = await db.scalar(count_query)

    # Apply pagination and ordering
    offset = (page - 1) * page_size
    query = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(page_size)

    result = await db.execute(query)
    entries = result.scalars().all()

    return AuditLogListResponse(
        items=[parse_audit_entry(e) for e in entries],
        total=total or 0,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size if total else 0,
    )


@router.get("/stats", response_model=AuditLogStats)
async def get_audit_stats(
    country_code: Optional[str] = None,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get audit log statistics for dashboard and reporting.

    Returns:
    - Total entries
    - Entries by time period (today, week, month)
    - Breakdown by category
    - Breakdown by action
    - Top users by activity
    - Recent errors
    """
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    period_start = today_start - timedelta(days=days)

    base_condition = []
    if country_code:
        base_condition.append(AuditLog.country_code == country_code)

    # Total entries
    total_query = select(func.count(AuditLog.id))
    if base_condition:
        total_query = total_query.where(and_(*base_condition))
    total_entries = await db.scalar(total_query) or 0

    # Entries today
    today_query = select(func.count(AuditLog.id)).where(
        and_(AuditLog.timestamp >= today_start, *base_condition)
    )
    entries_today = await db.scalar(today_query) or 0

    # Entries this week
    week_query = select(func.count(AuditLog.id)).where(
        and_(AuditLog.timestamp >= week_start, *base_condition)
    )
    entries_this_week = await db.scalar(week_query) or 0

    # Entries this month
    month_query = select(func.count(AuditLog.id)).where(
        and_(AuditLog.timestamp >= month_start, *base_condition)
    )
    entries_this_month = await db.scalar(month_query) or 0

    # By category
    category_query = (
        select(AuditLog.action_category, func.count(AuditLog.id))
        .where(and_(AuditLog.timestamp >= period_start, *base_condition))
        .group_by(AuditLog.action_category)
    )
    category_result = await db.execute(category_query)
    by_category = {cat: count for cat, count in category_result.all()}

    # By action (top 10)
    action_query = (
        select(AuditLog.action, func.count(AuditLog.id))
        .where(and_(AuditLog.timestamp >= period_start, *base_condition))
        .group_by(AuditLog.action)
        .order_by(desc(func.count(AuditLog.id)))
        .limit(10)
    )
    action_result = await db.execute(action_query)
    by_action = {action: count for action, count in action_result.all()}

    # By user (top 10)
    user_query = (
        select(AuditLog.user_id, AuditLog.user_name, func.count(AuditLog.id))
        .where(and_(AuditLog.timestamp >= period_start, *base_condition))
        .group_by(AuditLog.user_id, AuditLog.user_name)
        .order_by(desc(func.count(AuditLog.id)))
        .limit(10)
    )
    user_result = await db.execute(user_query)
    by_user = [
        {"user_id": uid, "user_name": uname or uid, "count": count}
        for uid, uname, count in user_result.all()
    ]

    # Recent errors
    error_query = (
        select(AuditLog)
        .where(
            and_(
                AuditLog.status == "failure",
                AuditLog.timestamp >= period_start,
                *base_condition,
            )
        )
        .order_by(desc(AuditLog.timestamp))
        .limit(10)
    )
    error_result = await db.execute(error_query)
    recent_errors = [
        {
            "id": e.id,
            "timestamp": e.timestamp.isoformat(),
            "action": e.action,
            "user_id": e.user_id,
            "error_message": e.error_message,
            "entity_name": e.entity_name,
        }
        for e in error_result.scalars().all()
    ]

    return AuditLogStats(
        total_entries=total_entries,
        entries_today=entries_today,
        entries_this_week=entries_this_week,
        entries_this_month=entries_this_month,
        by_category=by_category,
        by_action=by_action,
        by_user=by_user,
        recent_errors=recent_errors,
    )


@router.get("/actions")
async def list_action_types(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List all distinct action types for filtering UI.
    """
    query = (
        select(AuditLog.action_category, AuditLog.action)
        .distinct()
        .order_by(AuditLog.action_category, AuditLog.action)
    )
    result = await db.execute(query)

    actions_by_category = {}
    for category, action in result.all():
        if category not in actions_by_category:
            actions_by_category[category] = []
        actions_by_category[category].append(action)

    return actions_by_category


@router.get("/entity/{entity_type}/{entity_id}")
async def get_entity_history(
    entity_type: str,
    entity_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get complete audit history for a specific entity.

    Useful for viewing all changes to a document, clause, or form field.
    """
    query = (
        select(AuditLog)
        .where(
            and_(
                AuditLog.entity_type == entity_type,
                AuditLog.entity_id == entity_id,
            )
        )
        .order_by(desc(AuditLog.timestamp))
    )

    count_query = select(func.count(AuditLog.id)).where(
        and_(
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == entity_id,
        )
    )

    total = await db.scalar(count_query) or 0

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    entries = result.scalars().all()

    return {
        "items": [parse_audit_entry(e) for e in entries],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total else 0,
    }


@router.get("/user/{user_id}")
async def get_user_activity(
    user_id: str,
    days: int = Query(30, ge=1, le=365),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get activity history for a specific user.

    Useful for compliance reporting and user activity review.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)

    query = (
        select(AuditLog)
        .where(
            and_(
                AuditLog.user_id == user_id,
                AuditLog.timestamp >= cutoff,
            )
        )
        .order_by(desc(AuditLog.timestamp))
    )

    count_query = select(func.count(AuditLog.id)).where(
        and_(
            AuditLog.user_id == user_id,
            AuditLog.timestamp >= cutoff,
        )
    )

    total = await db.scalar(count_query) or 0

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    entries = result.scalars().all()

    # Summary stats
    summary_query = (
        select(AuditLog.action_category, func.count(AuditLog.id))
        .where(
            and_(
                AuditLog.user_id == user_id,
                AuditLog.timestamp >= cutoff,
            )
        )
        .group_by(AuditLog.action_category)
    )
    summary_result = await db.execute(summary_query)
    by_category = {cat: count for cat, count in summary_result.all()}

    return {
        "user_id": user_id,
        "period_days": days,
        "summary": {
            "total_actions": total,
            "by_category": by_category,
        },
        "items": [parse_audit_entry(e) for e in entries],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total else 0,
    }


@router.post("")
async def create_audit_log(
    request: Request,
    data: CreateAuditLogRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Create a new audit log entry.

    This endpoint is typically called internally by other services,
    but can also be used by admin UIs for custom logging.
    """
    # Get client IP
    client_ip = request.client.host if request.client else None

    # Get user info from current_user
    user_id = current_user.get("sub", "unknown")
    user_email = current_user.get("email")
    user_name = current_user.get("name")

    entry = await create_audit_entry(
        db=db,
        user_id=user_id,
        user_email=user_email,
        user_name=user_name,
        ip_address=client_ip,
        action=data.action,
        action_category=data.action_category,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        entity_name=data.entity_name,
        description=data.description,
        old_value=data.old_value,
        new_value=data.new_value,
        metadata=data.metadata,
        country_code=data.country_code,
        document_type_id=data.document_type_id,
        status=data.status,
        error_message=data.error_message,
    )

    return parse_audit_entry(entry)


@router.get("/export")
async def export_audit_logs(
    format: str = Query("csv", regex="^(csv|json)$"),
    action_category: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    country_code: Optional[str] = None,
    limit: int = Query(10000, ge=1, le=100000),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Export audit logs for compliance reporting.

    Supports CSV and JSON formats.
    Maximum 100,000 entries per export.
    """
    from fastapi.responses import StreamingResponse
    import csv
    import io

    query = select(AuditLog)
    conditions = []

    if action_category:
        conditions.append(AuditLog.action_category == action_category)

    if date_from:
        conditions.append(AuditLog.timestamp >= date_from)

    if date_to:
        conditions.append(AuditLog.timestamp <= date_to)

    if country_code:
        conditions.append(AuditLog.country_code == country_code)

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(desc(AuditLog.timestamp)).limit(limit)

    result = await db.execute(query)
    entries = result.scalars().all()

    # Log the export action
    await create_audit_entry(
        db=db,
        user_id=current_user.get("sub", "unknown"),
        user_email=current_user.get("email"),
        action="audit.export",
        action_category="system",
        description=f"Exported {len(entries)} audit log entries",
        metadata={
            "format": format,
            "filters": {
                "action_category": action_category,
                "date_from": date_from.isoformat() if date_from else None,
                "date_to": date_to.isoformat() if date_to else None,
                "country_code": country_code,
            },
        },
    )

    if format == "json":
        import json

        output = json.dumps(
            [parse_audit_entry(e).dict() for e in entries],
            default=str,
            indent=2,
        )
        return StreamingResponse(
            io.StringIO(output),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=audit_log_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            },
        )
    else:
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")

        # Header
        writer.writerow([
            "ID",
            "Zeitstempel",
            "Benutzer-ID",
            "Benutzer-E-Mail",
            "Benutzer-Name",
            "Aktion",
            "Kategorie",
            "Entität-Typ",
            "Entität-ID",
            "Entität-Name",
            "Beschreibung",
            "Land",
            "Status",
            "Fehlermeldung",
        ])

        # Data
        for e in entries:
            writer.writerow([
                e.id,
                e.timestamp.isoformat() if e.timestamp else "",
                e.user_id,
                e.user_email or "",
                e.user_name or "",
                e.action,
                e.action_category,
                e.entity_type or "",
                e.entity_id or "",
                e.entity_name or "",
                e.description or "",
                e.country_code or "",
                e.status,
                e.error_message or "",
            ])

        output.seek(0)
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=audit_log_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
            },
        )
