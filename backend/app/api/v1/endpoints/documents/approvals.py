"""
Document Approval Workflow API

Genehmigungsworkflow für Dokumente auf Dokumentenebene.

State Machine:
    PENDING_APPROVAL  ->  APPROVED
    PENDING_APPROVAL  ->  CHANGES_REQUESTED  ->  PENDING_APPROVAL (erneut einreichen)
    PENDING_APPROVAL  ->  REJECTED

Ermöglicht:
- Nutzer reicht Dokument aus "Meine Dokumente" zur Genehmigung ein
- Genehmiger erhält Notification
- Bei Ablehnung/Änderungsanforderung wird Dokument wieder editierbar
- Unveränderliches Protokoll über AuditLog
"""
from __future__ import annotations
from typing import Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel, Field

from app.db import get_db
from app.api.deps import get_current_user
from app.models.core import User
from app.models.enterprise import GeneratedDocument, DocumentApproval, Notification, AuditLog
from app.services.event_bus import publish_event

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class RequestApprovalInput(BaseModel):
    """Genehmigung für ein Dokument anfordern."""
    document_id: int
    approver_id: int = Field(..., description="User-ID des Genehmigers")
    priority: str = Field("normal", description="low, normal, high, urgent")
    due_date: Optional[datetime] = None
    comment: Optional[str] = Field(None, description="Optionaler Kommentar an den Genehmiger")


class ApprovalDecisionInput(BaseModel):
    """Entscheidung des Genehmigers."""
    comment: Optional[str] = Field(None, description="Kommentar zur Entscheidung")


class DocumentApprovalResponse(BaseModel):
    id: int
    document_id: int
    status: str
    approver_id: Optional[int] = None
    approver_email: Optional[str] = None
    requested_by_id: Optional[int] = None
    requested_by_email: Optional[str] = None
    requested_at: Optional[datetime] = None
    decided_at: Optional[datetime] = None
    decision_comment: Optional[str] = None
    priority: str = "normal"
    due_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class DocumentApprovalListResponse(BaseModel):
    approvals: List[DocumentApprovalResponse]
    total: int


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

