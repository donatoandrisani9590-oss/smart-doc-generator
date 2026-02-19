"""
Document Lifecycle Actions API — Phase 3

Event-basierter Lebenszyklus für generierte Dokumente.

Jede Statusänderung (Versand, Rücksendung, Genehmigung, Wiedervorlage …) wird
als immutables DocumentAction-Event gespeichert.  Drei denormalisierte Felder
auf GeneratedDocument (workflow_status, has_open_actions, next_due_date) werden
nach jedem Schreibvorgang automatisch neu berechnet — das ermöglicht schnelle
Filterabfragen im Repository ohne JOINs.

Endpunkte:
  POST   /documents/{document_id}/actions         — Aktion anlegen
  GET    /documents/{document_id}/actions          — Aktions-Timeline
  PATCH  /documents/{document_id}/actions/{id}     — Aktion bearbeiten
  GET    /repository/action-summary                — Zähler für Repo-Karten
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, date, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.models.core import User
from app.models.enterprise import GeneratedDocument, DocumentAction

logger = logging.getLogger(__name__)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════

VALID_ACTION_TYPES = frozenset({
    "created",
    "sent",
    "return_pending",
    "returned",
    "approval_requested",
    "approved",
    "rejected",
    "note",
    "completed",
    "reminder_set",
    "reminder_done",
})

# Action types that represent the final lifecycle state
_COMPLETED_ACTIONS = frozenset({"completed", "returned"})

# Action types that indicate active processing
_IN_PROGRESS_ACTIONS = frozenset({
    "sent",
    "return_pending",
    "approval_requested",
    "approved",
    "rejected",
    "reminder_set",
    "reminder_done",
})

# Action types with pending work (reminder open, waiting for return, …)
_OPEN_ACTION_TYPES = frozenset({"reminder_set", "return_pending", "approval_requested"})


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class ActionCreateInput(BaseModel):
    """Neue Aktion für ein Dokument erstellen."""
    action_type: str = Field(
        ...,
        description="Aktionstyp (created, sent, return_pending, returned, "
                    "approval_requested, approved, rejected, note, completed, "
                    "reminder_set, reminder_done)",
    )
    note: Optional[str] = Field(None, max_length=2000, description="Optionaler Kommentar")
    metadata_json: Optional[dict] = Field(
        None,
        description="Zusätzliche Metadaten (z.\u202fB. Versandart, Empfänger)",
    )
    due_date: Optional[datetime] = Field(
        None,
        description="Fälligkeitsdatum (z.\u202fB. für Wiedervorlagen)",
    )

    @field_validator("action_type")
    @classmethod
    def validate_action_type(cls, v: str) -> str:
        v_lower = v.strip().lower()
        if v_lower not in VALID_ACTION_TYPES:
            allowed = ", ".join(sorted(VALID_ACTION_TYPES))
            raise ValueError(
                f"Ungültiger Aktionstyp '{v}'. Erlaubt: {allowed}"
            )
        return v_lower


class ActionUpdateInput(BaseModel):
    """Bestehende Aktion bearbeiten (z.\u202fB. Wiedervorlage erledigen, Notiz ändern)."""
    is_completed: Optional[bool] = None
    note: Optional[str] = Field(None, max_length=2000)
    due_date: Optional[datetime] = None


class ActionResponse(BaseModel):
    id: int
    document_id: int
    action_type: str
    performed_by_id: Optional[int] = None
    performed_by_name: Optional[str] = None
    performed_at: Optional[datetime] = None
    note: Optional[str] = None
    metadata_json: Optional[dict] = None
    due_date: Optional[datetime] = None
    is_completed: bool = False
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ActionTimelineResponse(BaseModel):
    actions: List[ActionResponse]
    total: int


class ActionSummaryResponse(BaseModel):
    """Zähler für die Repository-Filterkarten."""
    ohne_versand: int = Field(0, description="Dokumente im Status 'erstellt' ohne Versand-Aktion")
    ruecksendung_ausstehend: int = Field(0, description="Wartend auf Rücksendung")
    wiedervorlage_faellig: int = Field(0, description="Wiedervorlagen mit erreichtem Fälligkeitsdatum")
    freigabe_offen: int = Field(0, description="Ausstehende Genehmigungsanfragen")
    entwuerfe_ablaufend: int = Field(0, description="Dokumente mit nahendem Aufbewahrungsdatum")


# ═══════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════

async def _get_document_or_404(
    document_id: int,
    db: AsyncSession,
) -> GeneratedDocument:
    """Dokument laden oder 404 werfen."""
    doc = await db.get(GeneratedDocument, document_id)
    if not doc or doc.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokument nicht gefunden",
        )
    return doc


def _serialize_metadata(metadata: Optional[dict]) -> Optional[str]:
    """Dict → JSON-String für die DB-Spalte metadata_json."""
    if metadata is None:
        return None
    return json.dumps(metadata, ensure_ascii=False, default=str)


def _deserialize_metadata(raw: Optional[str]) -> Optional[dict]:
    """JSON-String aus DB → Dict für die API-Response."""
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


def _action_to_response(action: DocumentAction) -> ActionResponse:
    """SQLAlchemy-Modell → Pydantic-Response mit deserialisierten Metadaten."""
    return ActionResponse(
        id=action.id,
        document_id=action.document_id,
        action_type=action.action_type,
        performed_by_id=action.performed_by_id,
        performed_by_name=action.performed_by_name,
        performed_at=action.performed_at,
        note=action.note,
        metadata_json=_deserialize_metadata(action.metadata_json),
        due_date=action.due_date,
        is_completed=action.is_completed or False,
        completed_at=action.completed_at,
    )


async def recalculate_document_lifecycle(
    db: AsyncSession,
    document_id: int,
) -> None:
    """
    Denormalisierte Felder auf GeneratedDocument aktualisieren.

    Berechnet aus allen DocumentAction-Events:
      - workflow_status: erstellt | in_bearbeitung | abgeschlossen
      - has_open_actions: Gibt es offene Wiedervorlagen / ausstehende Rücksendungen?
      - next_due_date: Frühestes offenes Fälligkeitsdatum
    """
    doc = await db.get(GeneratedDocument, document_id)
    if not doc:
        return

    # Alle Aktionen chronologisch laden
    result = await db.execute(
        select(DocumentAction)
        .where(DocumentAction.document_id == document_id)
        .order_by(DocumentAction.performed_at.asc())
    )
    actions = result.scalars().all()

    if not actions:
        doc.workflow_status = "erstellt"
        doc.has_open_actions = False
        doc.next_due_date = None
        await db.flush()
        return

    # --- workflow_status ---
    # Letzte statusrelevante Aktion bestimmt den Gesamtstatus
    latest_action_type = actions[-1].action_type

    if latest_action_type in _COMPLETED_ACTIONS:
        workflow_status = "abgeschlossen"
    elif any(a.action_type in _IN_PROGRESS_ACTIONS for a in actions):
        workflow_status = "in_bearbeitung"
    else:
        workflow_status = "erstellt"

    # --- has_open_actions + next_due_date ---
    has_open = False
    earliest_due: Optional[datetime] = None

    for action in actions:
        if action.action_type in _OPEN_ACTION_TYPES and not action.is_completed:
            has_open = True
            if action.due_date is not None:
                if earliest_due is None or action.due_date < earliest_due:
                    earliest_due = action.due_date

    doc.workflow_status = workflow_status
    doc.has_open_actions = has_open
    doc.next_due_date = earliest_due
    await db.flush()


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post(
    "/documents/{document_id}/actions",
    response_model=ActionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Dokumentaktion anlegen",
)
async def create_document_action(
    document_id: int,
    body: ActionCreateInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Legt eine neue Aktion im Dokumentenlebenszyklus an.

    Erstellt ein immutables Event und aktualisiert die denormalisierten
    Lifecycle-Felder (workflow_status, has_open_actions, next_due_date)
    auf dem Dokument.
    """
    doc = await _get_document_or_404(document_id, db)

    # Ersteller-Name bestimmen (display_name > email)
    performer_name = current_user.display_name or current_user.email

    action = DocumentAction(
        document_id=doc.id,
        action_type=body.action_type,
        performed_by_id=current_user.id,
        performed_by_name=performer_name,
        note=body.note,
        metadata_json=_serialize_metadata(body.metadata_json),
        due_date=body.due_date,
        is_completed=False,
    )
    db.add(action)
    await db.flush()  # ID zuweisen

    # Denormalisierte Felder aktualisieren
    await recalculate_document_lifecycle(db, doc.id)

    await db.commit()
    await db.refresh(action)

    logger.info(
        "Dokumentaktion erstellt: document_id=%d, action_type=%s, user=%s",
        doc.id,
        body.action_type,
        current_user.email,
    )

    return _action_to_response(action)


