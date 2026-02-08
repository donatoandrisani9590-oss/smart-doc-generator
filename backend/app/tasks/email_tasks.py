"""
Celery tasks for email notifications.

Tasks:
  - send_notification_email: Send a single notification email immediately
  - send_digest_email: Send a batched digest of unread notifications
"""

import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from app.worker import celery_app
from app.core.config import settings
from app.services.email_service import send_email_sync

logger = logging.getLogger(__name__)

# Jinja2 template environment
_template_dir = Path(__file__).resolve().parent.parent / "templates"
_jinja_env = Environment(
    loader=FileSystemLoader(str(_template_dir)),
    autoescape=True,
)

# Common template context
def _base_context() -> dict:
    return {
        "app_name": settings.PROJECT_NAME,
        "app_url": settings.API_BASE_URL.rstrip("/").replace("/api", "").replace(":8000", ":5173"),
    }


@celery_app.task(
    name="app.tasks.email_tasks.send_notification_email",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_notification_email(
    self,
    to_email: str,
    title: str,
    message: str,
    priority: str = "normal",
    action_url: str = None,
    metadata: dict = None,
):
    """
    Send a single notification email.
    Retries up to 3 times with 60s delay on failure.
    """
    if not settings.mail_enabled:
        logger.debug("E-Mail deaktiviert, Task übersprungen")
        return {"status": "skipped", "reason": "mail_disabled"}

    try:
        template = _jinja_env.get_template("emails/notification.html")
        html = template.render(
            **_base_context(),
            subject=title,
            title=title,
            message=message,
            priority=priority,
            action_url=action_url,
            metadata=metadata,
        )

        plain = f"{title}\n\n{message}"
        if action_url:
            base = _base_context()["app_url"]
            plain += f"\n\nLink: {base}{action_url}"

        success = send_email_sync(to_email, title, html, plain)

        if not success:
            raise RuntimeError("SMTP-Versand fehlgeschlagen")

        return {"status": "sent", "to": to_email}

    except Exception as exc:
        logger.warning(f"E-Mail-Versand fehlgeschlagen (Versuch {self.request.retries + 1}/4): {exc}")
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.tasks.email_tasks.send_digest_email",
    bind=True,
    max_retries=2,
    default_retry_delay=120,
)
def send_digest_email(
    self,
    to_email: str,
    notifications: list[dict],
    digest_type: str = "daily",
):
    """
    Send a digest email with multiple notifications.
    Used for users with email_digest = 'daily' or 'weekly'.
    """
    if not settings.mail_enabled:
        return {"status": "skipped", "reason": "mail_disabled"}

    if not notifications:
        return {"status": "skipped", "reason": "no_notifications"}

    try:
        count = len(notifications)
        digest_title = (
            f"Tägliche Zusammenfassung: {count} neue Benachrichtigung{'en' if count != 1 else ''}"
            if digest_type == "daily"
            else f"Wöchentliche Zusammenfassung: {count} neue Benachrichtigung{'en' if count != 1 else ''}"
        )

        template = _jinja_env.get_template("emails/digest.html")
        html = template.render(
            **_base_context(),
            subject=digest_title,
            digest_title=digest_title,
            notifications=notifications,
        )

        plain_items = "\n".join(
            f"- {n['title']}: {n['message']}" for n in notifications
        )
        plain = f"{digest_title}\n\n{plain_items}"

        success = send_email_sync(to_email, digest_title, html, plain)

        if not success:
            raise RuntimeError("SMTP-Versand fehlgeschlagen")

        return {"status": "sent", "to": to_email, "count": count}

    except Exception as exc:
        logger.warning(f"Digest-Versand fehlgeschlagen: {exc}")
        raise self.retry(exc=exc)
