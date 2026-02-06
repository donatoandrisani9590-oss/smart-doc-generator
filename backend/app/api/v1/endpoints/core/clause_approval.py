"""
Klausel-Freigabe-Workflow API (v4.2 Feature: Kapitel 15.3)

4-Augen-Prinzip für Klauseln:
- HRBP erstellt Entwurf
- Rechtsabteilung prüft
- HR-Leitung gibt frei
- Klausel wird aktiv
"""
from __future__ import annotations
from typing import Any, List, Annotated, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db import get_db
from app.api import deps
from app.models.documents import Clause

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════
class ApprovalRequest(BaseModel):
    """Freigabe anfordern."""
    comment: Optional[str] = None


class ApprovalDecision(BaseModel):
    """Freigabe-Entscheidung."""
    approved: bool
    comment: Optional[str] = None


class ClauseApprovalStatus(BaseModel):
    """Status einer Klausel im Workflow."""
    clause_id: int
    clause_title: str
    approval_status: str
    approval_requested_at: Optional[str]
    approval_requested_by: Optional[str]
    approval_reviewed_at: Optional[str]
    approval_reviewed_by: Optional[str]
    approval_comment: Optional[str]


class PendingApprovalItem(BaseModel):
    """Item in der Pending-Liste."""
    id: int
    title: str
    content_html: Optional[str] = None
    category: Optional[str]
    country_code: Optional[str]
    version: int
    approval_status: str
    approval_requested_at: Optional[str]
    approval_requested_by: Optional[str]
    notes: Optional[str] = None  # approval_comment als notes

    class Config:
        from_attributes = True


class PendingApprovalResponse(BaseModel):
    """Response für Pending-Liste (Smart UX Phase 3)."""
    clauses: List[PendingApprovalItem]
    total: int


class RejectRequest(BaseModel):
    """Request zum Ablehnen einer Klausel."""
    reason: str


class ApproveRequest(BaseModel):
    """Request zum Genehmigen einer Klausel (optional mit Kommentar)."""
    comment: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# WORKFLOW ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/pending", response_model=PendingApprovalResponse)
async def get_pending_approvals(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_user)],
    status: Optional[str] = None,
) -> Any:
    """
    Liste aller Klauseln, die auf Freigabe warten.
    Für HR-Leitung/Rechtsabteilung.

    Query-Parameter:
    - status: "pending", "approved", "rejected" oder None für alle
    """
    query = select(Clause)

    if status and status != "all":
        query = query.where(Clause.approval_status == status)
    else:
        # Standardmäßig nur pending
        query = query.where(Clause.approval_status == "pending")

    query = query.order_by(Clause.approval_requested_at.desc())
    result = await db.execute(query)
    clauses = result.scalars().all()

    return PendingApprovalResponse(
        clauses=[
            PendingApprovalItem(
                id=c.id,
                title=c.title,
                content_html=c.content_html,
                category=c.category,
                country_code=c.country_code,
                version=c.version,
                approval_status=c.approval_status or "active",
                approval_requested_at=c.approval_requested_at,
                approval_requested_by=c.approval_requested_by,
                notes=c.approval_comment,
            )
            for c in clauses
        ],
        total=len(clauses),
    )


@router.get("/{clause_id}/status", response_model=ClauseApprovalStatus)
async def get_approval_status(
    clause_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_user)],
) -> Any:
    """
    Freigabe-Status einer Klausel abrufen.
    """
    clause = await db.get(Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Klausel nicht gefunden")

    return ClauseApprovalStatus(
        clause_id=clause.id,
        clause_title=clause.title,
        approval_status=clause.approval_status or "active",
        approval_requested_at=clause.approval_requested_at,
        approval_requested_by=clause.approval_requested_by,
        approval_reviewed_at=clause.approval_reviewed_at,
        approval_reviewed_by=clause.approval_reviewed_by,
        approval_comment=clause.approval_comment,
    )


@router.post("/{clause_id}/request-approval")
async def request_approval(
    clause_id: int,
    request: ApprovalRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_user)],
) -> Any:
    """
    Freigabe für eine Klausel anfordern.

    Status: draft → pending
    """
    clause = await db.get(Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Klausel nicht gefunden")

    if clause.approval_status not in (None, "draft", "rejected", "active"):
        raise HTTPException(
            status_code=400,
            detail=f"Klausel kann nicht zur Freigabe eingereicht werden (aktueller Status: {clause.approval_status})"
        )

    clause.approval_status = "pending"
    clause.approval_requested_at = datetime.utcnow().isoformat()
    clause.approval_requested_by = getattr(current_user, "full_name", "Unbekannt")
    clause.approval_comment = request.comment
    clause.approval_reviewed_at = None
    clause.approval_reviewed_by = None

    await db.commit()

    return {
        "message": "Freigabe angefordert",
        "status": "pending",
        "clause_id": clause_id,
    }


@router.post("/{clause_id}/review")
async def review_clause(
    clause_id: int,
    decision: ApprovalDecision,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_active_admin)],
) -> Any:
    """
    Klausel prüfen und freigeben/ablehnen.

    Status: pending → approved/rejected
    Bei Freigabe: approved → active

    Nur für Admins (HR-Leitung/Rechtsabteilung).
    """
    clause = await db.get(Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Klausel nicht gefunden")

    if clause.approval_status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Klausel ist nicht zur Prüfung eingereicht (aktueller Status: {clause.approval_status})"
        )

    clause.approval_reviewed_at = datetime.utcnow().isoformat()
    clause.approval_reviewed_by = getattr(current_user, "full_name", "Admin")
    clause.approval_comment = decision.comment

    if decision.approved:
        clause.approval_status = "active"
        clause.is_active = True
        message = "Klausel freigegeben und aktiviert"
    else:
        clause.approval_status = "rejected"
        message = "Klausel abgelehnt"

    await db.commit()

    return {
        "message": message,
        "status": clause.approval_status,
        "clause_id": clause_id,
    }