@router.get(
    "/documents/{document_id}/actions",
    response_model=ActionTimelineResponse,
    summary="Aktions-Timeline abrufen",
)
async def list_document_actions(
    document_id: int,
    limit: int = Query(50, ge=1, le=200, description="Maximale Anzahl Einträge"),
    offset: int = Query(0, ge=0, description="Einträge überspringen"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Gibt die chronologische Aktions-Timeline eines Dokuments zurück
    (neueste zuerst).
    """
    await _get_document_or_404(document_id, db)

    # Gesamtanzahl
    count_result = await db.execute(
        select(func.count(DocumentAction.id))
        .where(DocumentAction.document_id == document_id)
    )
    total = count_result.scalar() or 0

    # Paginierte Ergebnisse (neueste zuerst)
    result = await db.execute(
        select(DocumentAction)
        .where(DocumentAction.document_id == document_id)
        .order_by(DocumentAction.performed_at.desc())
        .limit(limit)
        .offset(offset)
    )
    actions = result.scalars().all()

    return ActionTimelineResponse(
        actions=[_action_to_response(a) for a in actions],
        total=total,
    )


@router.patch(
    "/documents/{document_id}/actions/{action_id}",
    response_model=ActionResponse,
    summary="Dokumentaktion bearbeiten",
)
async def update_document_action(
    document_id: int,
    action_id: int,
    body: ActionUpdateInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bearbeitet eine bestehende Aktion.

    Typische Anwendungsfälle:
    - Wiedervorlage als erledigt markieren
    - Notiz ändern oder ergänzen
    - Fälligkeitsdatum anpassen

    Nur der Ersteller der Aktion oder Admins dürfen bearbeiten.
    """
    await _get_document_or_404(document_id, db)

    action = await db.get(DocumentAction, action_id)
    if not action or action.document_id != document_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aktion nicht gefunden",
        )

    # Berechtigungsprüfung: Nur Ersteller oder Admin
    is_owner = action.performed_by_id == current_user.id
    is_admin = getattr(current_user, "role", "user") == "admin"

    if not is_owner and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nur der Ersteller oder ein Administrator darf diese Aktion bearbeiten",
        )

    # Felder aktualisieren
    if body.is_completed is not None:
        action.is_completed = body.is_completed
        if body.is_completed:
            action.completed_at = datetime.now(timezone.utc)
        else:
            action.completed_at = None

    if body.note is not None:
        action.note = body.note

    if body.due_date is not None:
        action.due_date = body.due_date

    await db.flush()

    # Denormalisierte Felder aktualisieren
    await recalculate_document_lifecycle(db, document_id)

    await db.commit()
    await db.refresh(action)

    logger.info(
        "Dokumentaktion aktualisiert: action_id=%d, document_id=%d, user=%s",
        action_id,
        document_id,
        current_user.email,
    )

    return _action_to_response(action)


