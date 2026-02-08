"""
Email Service

Sends transactional emails via SMTP using aiosmtplib.
Provides both async (for direct use) and sync (for Celery tasks) sending.

Configuration via environment variables:
  MAIL_SERVER, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD,
  MAIL_FROM, MAIL_FROM_NAME, MAIL_USE_TLS, MAIL_USE_SSL
"""

import asyncio
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email_async(
    to_email: str,
    subject: str,
    html_body: str,
    plain_body: Optional[str] = None,
) -> bool:
    """
    Send an email asynchronously via SMTP.

    Returns True on success, False on failure.
    """
    if not settings.mail_enabled:
        logger.debug("E-Mail deaktiviert (MAIL_SERVER nicht konfiguriert)")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
    msg["To"] = to_email
    msg["Subject"] = subject

    if plain_body:
        msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.MAIL_SERVER,
            port=settings.MAIL_PORT,
            username=settings.MAIL_USERNAME,
            password=settings.MAIL_PASSWORD,
            use_tls=settings.MAIL_USE_SSL,
            start_tls=settings.MAIL_USE_TLS,
        )
        logger.info(f"E-Mail gesendet an {to_email}: {subject}")
        return True
    except Exception:
        logger.exception(f"E-Mail-Versand fehlgeschlagen an {to_email}")
        return False


def send_email_sync(
    to_email: str,
    subject: str,
    html_body: str,
    plain_body: Optional[str] = None,
) -> bool:
    """
    Synchronous wrapper for Celery tasks.
    Creates a new event loop to run the async send.
    """
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(
            send_email_async(to_email, subject, html_body, plain_body)
        )
    finally:
        loop.close()
