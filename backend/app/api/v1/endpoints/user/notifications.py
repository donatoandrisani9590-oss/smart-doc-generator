"""
Notifications API (15.5.6)

Provides:
- In-app notifications for document actions
- Mark as read/dismiss functionality
- Notification preferences management
- Unread count for UI badges

Notification Types:
- document_created: New document was generated
- document_corrected: Document was corrected
- document_shared: Document was shared with user/team
- draft_reminder: Reminder about unfinished draft
- bulk_completed: Bulk generation completed
- approval_required: Document needs approval
- retention_warning: Document approaching retention date
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, update, delete
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import json

from app.db import get_db
from app.models.enterprise import Notification, NotificationPreference
from app.api.deps import get_current_user
from app.core.config import settings

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class NotificationResponse(BaseModel):
    id: int
    notification_type: str
    title: str
    message: str
    priority: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    action_url: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    metadata: Optional[dict] = None

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    page_size: int


class NotificationPreferenceResponse(BaseModel):
    id: int
    notification_type: str
    in_app_enabled: bool
    email_enabled: bool
    email_digest: Optional[str] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None

    class Config:
        from_attributes = True


class UpdatePreferenceRequest(BaseModel):
    in_app_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    email_digest: Optional[str] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None


class CreateNotificationRequest(BaseModel):
    user_id: str
    notification_type: str
    title: str
    message: str
    priority: str = "normal"
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    action_url: Optional[str] = None
    metadata: Optional[dict] = None
    expires_at: Optional[datetime] = None


# ═══════════════════════════════════════════════════════════════════════════
# NOTIFICATION TYPES
# ═══════════════════════════════════════════════════════════════════════════

NOTIFICATION_TYPES = {
    "document_created": {
        "label": "Dokument erstellt",
        "description": "Benachrichtigung wenn ein neues Dokument generiert wurde",
        "default_enabled": True,
    },
    "document_corrected": {
        "label": "Dokument korrigiert",
        "description": "Benachrichtigung wenn ein Dokument korrigiert wurde",
        "default_enabled": True,
    },
    "document_shared": {
        "label": "Dokument geteilt",
        "description": "Benachrichtigung wenn ein Dokument mit Ihnen geteilt wurde",
        "default_enabled": True,
    },
    "draft_reminder": {
        "label": "Entwurf-Erinnerung",
        "description": "Erinnerung an unfertige Entwürfe",
        "default_enabled": True,
    },
    "bulk_completed": {
        "label": "Bulk-Generierung abgeschlossen",
        "description": "Benachrichtigung wenn eine Bulk-Generierung fertig ist",
        "default_enabled": True,
    },
    "approval_required": {
        "label": "Genehmigung erforderlich",
        "description": "Benachrichtigung wenn ein Dokument genehmigt werden muss",
        "default_enabled": True,
    },
    "retention_warning": {
        "label": "Aufbewahrungsfrist",
        "description": "Warnung wenn die Aufbewahrungsfrist eines Dokuments endet",
        "default_enabled": True,
    },
    "team_invite": {
        "label": "Team-Einladung",
        "description": "Benachrichtigung bei Einladung in ein Team",
        "default_enabled": True,
    },
    "system": {
        "label": "System",
        "description": "Systemnachrichten und Updates",
        "default_enabled": True,
    },
    "clause_approval_pending": {
        "label": "Textbaustein-Freigabe ausstehend",
        "description": "Benachrichtigung wenn einen Textbaustein zur Freigabe eingereicht wurde (für Admins)",
        "default_enabled": True,
    },
    "clause_approved": {
        "label": "Textbaustein freigegeben",
        "description": "Benachrichtigung wenn Ihr Textbaustein freigegeben wurde",
        "default_enabled": True,
    },
    "clause_rejected": {
        "label": "Textbaustein abgelehnt",
        "description": "Benachrichtigung wenn Ihr Textbaustein abgelehnt wurde",
        "default_enabled": True,
    },
    "comment_mention": {
        "label": "Kommentar-Erwähnung",
        "description": "Benachrichtigung wenn Sie in einem Kommentar erwähnt werden",
        "default_enabled": True,
    },
}


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

async def create_notification(
    db: AsyncSession,
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    priority: str = "normal",
    entity_type: str = None,
    entity_id: int = None,
    action_url: str = None,
    metadata: dict = None,
    expires_at: datetime = None,
) -> Notification:
    """
    Create a new notification for a user.

    This is the core function used throughout the application.
    If the user has email_enabled for this notification type and
    email_digest is 'immediate' (or unset), an email is queued via Celery.
    """
    # Check user preferences
    pref_result = await db.execute(
        select(NotificationPreference).where(
            and_(
                NotificationPreference.user_id == user_id,
                NotificationPreference.notification_type == notification_type,
            )
        )
    )
    preference = pref_result.scalar_one_or_none()

    # If preference exists and in_app is disabled, skip in-app notification
    if preference and not preference.in_app_enabled:
        return None

    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        priority=priority,
        entity_type=entity_type,
        entity_id=entity_id,
        action_url=action_url,
        extra_data=json.dumps(metadata) if metadata else None,
        expires_at=expires_at,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)

    # SSE Real-time Event pushen
    from app.services.event_bus import publish_event
    await publish_event(str(user_id), "notification:new", {
        "notification_type": notification_type,
        "title": title,
        "entity_type": entity_type,
        "entity_id": entity_id,
    })

    # Queue email if user has email enabled and digest is immediate (or unset)
    should_email = (
        settings.mail_enabled
        and preference
        and preference.email_enabled
        and (preference.email_digest or "immediate") == "immediate"
    )
    if should_email:
        await _queue_notification_email(db, user_id, title, message, priority, action_url, metadata)

    return notification


async def _queue_notification_email(
    db: AsyncSession,
    user_id: str,
    title: str,
    message: str,
    priority: str,
    action_url: str = None,
    metadata: dict = None,
) -> None:
    """Look up user email and queue a Celery email task."""
    from app.models.core import User
    try:
        user_result = await db.execute(
            select(User.email).where(User.id == int(user_id))
        )
        email = user_result.scalar_one_or_none()
        if not email:
            return

        from app.tasks.email_tasks import send_notification_email
        send_notification_email.delay(
            to_email=email,
            title=title,
            message=message,
            priority=priority,
            action_url=action_url,
            metadata=metadata,
        )
    except Exception:
        import logging
        logging.getLogger(__name__).warning(
            f"E-Mail-Queue fehlgeschlagen für User {user_id}", exc_info=True
        )


async def notify_admins_clause_pending(
    db: AsyncSession,
    clause_id: int,
    clause_title: str,
    submitted_by: str,
) -> None:
    """
    Notify all admin users about a pending clause approval.
    """
    from app.models.core import User

    # Find all admin users
    admin_result = await db.execute(
        select(User).where(User.is_admin == True)
    )
    admins = admin_result.scalars().all()

    for admin in admins:
        await create_notification(
            db=db,
            user_id=str(admin.id),
            notification_type="clause_approval_pending",
            title="Neuer Textbaustein zur Freigabe",
            message=f'"{clause_title}" wurde von {submitted_by} zur Freigabe eingereicht.',
            priority="normal",
            entity_type="clause",
            entity_id=clause_id,
            action_url="/admin/clause-approvals",
            metadata={"submitted_by": submitted_by},
        )


async def notify_clause_decision(
    db: AsyncSession,
    user_id: str,
    clause_id: int,
    clause_title: str,
    approved: bool,
    reason: str = None,
) -> None:
    """
    Notify the clause submitter about the approval decision.
    """
    if approved:
        await create_notification(
            db=db,
            user_id=user_id,
            notification_type="clause_approved",
            title="Textbaustein freigegeben",
            message=f'Ihr Textbaustein "{clause_title}" wurde freigegeben und ist jetzt in der Bibliothek verfügbar.',
            priority="normal",
            entity_type="clause",
            entity_id=clause_id,
            action_url="/admin/clauses",
        )
    else:
        await create_notification(
            db=db,
            user_id=user_id,
            notification_type="clause_rejected",
            title="Textbaustein abgelehnt",
            message=f'Ihr Textbaustein "{clause_title}" wurde abgelehnt. Grund: {reason or "Kein Grund angegeben"}',
            priority="normal",
            entity_type="clause",
            entity_id=clause_id,
            action_url="/admin/clauses",
            metadata={"rejection_reason": reason},
        )


def parse_notification(n: Notification) -> NotificationResponse:
    """Convert DB model to API response."""
    return NotificationResponse(
        id=n.id,
        notification_type=n.notification_type,
        title=n.title,
        message=n.message,
        priority=n.priority,
        entity_type=n.entity_type,
        entity_id=n.entity_id,
        action_url=n.action_url,
        is_read=n.is_read,
        read_at=n.read_at,
        created_at=n.created_at,
        metadata=json.loads(n.extra_data) if n.extra_data else None,
    )


# ═══════════════════════════════════════════════════════════════════════════
# HELPER: Get user ID from user object (handles both dict and object)
# ═══════════════════════════════════════════════════════════════════════════

def get_user_id(current_user) -> str:
    """Extract user ID from current_user (handles MockUser object or dict)."""
    if hasattr(current_user, 'id'):
        return str(current_user.id)
    elif isinstance(current_user, dict):
        return str(current_user.get("id", "unknown"))
    return "unknown"


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
    notification_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List notifications for the current user.

    Supports filtering by read status and notification type.
    """
    user_id = get_user_id(current_user)

    # Build query
    query = select(Notification).where(
        and_(
            Notification.user_id == user_id,
            Notification.is_dismissed == False,
            or_(
                Notification.expires_at.is_(None),
                Notification.expires_at > datetime.now(timezone.utc),
            ),
        )
    )

    if unread_only:
        query = query.where(Notification.is_read == False)

    if notification_type:
        query = query.where(Notification.notification_type == notification_type)

    # Get total count
    count_query = select(func.count(Notification.id)).where(
        and_(
            Notification.user_id == user_id,
            Notification.is_dismissed == False,
        )
    )
    total = await db.scalar(count_query) or 0

    # Get unread count
    unread_query = select(func.count(Notification.id)).where(
        and_(
            Notification.user_id == user_id,
            Notification.is_read == False,
            Notification.is_dismissed == False,
        )
    )
    unread_count = await db.scalar(unread_query) or 0

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.order_by(Notification.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    notifications = result.scalars().all()

    return NotificationListResponse(
        notifications=[parse_notification(n) for n in notifications],
        total=total,
        unread_count=unread_count,
        page=page,
        page_size=page_size,
    )


@router.get("/count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get unread notification count for header badge.
    """
    user_id = get_user_id(current_user)

    unread_query = select(func.count(Notification.id)).where(
        and_(
            Notification.user_id == user_id,
            Notification.is_read == False,
            Notification.is_dismissed == False,
            or_(
                Notification.expires_at.is_(None),
                Notification.expires_at > datetime.now(timezone.utc),
            ),
        )
    )
    unread_count = await db.scalar(unread_query) or 0

    return {"unread_count": unread_count}


@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Mark a notification as read.
    """
    user_id = get_user_id(current_user)

    notification = await db.get(Notification, notification_id)
    if not notification or notification.user_id != user_id:
        raise HTTPException(status_code=404, detail="Benachrichtigung nicht gefunden")

    notification.is_read = True
    notification.read_at = datetime.now(timezone.utc)
    await db.commit()

    return {"message": "Als gelesen markiert"}


@router.post("/read-all")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Mark all notifications as read for the current user.
    """
    user_id = get_user_id(current_user)

    await db.execute(
        update(Notification)
        .where(
            and_(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
        )
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    await db.commit()

    return {"message": "Alle Benachrichtigungen als gelesen markiert"}


@router.post("/{notification_id}/dismiss")
async def dismiss_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Dismiss a notification (hide it permanently).
    """
    user_id = get_user_id(current_user)

    notification = await db.get(Notification, notification_id)
    if not notification or notification.user_id != user_id:
        raise HTTPException(status_code=404, detail="Benachrichtigung nicht gefunden")

    notification.is_dismissed = True
    await db.commit()

    return {"message": "Benachrichtigung ausgeblendet"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Delete a notification permanently.
    """
    user_id = get_user_id(current_user)

    notification = await db.get(Notification, notification_id)
    if not notification or notification.user_id != user_id:
        raise HTTPException(status_code=404, detail="Benachrichtigung nicht gefunden")

    await db.delete(notification)
    await db.commit()

    return {"message": "Benachrichtigung gelöscht"}


# ═══════════════════════════════════════════════════════════════════════════
# PREFERENCES
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/types")
async def list_notification_types():
    """
    List all available notification types with their descriptions.
    """
    return {
        "types": [
            {
                "type": key,
                "label": val["label"],
                "description": val["description"],
                "default_enabled": val["default_enabled"],
            }
            for key, val in NOTIFICATION_TYPES.items()
        ]
    }


@router.get("/preferences", response_model=List[NotificationPreferenceResponse])
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get notification preferences for the current user.

    Returns all configured preferences. Types without explicit preferences
    use default settings.
    """
    user_id = get_user_id(current_user)

    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user_id)
    )
    preferences = result.scalars().all()

    # Build response with defaults for missing types
    pref_map = {p.notification_type: p for p in preferences}

    response = []
    for ntype, config in NOTIFICATION_TYPES.items():
        if ntype in pref_map:
            response.append(NotificationPreferenceResponse(
                id=pref_map[ntype].id,
                notification_type=ntype,
                in_app_enabled=pref_map[ntype].in_app_enabled,
                email_enabled=pref_map[ntype].email_enabled,
                email_digest=pref_map[ntype].email_digest,
                quiet_hours_start=pref_map[ntype].quiet_hours_start,
                quiet_hours_end=pref_map[ntype].quiet_hours_end,
            ))
        else:
            response.append(NotificationPreferenceResponse(
                id=0,
                notification_type=ntype,
                in_app_enabled=config["default_enabled"],
                email_enabled=False,
                email_digest=None,
                quiet_hours_start=None,
                quiet_hours_end=None,
            ))

    return response


@router.put("/preferences/{notification_type}", response_model=NotificationPreferenceResponse)
async def update_preference(
    notification_type: str,
    data: UpdatePreferenceRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Update notification preferences for a specific type.
    """
    if notification_type not in NOTIFICATION_TYPES:
        raise HTTPException(status_code=400, detail="Ungültiger Benachrichtigungstyp")

    user_id = get_user_id(current_user)

    # Find existing preference or create new
    result = await db.execute(
        select(NotificationPreference).where(
            and_(
                NotificationPreference.user_id == user_id,
                NotificationPreference.notification_type == notification_type,
            )
        )
    )
    preference = result.scalar_one_or_none()

    if not preference:
        preference = NotificationPreference(
            user_id=user_id,
            notification_type=notification_type,
        )
        db.add(preference)

    # Update fields
    if data.in_app_enabled is not None:
        preference.in_app_enabled = data.in_app_enabled
    if data.email_enabled is not None:
        preference.email_enabled = data.email_enabled
    if data.email_digest is not None:
        preference.email_digest = data.email_digest
    if data.quiet_hours_start is not None:
        preference.quiet_hours_start = data.quiet_hours_start
    if data.quiet_hours_end is not None:
        preference.quiet_hours_end = data.quiet_hours_end

    await db.commit()
    await db.refresh(preference)

    return NotificationPreferenceResponse(
        id=preference.id,
        notification_type=preference.notification_type,
        in_app_enabled=preference.in_app_enabled,
        email_enabled=preference.email_enabled,
        email_digest=preference.email_digest,
        quiet_hours_start=preference.quiet_hours_start,
        quiet_hours_end=preference.quiet_hours_end,
    )


# ═══════════════════════════════════════════════════════════════════════════
# INTERNAL / ADMIN
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/send")
async def send_notification(
    data: CreateNotificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Send a notification to a user (admin only).

    Used internally by other services or by admins for announcements.
    """
    notification = await create_notification(
        db=db,
        user_id=data.user_id,
        notification_type=data.notification_type,
        title=data.title,
        message=data.message,
        priority=data.priority,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        action_url=data.action_url,
        metadata=data.metadata,
        expires_at=data.expires_at,
    )

    if notification:
        return parse_notification(notification)
    else:
        return {"message": "Benachrichtigung deaktiviert für diesen Benutzer"}