@router.get(
    "/repository/action-summary",
    response_model=ActionSummaryResponse,
    summary="Aktions-Zusammenfassung für Repository",
)
async def get_action_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Liefert Zähler für die Repository-Filterkarten.

    Alle Zähler beziehen sich nur auf Dokumente des angemeldeten Benutzers
    (created_by_id), sofern kein Admin. Admins sehen alle Dokumente.
    """
    is_admin = getattr(current_user, "role", "user") == "admin"
    now = datetime.now(timezone.utc)

    # Basis-Filter: nicht gelöschte Dokumente
    base_filters = [GeneratedDocument.is_deleted == False]  # noqa: E712

    if not is_admin:
        base_filters.append(GeneratedDocument.created_by_id == current_user.id)

    # 1) ohne_versand — Status "erstellt" (kein Versand erfolgt)
    ohne_versand_q = await db.execute(
        select(func.count(GeneratedDocument.id)).where(
            and_(
                *base_filters,
                GeneratedDocument.workflow_status == "erstellt",
            )
        )
    )
    ohne_versand = ohne_versand_q.scalar() or 0

    # 2) ruecksendung_ausstehend — offene return_pending Aktionen
    rueck_q = await db.execute(
        select(func.count(func.distinct(DocumentAction.document_id))).where(
            and_(
                DocumentAction.action_type == "return_pending",
                DocumentAction.is_completed == False,  # noqa: E712
                DocumentAction.document_id.in_(
                    select(GeneratedDocument.id).where(and_(*base_filters))
                ),
            )
        )
    )
    ruecksendung_ausstehend = rueck_q.scalar() or 0

    # 3) wiedervorlage_faellig — reminder_set mit due_date <= jetzt, nicht erledigt
    wv_q = await db.execute(
        select(func.count(func.distinct(DocumentAction.document_id))).where(
            and_(
                DocumentAction.action_type == "reminder_set",
                DocumentAction.is_completed == False,  # noqa: E712
                DocumentAction.due_date <= now,
                DocumentAction.document_id.in_(
                    select(GeneratedDocument.id).where(and_(*base_filters))
                ),
            )
        )
    )
    wiedervorlage_faellig = wv_q.scalar() or 0

    # 4) freigabe_offen — offene approval_requested Aktionen
    freigabe_q = await db.execute(
        select(func.count(func.distinct(DocumentAction.document_id))).where(
            and_(
                DocumentAction.action_type == "approval_requested",
                DocumentAction.is_completed == False,  # noqa: E712
                DocumentAction.document_id.in_(
                    select(GeneratedDocument.id).where(and_(*base_filters))
                ),
            )
        )
    )
    freigabe_offen = freigabe_q.scalar() or 0

    # 5) entwuerfe_ablaufend — Dokumente deren retention_date in den nächsten 30 Tagen liegt
    from datetime import timedelta
    threshold = now + timedelta(days=30)
    ablauf_q = await db.execute(
        select(func.count(GeneratedDocument.id)).where(
            and_(
                *base_filters,
                GeneratedDocument.retention_date.isnot(None),
                GeneratedDocument.retention_date <= threshold,
                GeneratedDocument.retention_date > now,
            )
        )
    )
    entwuerfe_ablaufend = ablauf_q.scalar() or 0

    return ActionSummaryResponse(
        ohne_versand=ohne_versand,
        ruecksendung_ausstehend=ruecksendung_ausstehend,
        wiedervorlage_faellig=wiedervorlage_faellig,
        freigabe_offen=freigabe_offen,
        entwuerfe_ablaufend=entwuerfe_ablaufend,
    )
