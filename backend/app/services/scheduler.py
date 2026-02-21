"""
Background Scheduler — Periodische Lifecycle-Prüfungen

Läuft als asyncio-Task im Hintergrund (kein APScheduler-Dependency nötig,
da Railway als Einzelprozess deployt).

Prüft alle 15 Minuten:
  1. Überfällige Genehmigungen → Erinnerung + Eskalation + E-Mail
  2. Überfällige Rücksendungen → In-App + E-Mail-Benachrichtigung
  3. Fällige Wiedervorlagen → In-App + E-Mail-Benachrichtigung

Jeder Check ist idempotent — doppelte Ausführung erzeugt keine doppelten
Notifications/E-Mails dank DocumentAction-Markierungen.

Starten:  ``asyncio.create_task(start_scheduler())`` in main.py lifespan.
Stoppen:  ``stop_scheduler()`` im Shutdown-Block.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enterprise import (
    DocumentAction,
    DocumentApproval,
    GeneratedDocument,
    Notification,
)
from app.models.core import User

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

CHECK_INTERVAL_SECONDS = 15 * 60  # 15 Minuten
_scheduler_task: asyncio.Task | None = None


# ═══════════════════════════════════════════════════════════════════════════
# SCHEDULER LIFECYCLE
# ═══════════════════════════════════════════════════════════════════════════

async def start_scheduler() -> None:
    """Startet den Background-Scheduler als asyncio-Task."""
    global _scheduler_task
    if _scheduler_task is not None:
        logger.warning("Scheduler läuft bereits")
        return
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    logger.info("Background-Scheduler gestartet (Intervall: %ds)", CHECK_INTERVAL_SECONDS)


def stop_scheduler() -> None:
    """Stoppt den Background-Scheduler."""
    global _scheduler_task
    if _scheduler_task is not None:
        _scheduler_task.cancel()
        _scheduler_task = None
        logger.info("Background-Scheduler gestoppt")


async def _scheduler_loop() -> None:
    """Endlos-Loop mit periodischen Prüfungen."""
    # Initialer Delay (30s) damit App vollständig hochgefahren ist
    await asyncio.sleep(30)

    while True:
        try:
            await _run_all_checks()
        except asyncio.CancelledError:
            logger.info("Scheduler-Loop beendet (CancelledError)")
            return
        except Exception:
            logger.exception("Fehler im Scheduler-Loop")

        try:
            await asyncio.sleep(CHECK_INTERVAL_SECONDS)
        except asyncio.CancelledError:
            logger.info("Scheduler-Sleep unterbrochen — sauberer Stop")
            return


async def _run_all_checks() -> None:
    """Führt alle periodischen Prüfungen durch."""
    from app.db import async_session_factory

    async with async_session_factory() as db:
        stats = {
            "overdue_approvals": 0,
            "overdue_returns": 0,
            "due_reminders": 0,
            "expired_drafts": 0,
        }

        try:
            stats["overdue_approvals"] = await _check_overdue_approvals_with_email(db)
        except Exception:
            logger.exception("Fehler bei Genehmigungsprüfung")

        try:
            stats["overdue_returns"] = await _check_overdue_returns(db)
        except Exception:
            logger.exception("Fehler bei Rücksendungsprüfung")

        try:
            stats["due_reminders"] = await _check_due_reminders(db)
        except Exception:
            logger.exception("Fehler bei Wiedervorlagenprüfung")

        try:
            stats["expired_drafts"] = await _cleanup_expired_drafts(db)
        except Exception:
            logger.exception("Fehler bei Draft-Garbage-Collection")

        await db.commit()

        total = sum(stats.values())
        if total > 0:
            logger.info(
                "Scheduler-Durchlauf: %d Genehmigungs-E-Mails, %d Rücksendungen, %d Wiedervorlagen",
                stats["overdue_approvals"],
                stats["overdue_returns"],
                stats["due_reminders"],
            )


# ═══════════════════════════════════════════════════════════════════════════
# CHECK 1: ÜBERFÄLLIGE GENEHMIGUNGEN + E-MAIL
# ═══════════════════════════════════════════════════════════════════════════

async def _check_overdue_approvals_with_email(db: AsyncSession) -> int:
    """
    Nutzt den bestehenden escalation_service für In-App-Notifications,
    ergänzt um E-Mail-Versand über email_templates.
    """
    from app.services.escalation_service import check_overdue_approvals
    from app.services.email_templates import send_escalation_email

    # Bestehende Eskalationslogik ausführen
    result = await check_overdue_approvals(db)
    emails_sent = 0

    # Zusätzlich E-Mails für alle aktuell überfälligen (noch offenen) Genehmigungen
    now = datetime.now(timezone.utc)
    query = await db.execute(
        select(DocumentApproval).where(
            and_(
                DocumentApproval.status == "pending_approval",
                DocumentApproval.due_date.isnot(None),
                DocumentApproval.due_date < now,
            )
        )
    )
    overdue = query.scalars().all()

    for approval in overdue:
        overdue_days = (now - approval.due_date).days if approval.due_date else 0

        # E-Mail an zugewiesenen Genehmiger (nicht doppelt, nur wenn > 1 Tag überfällig)
        if overdue_days < 1:
            continue

        # Prüfe ob heute schon eine E-Mail-Eskalation gesendet wurde
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        existing = await db.execute(
            select(DocumentAction).where(
                and_(
                    DocumentAction.document_id == approval.document_id,
                    DocumentAction.action_type == "escalation_email_sent",
                    DocumentAction.performed_at >= today_start,
                )
            )
        )
        if existing.scalar_one_or_none():
            continue

        # Genehmiger-E-Mail auflösen
        notify_ids = []
        if approval.approver_id:
            notify_ids = [approval.approver_id]
        elif approval.approval_group_id:
            from app.services.escalation_service import _get_active_group_member_ids
            notify_ids = await _get_active_group_member_ids(db, approval.approval_group_id)

        doc = await db.get(GeneratedDocument, approval.document_id)
        doc_title = doc.title if doc else f"Dokument #{approval.document_id}"

        for uid in notify_ids:
            user = await db.get(User, uid)
            if user and user.email:
                await send_escalation_email(
                    db=db,
                    user_id=uid,
                    user_email=user.email,
                    doc_title=doc_title,
                    doc_id=approval.document_id,
                    overdue_days=overdue_days,
                )
                emails_sent += 1

        # Markierung: E-Mail heute gesendet
        db.add(DocumentAction(
            document_id=approval.document_id,
            action_type="escalation_email_sent",
            note=f"Eskalations-E-Mail gesendet ({overdue_days} Tage überfällig)",
        ))
        await db.flush()

    return emails_sent


# ═══════════════════════════════════════════════════════════════════════════
# CHECK 2: ÜBERFÄLLIGE RÜCKSENDUNGEN
# ═══════════════════════════════════════════════════════════════════════════

async def _check_overdue_returns(db: AsyncSession) -> int:
    """
    Prüft return_pending Actions mit due_date in der Vergangenheit.
    Sendet In-App-Notification + E-Mail an den Dokumentersteller.
    """
    from app.services.email_templates import send_return_overdue_email

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Offene Rücksendungen mit abgelaufenem Fristdatum
    result = await db.execute(
        select(DocumentAction).where(
            and_(
                DocumentAction.action_type == "return_pending",
                DocumentAction.is_completed == False,  # noqa: E712
                DocumentAction.due_date.isnot(None),
                DocumentAction.due_date < now,
            )
        )
    )
    overdue_returns = result.scalars().all()
    notified = 0

    for action in overdue_returns:
        # Prüfe ob heute schon eine Notification gesendet wurde
        existing = await db.execute(
            select(DocumentAction).where(
                and_(
                    DocumentAction.document_id == action.document_id,
                    DocumentAction.action_type == "return_overdue_notified",
                    DocumentAction.performed_at >= today_start,
                )
            )
        )
        if existing.scalar_one_or_none():
            continue

        doc = await db.get(GeneratedDocument, action.document_id)
        if not doc or not doc.created_by_id:
            continue

        user = await db.get(User, doc.created_by_id)
        if not user:
            continue

        doc_title = doc.title or doc.employee_name or f"Dokument #{doc.id}"
        due_str = action.due_date.strftime("%d.%m.%Y") if action.due_date else "unbekannt"

        # In-App-Notification
        db.add(Notification(
            user_id=str(user.id),
            notification_type="return_overdue",
            title=f"Rücksendung überfällig: {doc_title}",
            message=f'Die Rücksendung für "{doc_title}" ist überfällig (Frist: {due_str}).',
            priority="urgent",
            entity_type="document",
            entity_id=doc.id,
            action_url=f"/documents/{doc.id}",
        ))

        # E-Mail
        if user.email:
            await send_return_overdue_email(
                db=db,
                user_id=user.id,
                user_email=user.email,
                doc_title=doc_title,
                doc_id=doc.id,
                due_date_str=due_str,
            )

        # Markierung
        db.add(DocumentAction(
            document_id=action.document_id,
            action_type="return_overdue_notified",
            note=f"Automatische Überfälligkeitsbenachrichtigung (Frist: {due_str})",
        ))
        await db.flush()
        notified += 1

    return notified


# ═══════════════════════════════════════════════════════════════════════════
# CHECK 3: FÄLLIGE WIEDERVORLAGEN
# ═══════════════════════════════════════════════════════════════════════════

async def _check_due_reminders(db: AsyncSession) -> int:
    """
    Prüft reminder_set Actions mit due_date in der Vergangenheit.
    Sendet In-App-Notification + E-Mail an den Dokumentersteller.
    """
    from app.services.email_templates import send_reminder_due_email

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(DocumentAction).where(
            and_(
                DocumentAction.action_type == "reminder_set",
                DocumentAction.is_completed == False,  # noqa: E712
                DocumentAction.due_date.isnot(None),
                DocumentAction.due_date <= now,
            )
        )
    )
    due_reminders = result.scalars().all()
    notified = 0

    for action in due_reminders:
        # Prüfe ob heute schon eine Notification gesendet wurde
        existing = await db.execute(
            select(DocumentAction).where(
                and_(
                    DocumentAction.document_id == action.document_id,
                    DocumentAction.action_type == "reminder_notified",
                    DocumentAction.performed_at >= today_start,
                )
            )
        )
        if existing.scalar_one_or_none():
            continue

        doc = await db.get(GeneratedDocument, action.document_id)
        if not doc or not doc.created_by_id:
            continue

        user = await db.get(User, doc.created_by_id)
        if not user:
            continue

        doc_title = doc.title or doc.employee_name or f"Dokument #{doc.id}"
        due_str = action.due_date.strftime("%d.%m.%Y") if action.due_date else "unbekannt"

        # In-App-Notification
        db.add(Notification(
            user_id=str(user.id),
            notification_type="reminder_due",
            title=f"Wiedervorlage fällig: {doc_title}",
            message=f'Die Wiedervorlage für "{doc_title}" ist fällig (Frist: {due_str}).',
            priority="high",
            entity_type="document",
            entity_id=doc.id,
            action_url=f"/documents/{doc.id}",
        ))

        # E-Mail
        if user.email:
            await send_reminder_due_email(
                db=db,
                user_id=user.id,
                user_email=user.email,
                doc_title=doc_title,
                doc_id=doc.id,
                due_date_str=due_str,
            )

        # Markierung
        db.add(DocumentAction(
            document_id=action.document_id,
            action_type="reminder_notified",
            note=f"Automatische Fälligkeitsbenachrichtigung (Frist: {due_str})",
        ))
        await db.flush()
        notified += 1

    return notified


# ═══════════════════════════════════════════════════════════════════════════
# CHECK 4: DRAFT GARBAGE COLLECTION
# ═══════════════════════════════════════════════════════════════════════════

async def _cleanup_expired_drafts(db: AsyncSession) -> int:
    """
    Löscht abgelaufene und leere Entwürfe:
    1. Drafts älter als 30 Tage (expired TTL)
    2. Leere Drafts (form_data='{}') älter als 24 Stunden
    """
    from app.models.enterprise import DocumentDraft

    now = datetime.now(timezone.utc)
    deleted = 0

    # 1) Expired drafts (>30 days old)
    ttl_cutoff = now - timedelta(days=30)
    expired_result = await db.execute(
        select(DocumentDraft).where(DocumentDraft.created_at < ttl_cutoff)
    )
    expired_drafts = expired_result.scalars().all()
    for draft in expired_drafts:
        await db.delete(draft)
        deleted += 1

    # 2) Empty drafts (form_data='{}') older than 24 hours
    empty_cutoff = now - timedelta(hours=24)
    empty_result = await db.execute(
        select(DocumentDraft).where(
            and_(
                DocumentDraft.created_at < empty_cutoff,
                DocumentDraft.form_data.in_(['{}', '""', '']),
            )
        )
    )
    empty_drafts = empty_result.scalars().all()
    for draft in empty_drafts:
        await db.delete(draft)
        deleted += 1

    if deleted > 0:
        logger.info("Draft-Garbage-Collection: %d Entwürfe gelöscht", deleted)

    return deleted
