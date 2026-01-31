"""
Fristen-Kalender API (v4.2 Feature: Kapitel 15.2.7)

Tracking von:
- Probezeit-Ende
- Befristungs-Ablauf
- Andere HR-relevante Fristen
"""
from __future__ import annotations
from typing import Any, List, Annotated, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from pydantic import BaseModel

from app.db import get_db
from app.api import deps
from app.models.documents import DocumentDeadline, DeadlineFieldMapping

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════
class DeadlineCreate(BaseModel):
    deadline_type: str
    deadline_date: str  # YYYY-MM-DD
    deadline_label: Optional[str] = None
    employee_name: str
    employee_id: Optional[str] = None
    notes: Optional[str] = None
    generated_document_id: Optional[int] = None


class DeadlineUpdate(BaseModel):
    status: Optional[str] = None  # pending, acknowledged, completed, dismissed
    notes: Optional[str] = None


class DeadlineResponse(BaseModel):
    id: int
    country_code: str
    deadline_type: str
    deadline_date: str
    deadline_label: Optional[str]
    employee_name: str
    employee_id: Optional[str]
    status: str
    notes: Optional[str]
    days_remaining: int
    urgency: str  # overdue, urgent, soon, normal
    created_at: str

    class Config:
        from_attributes = True


class DeadlineSummary(BaseModel):
    """Dashboard-Zusammenfassung der Fristen."""
    overdue_count: int
    this_week_count: int
    this_month_count: int
    upcoming_deadlines: List[DeadlineResponse]


# ══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════
def calculate_deadline_info(deadline: DocumentDeadline) -> dict:
    """Berechnet verbleibende Tage und Dringlichkeit."""
    try:
        deadline_date = datetime.strptime(deadline.deadline_date, "%Y-%m-%d").date()
        today = datetime.utcnow().date()
        days_remaining = (deadline_date - today).days

        if days_remaining < 0:
            urgency = "overdue"
        elif days_remaining <= 7:
            urgency = "urgent"
        elif days_remaining <= 30:
            urgency = "soon"
        else:
            urgency = "normal"

        return {
            "days_remaining": days_remaining,
            "urgency": urgency,
        }
    except Exception:
        return {"days_remaining": 999, "urgency": "normal"}


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/", response_model=List[DeadlineResponse])
async def list_deadlines(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_user)],
    country_code: Optional[str] = None,
    status: Optional[str] = None,
    deadline_type: Optional[str] = None,
    days_ahead: int = Query(90, description="Fristen in den nächsten X Tagen"),
) -> Any:
    """
    Liste aller Fristen mit Filtern.
    """
    today = datetime.utcnow().date()
    max_date = today + timedelta(days=days_ahead)

    query = select(DocumentDeadline).where(
        DocumentDeadline.deadline_date <= max_date.isoformat()
    )

    if country_code:
        query = query.where(DocumentDeadline.country_code == country_code.upper())
    if status:
        query = query.where(DocumentDeadline.status == status)
    if deadline_type:
        query = query.where(DocumentDeadline.deadline_type == deadline_type)

    # Sortierung: Überfällige zuerst, dann nach Datum
    query = query.order_by(DocumentDeadline.deadline_date.asc())

    result = await db.execute(query)
    deadlines = result.scalars().all()

    # Anreichern mit berechneten Feldern
    response = []
    for d in deadlines:
        info = calculate_deadline_info(d)
        response.append(DeadlineResponse(
            id=d.id,
            country_code=d.country_code,
            deadline_type=d.deadline_type,
            deadline_date=d.deadline_date,
            deadline_label=d.deadline_label,
            employee_name=d.employee_name,
            employee_id=d.employee_id,
            status=d.status,
            notes=d.notes,
            days_remaining=info["days_remaining"],
            urgency=info["urgency"],
            created_at=d.created_at,
        ))

    return response