async def _get_approval_or_404(
    approval_id: int,
    db: AsyncSession,
) -> DocumentApproval:
    approval = await db.get(DocumentApproval, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Genehmigungsanfrage nicht gefunden")
    return approval


async def _build_response(
    approval: DocumentApproval,
    db: AsyncSession,
) -> DocumentApprovalResponse:
    """Build response with user emails resolved."""
    approver_email = None
    requested_by_email = None

    if approval.approver_id:
        approver = await db.get(User, approval.approver_id)
        if approver:
            approver_email = approver.email

    if approval.requested_by_id:
        requester = await db.get(User, approval.requested_by_id)
        if requester:
            requested_by_email = requester.email

    return DocumentApprovalResponse(
        id=approval.id,
        document_id=approval.document_id,
        status=approval.status,
        approver_id=approval.approver_id,
        approver_email=approver_email,
        requested_by_id=approval.requested_by_id,
        requested_by_email=requested_by_email,
        requested_at=approval.requested_at,
        decided_at=approval.decided_at,
        decision_comment=approval.decision_comment,
        priority=approval.priority,
        due_date=approval.due_date,
    )


async def _create_audit_entry(
    db: AsyncSession,
    user: User,
    action: str,
    entity_id: int,
    description: str,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
):
    """Create an immutable audit log entry for approval actions."""
    entry = AuditLog(
        user_id=str(user.id),
        user_email=user.email,
        action=action,
        action_category="document",
        entity_type="document_approval",
        entity_id=entity_id,
        description=description,
        old_value=old_value,
        new_value=new_value,
        status="success",
    )
    db.add(entry)


async def _notify_user(
    db: AsyncSession,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    entity_id: int,
    priority: str = "normal",
    action_url: Optional[str] = None,
):
    """Send in-app notification."""
    notification = Notification(
        user_id=str(user_id),
        notification_type=notification_type,
        title=title,
        message=message,
        priority=priority,
        entity_type="document_approval",
        entity_id=entity_id,
        action_url=action_url or f"/documents/{entity_id}/approval",
    )
    db.add(notification)


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/request", response_model=DocumentApprovalResponse, status_code=status.HTTP_201_CREATED)
async def request_approval(
    data: RequestApprovalInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Genehmigung für ein Dokument anfordern.

    Der Ersteller reicht ein Dokument aus "Meine Dokumente" zur Genehmigung ein.
    Der angegebene Genehmiger erhält eine Notification.
    """
    # Validate document exists and user owns it
    doc = await db.get(GeneratedDocument, data.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")

    if doc.created_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Nur der Ersteller kann eine Genehmigung anfordern")

    if doc.is_deleted:
        raise HTTPException(status_code=400, detail="Gelöschte Dokumente können nicht zur Genehmigung eingereicht werden")

    # Check no pending approval already exists for this document
    existing = await db.execute(
        select(DocumentApproval).where(
            and_(
                DocumentApproval.document_id == data.document_id,
                DocumentApproval.status == "pending_approval",
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Es liegt bereits eine ausstehende Genehmigungsanfrage für dieses Dokument vor"
        )

    # Validate approver exists
    approver = await db.get(User, data.approver_id)
    if not approver:
        raise HTTPException(status_code=404, detail="Genehmiger nicht gefunden")

    if not approver.is_active:
        raise HTTPException(status_code=400, detail="Genehmiger ist nicht aktiv")

    # Validate priority
    if data.priority not in ("low", "normal", "high", "urgent"):
        raise HTTPException(status_code=400, detail="Ungültige Priorität")

    # Create approval request
    approval = DocumentApproval(
        document_id=data.document_id,
        status="pending_approval",
        approver_id=data.approver_id,
        requested_by_id=current_user.id,
        priority=data.priority,
        due_date=data.due_date,
        decision_comment=data.comment,
    )
    db.add(approval)
    await db.flush()

    # Notify approver
    doc_title = doc.title or f"Dokument #{doc.id}"
    await _notify_user(
        db=db,
        user_id=data.approver_id,
        notification_type="approval_required",
        title="Genehmigung erforderlich",
        message=f'{current_user.email} bittet um Genehmigung für "{doc_title}".',
        entity_id=approval.id,
        priority=data.priority,
        action_url=f"/documents/{approval.document_id}",
    )

    # Audit log
    await _create_audit_entry(
        db=db,
        user=current_user,
        action="document.approval_requested",
        entity_id=approval.id,
        description=f'Genehmigung angefordert für "{doc_title}" an {approver.email}',
        new_value="pending_approval",
    )

    await db.commit()
    await db.refresh(approval)

    # SSE: Events NACH Commit pushen
    await publish_event(str(data.approver_id), "approval:update", {
        "approval_id": approval.id,
        "document_id": approval.document_id,
        "status": approval.status,
    })
    await publish_event(str(data.approver_id), "notification:new", {
        "notification_type": "approval_required",
        "title": "Genehmigung erforderlich",
        "entity_type": "document_approval",
        "entity_id": approval.id,
    })

    return await _build_response(approval, db)


@router.get("/pending", response_model=DocumentApprovalListResponse)
async def list_pending_approvals(
    role: str = Query("approver", description="'approver' = meine zu genehmigen, 'requester' = meine eingereichten"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Liste der ausstehenden Genehmigungen.

    - role=approver: Dokumente, die ich genehmigen soll
    - role=requester: Dokumente, die ich zur Genehmigung eingereicht habe
    """
    if role == "approver":
        query = select(DocumentApproval).where(
            and_(
                DocumentApproval.approver_id == current_user.id,
                DocumentApproval.status == "pending_approval",
            )
        )
    elif role == "requester":
        query = select(DocumentApproval).where(
            DocumentApproval.requested_by_id == current_user.id,
        )
    elif role == "all":
        # Alle Genehmigungen, bei denen der User beteiligt ist (als Approver oder Requester)
        query = select(DocumentApproval).where(
            (DocumentApproval.approver_id == current_user.id)
            | (DocumentApproval.requested_by_id == current_user.id)
        )
    else:
        raise HTTPException(status_code=400, detail="role muss 'approver', 'requester' oder 'all' sein")

    query = query.order_by(DocumentApproval.requested_at.desc())
    result = await db.execute(query)
    approvals = result.scalars().all()

    responses = []
    for a in approvals:
        responses.append(await _build_response(a, db))

    return DocumentApprovalListResponse(approvals=responses, total=len(responses))


@router.get("/{approval_id}", response_model=DocumentApprovalResponse)
async def get_approval_status(
    approval_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Status einer Genehmigungsanfrage abrufen.
    """
    approval = await _get_approval_or_404(approval_id, db)

    # Access check: requester, approver, or admin
    if (
        approval.requested_by_id != current_user.id
        and approval.approver_id != current_user.id
        and current_user.role != "admin"
    ):
        raise HTTPException(status_code=403, detail="Kein Zugriff auf diese Genehmigungsanfrage")

    return await _build_response(approval, db)


@router.post("/{approval_id}/approve", response_model=DocumentApprovalResponse)
async def approve_document(
    approval_id: int,
    data: ApprovalDecisionInput = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Dokument genehmigen.

    Status: PENDING_APPROVAL -> APPROVED

    Nur der zugewiesene Genehmiger oder Admins können genehmigen.
    """
    approval = await _get_approval_or_404(approval_id, db)

    if approval.approver_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Nur der zugewiesene Genehmiger kann dieses Dokument genehmigen")

    if approval.status != "pending_approval":
        raise HTTPException(
            status_code=400,
            detail=f"Genehmigung nicht möglich (aktueller Status: {approval.status})"
        )

    old_status = approval.status
    approval.status = "approved"
    approval.decided_at = datetime.utcnow()
    if data and data.comment:
        approval.decision_comment = data.comment

    # Notify requester
    await _notify_user(
        db=db,
        user_id=approval.requested_by_id,
        notification_type="document_shared",
        title="Dokument genehmigt",
        message=f"Ihr Dokument wurde von {current_user.email} genehmigt.",
        entity_id=approval.document_id,
        priority="normal",
    )

    # Audit log
    await _create_audit_entry(
        db=db,
        user=current_user,
        action="document.approved",
        entity_id=approval.id,
        description=f"Dokument #{approval.document_id} genehmigt",
        old_value=old_status,
        new_value="approved",
    )

    await db.commit()
    await db.refresh(approval)

    # SSE: Events NACH Commit pushen
    if approval.requested_by_id:
        await publish_event(str(approval.requested_by_id), "approval:update", {
            "approval_id": approval.id, "document_id": approval.document_id, "status": approval.status,
        })
        await publish_event(str(approval.requested_by_id), "notification:new", {
            "notification_type": "document_shared",
            "title": "Dokument genehmigt",
            "entity_type": "document_approval",
            "entity_id": approval.document_id,
        })

    return await _build_response(approval, db)


@router.post("/{approval_id}/request-changes", response_model=DocumentApprovalResponse)
async def request_changes(
    approval_id: int,
    data: ApprovalDecisionInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Änderungen anfordern.

    Status: PENDING_APPROVAL -> CHANGES_REQUESTED

    Das Dokument wird wieder für den Ersteller editierbar (Unlock).
    Der Ersteller kann nach Anpassungen erneut zur Genehmigung einreichen.
    """
    approval = await _get_approval_or_404(approval_id, db)

    if approval.approver_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Nur der zugewiesene Genehmiger kann Änderungen anfordern")

    if approval.status != "pending_approval":
        raise HTTPException(
            status_code=400,
            detail=f"Änderungsanforderung nicht möglich (aktueller Status: {approval.status})"
        )

    if not data or not data.comment:
        raise HTTPException(status_code=400, detail="Ein Kommentar ist erforderlich bei Änderungsanforderungen")

    old_status = approval.status
    approval.status = "changes_requested"
    approval.decided_at = datetime.utcnow()
    approval.decision_comment = data.comment

    # Notify requester that changes are needed
    await _notify_user(
        db=db,
        user_id=approval.requested_by_id,
        notification_type="document_corrected",
        title="Änderungen angefordert",
        message=f'{current_user.email} hat Änderungen angefordert: "{data.comment[:100]}"',
        entity_id=approval.document_id,
        priority="high",
    )

    # Audit log
    await _create_audit_entry(
        db=db,
        user=current_user,
        action="document.changes_requested",
        entity_id=approval.id,
        description=f"Änderungen angefordert für Dokument #{approval.document_id}: {data.comment[:200]}",
        old_value=old_status,
        new_value="changes_requested",
    )

    await db.commit()
    await db.refresh(approval)

    # SSE: Events NACH Commit pushen
    if approval.requested_by_id:
        await publish_event(str(approval.requested_by_id), "approval:update", {
            "approval_id": approval.id, "document_id": approval.document_id, "status": approval.status,
        })
        await publish_event(str(approval.requested_by_id), "notification:new", {
            "notification_type": "document_corrected",
            "title": "Änderungen angefordert",
            "entity_type": "document_approval",
            "entity_id": approval.document_id,
        })

    return await _build_response(approval, db)


@router.post("/{approval_id}/reject", response_model=DocumentApprovalResponse)
async def reject_document(
    approval_id: int,
    data: ApprovalDecisionInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Dokument ablehnen.

    Status: PENDING_APPROVAL -> REJECTED

    Endgültiger Status. Ersteller muss ggf. eine neue Genehmigung anfordern.
    """
    approval = await _get_approval_or_404(approval_id, db)

    if approval.approver_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Nur der zugewiesene Genehmiger kann dieses Dokument ablehnen")

    if approval.status != "pending_approval":
        raise HTTPException(
            status_code=400,
            detail=f"Ablehnung nicht möglich (aktueller Status: {approval.status})"
        )

    if not data or not data.comment:
        raise HTTPException(status_code=400, detail="Ein Kommentar ist erforderlich bei Ablehnung")

    old_status = approval.status
    approval.status = "rejected"
    approval.decided_at = datetime.utcnow()
    approval.decision_comment = data.comment

    # Notify requester about rejection
    await _notify_user(
        db=db,
        user_id=approval.requested_by_id,
        notification_type="document_corrected",
        title="Dokument abgelehnt",
        message=f'{current_user.email} hat das Dokument abgelehnt: "{data.comment[:100]}"',
        entity_id=approval.document_id,
        priority="high",
    )

    # Audit log
    await _create_audit_entry(
        db=db,
        user=current_user,
        action="document.rejected",
        entity_id=approval.id,
        description=f"Dokument #{approval.document_id} abgelehnt: {data.comment[:200]}",
        old_value=old_status,
        new_value="rejected",
    )

    await db.commit()
    await db.refresh(approval)

    # SSE: Events NACH Commit pushen
    if approval.requested_by_id:
        await publish_event(str(approval.requested_by_id), "approval:update", {
            "approval_id": approval.id, "document_id": approval.document_id, "status": approval.status,
        })
        await publish_event(str(approval.requested_by_id), "notification:new", {
            "notification_type": "document_corrected",
            "title": "Dokument abgelehnt",
            "entity_type": "document_approval",
            "entity_id": approval.document_id,
        })

    return await _build_response(approval, db)


@router.post("/{approval_id}/resubmit", response_model=DocumentApprovalResponse)
async def resubmit_for_approval(
    approval_id: int,
    data: ApprovalDecisionInput = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Dokument nach Änderungen erneut zur Genehmigung einreichen.

    Status: CHANGES_REQUESTED -> PENDING_APPROVAL

    Nur der ursprüngliche Ersteller kann erneut einreichen.
    """
    approval = await _get_approval_or_404(approval_id, db)

    if approval.requested_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nur der Ersteller kann erneut einreichen")

    if approval.status != "changes_requested":
        raise HTTPException(
            status_code=400,
            detail=f"Erneutes Einreichen nicht möglich (aktueller Status: {approval.status})"
        )

    old_status = approval.status
    approval.status = "pending_approval"
    approval.decided_at = None
    approval.decision_comment = data.comment if data and data.comment else None
    approval.requested_at = datetime.utcnow()

    # Notify approver about resubmission
    await _notify_user(
        db=db,
        user_id=approval.approver_id,
        notification_type="approval_required",
        title="Dokument erneut eingereicht",
        message=f"{current_user.email} hat das Dokument nach Änderungen erneut zur Genehmigung eingereicht.",
        entity_id=approval.id,
        priority=approval.priority,
        action_url=f"/documents/{approval.document_id}",
    )

    # Audit log
    await _create_audit_entry(
        db=db,
        user=current_user,
        action="document.approval_resubmitted",
        entity_id=approval.id,
        description=f"Dokument #{approval.document_id} erneut zur Genehmigung eingereicht",
        old_value=old_status,
        new_value="pending_approval",
    )

    await db.commit()
    await db.refresh(approval)

    # SSE: Events NACH Commit pushen
    if approval.approver_id:
        await publish_event(str(approval.approver_id), "approval:update", {
            "approval_id": approval.id, "document_id": approval.document_id, "status": approval.status,
        })
        await publish_event(str(approval.approver_id), "notification:new", {
            "notification_type": "approval_required",
            "title": "Dokument erneut eingereicht",
            "entity_type": "document_approval",
            "entity_id": approval.id,
        })

    return await _build_response(approval, db)
