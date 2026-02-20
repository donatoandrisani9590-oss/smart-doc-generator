"""
Email Templates — Lifecycle-Benachrichtigungen

Erzeugt domänenspezifische E-Mail-Payloads und versendet sie via
Celery (``send_notification_email``) oder direkt per ``send_email_async``.

Jedes Template respektiert ``NotificationPreference.email_enabled`` und
``email_digest``:
  - ``email_enabled=False`` → keine E-Mail
  - ``email_digest="immediate"`` → sofort via Celery-Task
  - ``email_digest="daily"/"weekly"`` → wird vom Digest-Job zusammengefasst
    (nur in-app Notification wird sofort erstellt)

Wenn kein Celery-Broker verfügbar ist (Railway-Einzelprozess), fällt die
Funktion auf ``send_email_async`` (fire-and-forget asyncio.create_task)
zurück.
"""

import asyncio
import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enterprise import NotificationPreference
from app.core.config import settings

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# DISPATCH HELPER
# ═══════════════════════════════════════════════════════════════════════════

def _try_celery_send(
    to_email: str,
    title: str,
    message: str,
    priority: str = "normal",
    action_url: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> bool:
    """
    Versucht den Versand über Celery.  Gibt True zurück wenn der Task
    erfolgreich abgesetzt wurde, False wenn Celery nicht verfügbar ist.
    """
    try:
        from app.tasks.email_tasks import send_notification_email
        send_notification_email.delay(
            to_email=to_email,
            title=title,
            message=message,
            priority=priority,
            action_url=action_url,
            metadata=metadata,
        )
        return True
    except Exception:
        logger.debug("Celery nicht verfügbar, nutze async-Fallback")
        return False


async def _async_fallback_send(
    to_email: str,
    title: str,
    message: str,
    action_url: Optional[str] = None,
) -> None:
    """Async-Fallback wenn Celery nicht verfügbar ist."""
    from app.services.email_service import send_email_async

    plain = f"{title}\n\n{message}"
    if action_url:
        base_url = settings.API_BASE_URL.rstrip("/").replace("/api", "").replace(":8000", ":5173")
        plain += f"\n\nLink: {base_url}{action_url}"

    # Einfaches HTML ohne Jinja2
    html = f"""
    <h2>{title}</h2>
    <p>{message}</p>
    {"<p><a href='" + action_url + "'>Jetzt ansehen</a></p>" if action_url else ""}
    """
    await send_email_async(to_email, title, html, plain)


async def _check_email_preference(
    db: AsyncSession,
    user_id: int,
    notification_type: str,
) -> tuple[bool, Optional[str]]:
    """
    Prüft ob der Benutzer E-Mail-Benachrichtigungen für diesen Typ aktiviert hat.
    Returns (email_enabled, digest_mode).
    """
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == str(user_id),
            NotificationPreference.notification_type == notification_type,
        )
    )
    pref = result.scalar_one_or_none()

    if pref is None:
        # Kein Preference → Standard: E-Mail deaktiviert
        return False, None

    return pref.email_enabled, pref.email_digest