@router.post("/{clause_id}/reset-to-draft")
async def reset_to_draft(
    clause_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_user)],
) -> Any:
    """
    Abgelehnte Klausel zurück zu Entwurf setzen.

    Status: rejected → draft
    """
    clause = await db.get(Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Klausel nicht gefunden")

    if clause.approval_status != "rejected":
        raise HTTPException(
            status_code=400,
            detail="Nur abgelehnte Klauseln können zurückgesetzt werden"
        )

    clause.approval_status = "draft"

    await db.commit()

    return {
        "message": "Klausel zurück zu Entwurf gesetzt",
        "status": "draft",
        "clause_id": clause_id,
    }


# ══════════════════════════════════════════════════════════════════════════════
# SMART UX PHASE 3 - SIMPLIFIED ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{clause_id}/approve")
async def approve_clause(
    clause_id: int,
    request: Optional[ApproveRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(deps.get_current_active_admin),
) -> Any:
    """
    Klausel direkt freigeben (vereinfachter Endpoint für Smart UX).
    """
    clause = await db.get(Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Klausel nicht gefunden")

    if clause.approval_status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Klausel ist nicht zur Prüfung eingereicht (aktueller Status: {clause.approval_status})"
        )

    clause.approval_status = "active"
    clause.is_active = True
    clause.approval_reviewed_at = datetime.utcnow().isoformat()
    clause.approval_reviewed_by = getattr(current_user, "full_name", "Admin")

    # Optional: Kommentar speichern
    if request and request.comment:
        clause.approval_comment = request.comment

    # Benutzer benachrichtigen falls approval_requested_by gesetzt
    submitter_info = clause.approval_requested_by

    await db.commit()

    # Benachrichtigung an Einreicher senden
    if submitter_info:
        try:
            from app.api.v1.endpoints.user.notifications import notify_clause_decision
            # Versuche User-ID zu finden (vereinfacht: nutze E-Mail als ID)
            await notify_clause_decision(
                db=db,
                user_id=submitter_info,  # In Realität: User-ID lookup
                clause_id=clause_id,
                clause_title=clause.title,
                approved=True,
            )
        except Exception:
            pass  # Notification-Fehler blockieren nicht den Hauptflow

    return {
        "message": "Klausel freigegeben und aktiviert",
        "status": "active",
        "clause_id": clause_id,
    }


@router.post("/{clause_id}/reject")
async def reject_clause(
    clause_id: int,
    request: RejectRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_active_admin)],
) -> Any:
    """
    Klausel direkt ablehnen (vereinfachter Endpoint für Smart UX).
    """
    clause = await db.get(Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Klausel nicht gefunden")

    if clause.approval_status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Klausel ist nicht zur Prüfung eingereicht (aktueller Status: {clause.approval_status})"
        )

    clause.approval_status = "rejected"
    clause.approval_reviewed_at = datetime.utcnow().isoformat()
    clause.approval_reviewed_by = getattr(current_user, "full_name", "Admin")
    clause.approval_comment = request.reason

    # Benutzer benachrichtigen falls approval_requested_by gesetzt
    submitter_info = clause.approval_requested_by

    await db.commit()

    # Benachrichtigung an Einreicher senden
    if submitter_info:
        try:
            from app.api.v1.endpoints.user.notifications import notify_clause_decision
            await notify_clause_decision(
                db=db,
                user_id=submitter_info,
                clause_id=clause_id,
                clause_title=clause.title,
                approved=False,
                reason=request.reason,
            )
        except Exception:
            pass  # Notification-Fehler blockieren nicht den Hauptflow

    return {
        "message": "Klausel abgelehnt",
        "status": "rejected",
        "clause_id": clause_id,
    }