@router.get("/summary", response_model=DeadlineSummary)
async def get_deadline_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_user)],
    country_code: Optional[str] = None,
) -> Any:
    """
    Dashboard-Zusammenfassung der Fristen.
    """
    today = datetime.utcnow().date()
    week_end = today + timedelta(days=7)
    month_end = today + timedelta(days=30)

    base_query = select(DocumentDeadline).where(
        DocumentDeadline.status.in_(["pending", "acknowledged"])
    )
    if country_code:
        base_query = base_query.where(DocumentDeadline.country_code == country_code.upper())

    # Überfällige
    overdue_query = base_query.where(DocumentDeadline.deadline_date < today.isoformat())
    overdue_result = await db.execute(overdue_query)
    overdue_count = len(overdue_result.scalars().all())

    # Diese Woche
    week_query = base_query.where(
        and_(
            DocumentDeadline.deadline_date >= today.isoformat(),
            DocumentDeadline.deadline_date <= week_end.isoformat()
        )
    )
    week_result = await db.execute(week_query)
    this_week_count = len(week_result.scalars().all())

    # Dieser Monat (ohne diese Woche)
    month_query = base_query.where(
        and_(
            DocumentDeadline.deadline_date > week_end.isoformat(),
            DocumentDeadline.deadline_date <= month_end.isoformat()
        )
    )
    month_result = await db.execute(month_query)
    this_month_count = len(month_result.scalars().all())

    # Top 5 anstehende Fristen
    upcoming_query = base_query.where(
        DocumentDeadline.deadline_date >= today.isoformat()
    ).order_by(DocumentDeadline.deadline_date.asc()).limit(5)
    upcoming_result = await db.execute(upcoming_query)
    upcoming_deadlines = []

    for d in upcoming_result.scalars().all():
        info = calculate_deadline_info(d)
        upcoming_deadlines.append(DeadlineResponse(
            id=d.id,
            country_code=d.country_code,
            deadline_type=d.deadline_type,
            deadline_date=d.deadline_date,
            deadline_label=d.deadline_label,
            employee_name=d.employee_name,
            employee_id=d.employee_id,
            status=d.status,
            notes=d.notes,
            days_remaining=info["days_remaining"],
            urgency=info["urgency"],
            created_at=d.created_at,
        ))

    return DeadlineSummary(
        overdue_count=overdue_count,
        this_week_count=this_week_count,
        this_month_count=this_month_count,
        upcoming_deadlines=upcoming_deadlines,
    )


@router.post("/", response_model=DeadlineResponse)
async def create_deadline(
    deadline_in: DeadlineCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_user)],
    country_code: str = "DE",
) -> Any:
    """
    Neue Frist erstellen.
    """
    deadline = DocumentDeadline(
        country_code=country_code.upper(),
        deadline_type=deadline_in.deadline_type,
        deadline_date=deadline_in.deadline_date,
        deadline_label=deadline_in.deadline_label or f"{deadline_in.deadline_type} - {deadline_in.employee_name}",
        employee_name=deadline_in.employee_name,
        employee_id=deadline_in.employee_id,
        notes=deadline_in.notes,
        generated_document_id=deadline_in.generated_document_id,
        status="pending",
        created_at=datetime.utcnow().isoformat(),
        created_by=getattr(current_user, "full_name", "System"),
    )

    db.add(deadline)
    await db.commit()
    await db.refresh(deadline)

    info = calculate_deadline_info(deadline)
    return DeadlineResponse(
        id=deadline.id,
        country_code=deadline.country_code,
        deadline_type=deadline.deadline_type,
        deadline_date=deadline.deadline_date,
        deadline_label=deadline.deadline_label,
        employee_name=deadline.employee_name,
        employee_id=deadline.employee_id,
        status=deadline.status,
        notes=deadline.notes,
        days_remaining=info["days_remaining"],
        urgency=info["urgency"],
        created_at=deadline.created_at,
    )


@router.put("/{deadline_id}", response_model=DeadlineResponse)
async def update_deadline(
    deadline_id: int,
    deadline_in: DeadlineUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_user)],
) -> Any:
    """
    Frist aktualisieren (Status ändern, Notizen hinzufügen).
    """
    deadline = await db.get(DocumentDeadline, deadline_id)
    if not deadline:
        raise HTTPException(status_code=404, detail="Frist nicht gefunden")

    if deadline_in.status:
        deadline.status = deadline_in.status
    if deadline_in.notes is not None:
        deadline.notes = deadline_in.notes

    await db.commit()
    await db.refresh(deadline)

    info = calculate_deadline_info(deadline)
    return DeadlineResponse(
        id=deadline.id,
        country_code=deadline.country_code,
        deadline_type=deadline.deadline_type,
        deadline_date=deadline.deadline_date,
        deadline_label=deadline.deadline_label,
        employee_name=deadline.employee_name,
        employee_id=deadline.employee_id,
        status=deadline.status,
        notes=deadline.notes,
        days_remaining=info["days_remaining"],
        urgency=info["urgency"],
        created_at=deadline.created_at,
    )


@router.delete("/{deadline_id}")
async def delete_deadline(
    deadline_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_active_admin)],
) -> Any:
    """
    Frist löschen (nur Admin).
    """
    deadline = await db.get(DocumentDeadline, deadline_id)
    if not deadline:
        raise HTTPException(status_code=404, detail="Frist nicht gefunden")

    await db.delete(deadline)
    await db.commit()
    return {"message": "Frist gelöscht"}
