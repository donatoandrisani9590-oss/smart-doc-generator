"""
Escalation Service — Automatische Eskalation überfälliger Genehmigungen.

Prüft in regelmäßigen Abständen (via Scheduler oder manuellen Aufruf):
1. Genehmigung nicht innerhalb due_date beantwortet → Erinnerung an Genehmiger
2. due_date + 2 Tage ohne Aktion → Benachrichtigung an Gruppenadmin/Vorgesetzten
3. Erzeugt DocumentAction Event "escalated" für Audit-Trail

Designed as a stateless checker — safe to call multiple times.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enterprise import (
    DocumentApproval,
    DocumentAction,
    GeneratedDocument,
    Notification,
)
from app.models.approval_groups import ApprovalGroup, ApprovalGroupMember
from app.models.core import User

logger = logging.getLogger(__name__)

# How many days after due_date we escalate to group admin/supervisor
ESCALATION_GRACE_DAYS = 2


async def check_overdue_approvals(db: AsyncSession) -> dict:
    """
    Prüft alle ausstehenden Genehmigungen auf Überfälligkeit.

    Returns:
        dict mit Zählern: reminders_sent, escalations_sent
    """
    now = datetime.now(timezone.utc)
    stats = {"reminders_sent": 0, "escalations_sent": 0, "errors": 0}

    # Finde alle ausstehenden Genehmigungen mit due_date
    result = await db.execute(
        select(DocumentApproval).where(
            and_(
                DocumentApproval.status == "pending_approval",
                DocumentApproval.due_date.isnot(None),
                DocumentApproval.due_date < now,
            )
        )
    )
    overdue_approvals = result.scalars().all()

    if not overdue_approvals:
        logger.info("Eskalation: Keine überfälligen Genehmigungen gefunden")
        return stats

    for approval in overdue_approvals:
        try:
            await _process_overdue_approval(db, approval, now, stats)
        except Exception as e:
            logger.error(
                "Eskalation fehlgeschlagen für approval_id=%d: %s",
                approval.id,
                str(e),
            )
            stats["errors"] += 1

    await db.commit()
    logger.info(
        "Eskalation abgeschlossen: %d Erinnerungen, %d Eskalationen, %d Fehler",
        stats["reminders_sent"],
        stats["escalations_sent"],
        stats["errors"],
    )
    return stats


async def _process_overdue_approval(
    db: AsyncSession,
    approval: DocumentApproval,
    now: datetime,
    stats: dict,
) -> None:
    """Verarbeitet eine einzelne überfällige Genehmigung."""
    overdue_days = (now - approval.due_date).days if approval.due_date else 0

    # Prüfe ob bereits eine Erinnerung/Eskalation für diese Genehmigung existiert
    existing_actions = await db.execute(
        select(DocumentAction).where(
            and_(
                DocumentAction.document_id == approval.document_id,
                DocumentAction.action_type.in_(["escalated", "reminder_done"]),
            )
        )
    )
    existing = {a.action_type for a in existing_actions.scalars().all()}

    doc = await db.get(GeneratedDocument, approval.document_id)
    doc_title = doc.title if doc else f"Dokument #{approval.document_id}"

    if overdue_days >= ESCALATION_GRACE_DAYS and "escalated" not in existing:
        # ── Stufe 2: Eskalation an Gruppenadmin ──────────────────────
        await _escalate_to_supervisor(db, approval, doc_title, now)
        stats["escalations_sent"] += 1

    elif "reminder_done" not in existing:
        # ── Stufe 1: Erinnerung an den Genehmiger ───────────────────
        await _send_reminder(db, approval, doc_title, now)
        stats["reminders_sent"] += 1


async def _send_reminder(
    db: AsyncSession,
    approval: DocumentApproval,
    doc_title: str,
    now: datetime,
) -> None:
    """Sendet eine Erinnerung an den zugewiesenen Genehmiger."""
    notify_ids: list[int] = []

    if approval.approver_id:
        notify_ids = [approval.approver_id]
    elif approval.approval_group_id:
        notify_ids = await _get_active_group_member_ids(db, approval.approval_group_id)

    for uid in notify_ids:
        notification = Notification(
            user_id=str(uid),
            notification_type="approval_required",
            title="Erinnerung: Genehmigung überfällig",
            message=f'Die Genehmigung für "{doc_title}" ist überfällig. Bitte zeitnah bearbeiten.',
            priority="high",
            entity_type="document_approval",
            entity_id=approval.id,
            action_url=f"/documents/{approval.document_id}",
        )
        db.add(notification)

    # DocumentAction: reminder_done (verhindert doppelte Erinnerung)
    action = DocumentAction(
        document_id=approval.document_id,
        action_type="reminder_done",
        note=f"Automatische Erinnerung: Genehmigung überfällig seit {approval.due_date}",
    )
    db.add(action)
    await db.flush()

    logger.info(
        "Erinnerung gesendet für approval_id=%d an %d Empfänger",
        approval.id,
        len(notify_ids),
    )


async def _escalate_to_supervisor(
    db: AsyncSession,
    approval: DocumentApproval,
    doc_title: str,
    now: datetime,
) -> None:
    """
    Eskaliert an den Gruppenadmin (is_primary=True) oder alle Gruppenmitglieder.

    Bei Einzelperson-Genehmigungen wird an den Ersteller der Anfrage eskaliert.
    """
    notify_ids: list[int] = []

    if approval.approval_group_id:
        # Primäre Gruppenmitglieder (Supervisors) bevorzugt benachrichtigen
        result = await db.execute(
            select(ApprovalGroupMember.user_id).where(
                and_(
                    ApprovalGroupMember.group_id == approval.approval_group_id,
                    ApprovalGroupMember.is_primary.is_(True),
                )
            )
        )
        notify_ids = [row[0] for row in result.all()]

        # Fallback: Alle Gruppenmitglieder wenn kein Primary
        if not notify_ids:
            notify_ids = await _get_active_group_member_ids(
                db, approval.approval_group_id
            )
    else:
        # Einzelperson: Ersteller der Anfrage informieren
        if approval.requested_by_id:
            notify_ids = [approval.requested_by_id]

    overdue_days = (now - approval.due_date).days if approval.due_date else 0

    for uid in notify_ids:
        notification = Notification(
            user_id=str(uid),
            notification_type="approval_required",
            title="Eskalation: Genehmigung stark überfällig",
            message=(
                f'Die Genehmigung für "{doc_title}" ist seit {overdue_days} Tagen '
                f"überfällig. Sofortige Bearbeitung erforderlich."
            ),
            priority="urgent",
            entity_type="document_approval",
            entity_id=approval.id,
            action_url=f"/documents/{approval.document_id}",
        )
        db.add(notification)

    # DocumentAction: escalated (Audit-Trail)
    action = DocumentAction(
        document_id=approval.document_id,
        action_type="escalated",
        note=(
            f"Automatische Eskalation: Genehmigung seit {overdue_days} Tagen überfällig "
            f"(Frist: {approval.due_date})"
        ),
    )
    db.add(action)
    await db.flush()

    logger.info(
        "Eskalation gesendet für approval_id=%d an %d Empfänger (%d Tage überfällig)",
        approval.id,
        len(notify_ids),
        overdue_days,
    )


async def _get_active_group_member_ids(
    db: AsyncSession, group_id: int
) -> list[int]:
    """Alle aktiven Mitglieder-IDs einer Gruppe."""
    result = await db.execute(
        select(ApprovalGroupMember.user_id)
        .join(User, User.id == ApprovalGroupMember.user_id)
        .where(
            and_(
                ApprovalGroupMember.group_id == group_id,
                User.is_active.is_(True),
            )
        )
    )
    return [row[0] for row in result.all()]