async def send_lifecycle_email(
    db: AsyncSession,
    user_id: int,
    user_email: str,
    notification_type: str,
    title: str,
    message: str,
    priority: str = "normal",
    action_url: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    """
    Zentrale Funktion für Lifecycle-E-Mails.

    Prüft NotificationPreference, wählt Versandweg (Celery vs. async),
    und respektiert Digest-Einstellungen.
    """
    if not settings.mail_enabled:
        return

    email_enabled, digest_mode = await _check_email_preference(
        db, user_id, notification_type,
    )

    if not email_enabled:
        return

    # Digest-Modus: E-Mail wird vom Digest-Scheduler gesammelt, nicht sofort gesendet
    if digest_mode in ("daily", "weekly"):
        logger.debug(
            f"E-Mail für {user_email} ({notification_type}) wird im {digest_mode}-Digest gesammelt"
        )
        return

    # Sofortversand
    sent = _try_celery_send(
        to_email=user_email,
        title=title,
        message=message,
        priority=priority,
        action_url=action_url,
        metadata=metadata,
    )

    if not sent:
        # Fire-and-forget async fallback
        asyncio.create_task(
            _async_fallback_send(user_email, title, message, action_url)
        )


# ═══════════════════════════════════════════════════════════════════════════
# DOMAIN-SPECIFIC TEMPLATES
# ═══════════════════════════════════════════════════════════════════════════


async def send_approval_requested_email(
    db: AsyncSession,
    approver_id: int,
    approver_email: str,
    doc_title: str,
    doc_id: int,
    requester_name: str,
    priority: str = "normal",
) -> None:
    """Template: Genehmigung erforderlich."""
    await send_lifecycle_email(
        db=db,
        user_id=approver_id,
        user_email=approver_email,
        notification_type="approval_required",
        title=f"Genehmigung erforderlich: {doc_title}",
        message=(
            f"{requester_name} bittet um Ihre Freigabe für das Dokument \"{doc_title}\". "
            f"Bitte prüfen Sie das Dokument und treffen Sie eine Entscheidung."
        ),
        priority=priority,
        action_url=f"/documents/{doc_id}?tab=freigabe",
        metadata={
            "Dokument": doc_title,
            "Angefordert von": requester_name,
            "Priorität": {"low": "Niedrig", "normal": "Normal", "high": "Hoch", "urgent": "Dringend"}.get(priority, priority),
        },
    )


async def send_approval_decided_email(
    db: AsyncSession,
    requester_id: int,
    requester_email: str,
    doc_title: str,
    doc_id: int,
    decision: str,  # "approved", "rejected", "changes_requested"
    approver_name: str,
    comment: Optional[str] = None,
) -> None:
    """Template: Dokument genehmigt/abgelehnt/Änderungen angefordert."""
    decision_labels = {
        "approved": ("genehmigt", "normal"),
        "rejected": ("abgelehnt", "high"),
        "changes_requested": ("Änderungen angefordert", "high"),
    }
    label, priority = decision_labels.get(decision, (decision, "normal"))

    message = f'Ihr Dokument "{doc_title}" wurde von {approver_name} {label}.'
    if comment:
        message += f"\n\nKommentar: {comment}"

    await send_lifecycle_email(
        db=db,
        user_id=requester_id,
        user_email=requester_email,
        notification_type="approval_decided",
        title=f"Ihr Dokument wurde {label}: {doc_title}",
        message=message,
        priority=priority,
        action_url=f"/documents/{doc_id}?tab=freigabe",
        metadata={
            "Dokument": doc_title,
            "Entscheidung": label.capitalize(),
            "Entscheider": approver_name,
        },
    )


async def send_reminder_due_email(
    db: AsyncSession,
    user_id: int,
    user_email: str,
    doc_title: str,
    doc_id: int,
    due_date_str: str,
) -> None:
    """Template: Wiedervorlage fällig."""
    await send_lifecycle_email(
        db=db,
        user_id=user_id,
        user_email=user_email,
        notification_type="reminder_due",
        title=f"Wiedervorlage fällig: {doc_title}",
        message=(
            f'Die Wiedervorlage für "{doc_title}" ist fällig (Frist: {due_date_str}). '
            f"Bitte prüfen Sie den Status und nehmen Sie ggf. nötige Aktionen vor."
        ),
        priority="high",
        action_url=f"/documents/{doc_id}?tab=verlauf",
        metadata={
            "Dokument": doc_title,
            "Frist": due_date_str,
        },
    )


async def send_return_overdue_email(
    db: AsyncSession,
    user_id: int,
    user_email: str,
    doc_title: str,
    doc_id: int,
    due_date_str: str,
) -> None:
    """Template: Rücksendung überfällig."""
    await send_lifecycle_email(
        db=db,
        user_id=user_id,
        user_email=user_email,
        notification_type="return_overdue",
        title=f"Rücksendung überfällig: {doc_title} (Frist: {due_date_str})",
        message=(
            f'Die Rücksendung für "{doc_title}" ist überfällig. '
            f"Die Frist war am {due_date_str}. Bitte klären Sie den Status."
        ),
        priority="urgent",
        action_url=f"/documents/{doc_id}?tab=verlauf",
        metadata={
            "Dokument": doc_title,
            "Frist": due_date_str,
            "Status": "Überfällig",
        },
    )


async def send_escalation_email(
    db: AsyncSession,
    user_id: int,
    user_email: str,
    doc_title: str,
    doc_id: int,
    overdue_days: int,
) -> None:
    """Template: Eskalation — Genehmigung stark überfällig."""
    await send_lifecycle_email(
        db=db,
        user_id=user_id,
        user_email=user_email,
        notification_type="escalation",
        title=f"Eskalation: Genehmigung überfällig für {doc_title}",
        message=(
            f'Die Genehmigung für "{doc_title}" ist seit {overdue_days} Tagen überfällig. '
            f"Eine Eskalation wurde eingeleitet. Bitte greifen Sie umgehend ein."
        ),
        priority="urgent",
        action_url=f"/documents/{doc_id}?tab=freigabe",
        metadata={
            "Dokument": doc_title,
            "Überfällig seit": f"{overdue_days} Tagen",
            "Aktion": "Eskalation",
        },
    )
