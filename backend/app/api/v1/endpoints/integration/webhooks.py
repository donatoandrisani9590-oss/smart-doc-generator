"""
Webhooks API - Event-Benachrichtigungen für externe Systeme

Ermöglicht Integration mit:
- Microsoft Power Automate
- Zapier
- Make (Integromat)
- Custom Systeme

Events:
- document.created - Neues Dokument erstellt
- document.exported - Dokument exportiert (PDF/DOCX)
- deadline.approaching - Frist nähert sich
- deadline.overdue - Frist überschritten
- approval.requested - Freigabe angefordert
- approval.completed - Freigabe erteilt/abgelehnt
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Literal
from datetime import datetime
import httpx
import logging
import hashlib
import hmac
import json

from app.db import get_db
from app.models.enterprise import WebhookSubscription  # Wir erstellen dieses Model
from app.api import deps

router = APIRouter()
logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# WEBHOOK EVENT TYPES
# ══════════════════════════════════════════════════════════════════════════════

WEBHOOK_EVENTS = [
    "document.created",
    "document.exported",
    "document.deleted",
    "deadline.approaching",
    "deadline.overdue",
    "approval.requested",
    "approval.completed",
    "draft.created",
    "draft.updated",
]


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class WebhookSubscriptionCreate(BaseModel):
    """Neue Webhook-Subscription erstellen."""

    url: HttpUrl = Field(..., description="URL die bei Events aufgerufen wird")
    events: List[str] = Field(
        ...,
        description="Liste der Events die abonniert werden",
        example=["document.created", "deadline.approaching"]
    )
    secret: Optional[str] = Field(
        None,
        description="Optionaler Secret für HMAC-Signatur der Payloads"
    )
    description: Optional[str] = Field(
        None,
        description="Beschreibung der Integration",
        example="Power Automate - Neue Verträge an SharePoint"
    )
    is_active: bool = Field(True, description="Webhook aktiv?")

    class Config:
        json_schema_extra = {
            "example": {
                "url": "https://prod-123.westeurope.logic.azure.com/workflows/...",
                "events": ["document.created", "document.exported"],
                "description": "Power Automate - Dokumente archivieren",
                "is_active": True
            }
        }


class WebhookSubscriptionResponse(BaseModel):
    """Response für eine Webhook-Subscription."""

    id: int
    url: str
    events: List[str]
    description: Optional[str]
    is_active: bool
    created_at: datetime
    last_triggered_at: Optional[datetime]
    trigger_count: int
    last_error: Optional[str]


class WebhookSubscriptionUpdate(BaseModel):
    """Webhook-Subscription aktualisieren."""

    url: Optional[HttpUrl] = None
    events: Optional[List[str]] = None
    secret: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class WebhookTestResponse(BaseModel):
    """Response für Webhook-Test."""

    success: bool
    status_code: Optional[int]
    response_time_ms: float
    message: str


class WebhookEventPayload(BaseModel):
    """Standard Webhook Payload Format."""

    event: str = Field(..., description="Event-Typ")
    timestamp: datetime = Field(..., description="Zeitpunkt des Events")
    data: dict = Field(..., description="Event-spezifische Daten")


# ══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def generate_signature(payload: str, secret: str) -> str:
    """Generiert HMAC-SHA256 Signatur für Webhook Payload."""
    return hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()


async def send_webhook(
    url: str,
    event: str,
    data: dict,
    secret: Optional[str] = None
) -> tuple[bool, int, str]:
    """
    Sendet Webhook-Payload an URL.

    Returns: (success, status_code, error_message)
    """
    payload = WebhookEventPayload(
        event=event,
        timestamp=datetime.utcnow(),
        data=data
    )

    payload_json = payload.model_dump_json()

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "HR-DocGen-Webhook/1.0",
        "X-Webhook-Event": event,
    }

    # HMAC Signatur hinzufügen wenn Secret vorhanden
    if secret:
        signature = generate_signature(payload_json, secret)
        headers["X-Webhook-Signature"] = f"sha256={signature}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                str(url),
                content=payload_json,
                headers=headers
            )

            if response.status_code >= 200 and response.status_code < 300:
                return True, response.status_code, ""
            else:
                return False, response.status_code, f"HTTP {response.status_code}: {response.text[:200]}"

    except httpx.TimeoutException:
        return False, 0, "Timeout nach 10 Sekunden"
    except httpx.RequestError as e:
        return False, 0, f"Request Error: {str(e)}"
    except Exception as e:
        return False, 0, f"Unbekannter Fehler: {str(e)}"


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/events",
    operation_id="listWebhookEvents",
    summary="Verfügbare Webhook-Events auflisten",
    description="Gibt alle Events zurück, die abonniert werden können.",
)
async def list_webhook_events():
    """Listet alle verfügbaren Webhook-Events auf."""
    return {
        "events": [
            {
                "name": "document.created",
                "description": "Wird ausgelöst wenn ein neues Dokument erstellt wurde",
                "payload_example": {
                    "document_id": 123,
                    "document_type": "Arbeitsvertrag Vollzeit",
                    "employee_name": "Max Mustermann",
                    "created_by": "admin@company.com"
                }
            },
            {
                "name": "document.exported",
                "description": "Wird ausgelöst wenn ein Dokument als PDF/DOCX exportiert wurde",
                "payload_example": {
                    "document_id": 123,
                    "format": "pdf",
                    "download_url": "/api/v1/documents/123/download"
                }
            },
            {
                "name": "deadline.approaching",
                "description": "Wird ausgelöst wenn eine Frist in den nächsten 7 Tagen fällig wird",
                "payload_example": {
                    "deadline_id": 456,
                    "deadline_type": "probezeit_ende",
                    "employee_name": "Max Mustermann",
                    "deadline_date": "2024-03-15",
                    "days_remaining": 5
                }
            },
            {
                "name": "deadline.overdue",
                "description": "Wird ausgelöst wenn eine Frist überschritten wurde",
                "payload_example": {
                    "deadline_id": 456,
                    "deadline_type": "befristung_ende",
                    "employee_name": "Max Mustermann",
                    "deadline_date": "2024-03-01",
                    "days_overdue": 3
                }
            },
            {
                "name": "approval.requested",
                "description": "Wird ausgelöst wenn einen Textbaustein zur Freigabe eingereicht wurde",
                "payload_example": {
                    "clause_id": 789,
                    "clause_title": "Homeoffice-Regelung",
                    "requested_by": "hr@company.com",
                    "approval_url": "/admin/clause-approval"
                }
            },
            {
                "name": "approval.completed",
                "description": "Wird ausgelöst wenn eine Freigabe erteilt oder abgelehnt wurde",
                "payload_example": {
                    "clause_id": 789,
                    "clause_title": "Homeoffice-Regelung",
                    "status": "approved",
                    "reviewed_by": "legal@company.com"
                }
            },
        ]
    }


@router.post(
    "/subscribe",
    response_model=WebhookSubscriptionResponse,
    operation_id="createWebhookSubscription",
    summary="Webhook abonnieren",
    description="""
    Erstellt eine neue Webhook-Subscription.

    **Power Automate Integration:**
    1. Erstellen Sie einen HTTP-Trigger in Power Automate
    2. Kopieren Sie die generierte URL
    3. Abonnieren Sie die gewünschten Events

    **Sicherheit:**
    - Optional können Sie ein Secret angeben für HMAC-Signatur
    - Die Signatur wird im Header `X-Webhook-Signature` gesendet
    """,
)
async def create_webhook_subscription(
    subscription: WebhookSubscriptionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Erstellt eine neue Webhook-Subscription."""

    # Validiere Events
    invalid_events = [e for e in subscription.events if e not in WEBHOOK_EVENTS]
    if invalid_events:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ungültige Events: {invalid_events}. Erlaubt: {WEBHOOK_EVENTS}"
        )

    # Erstelle Subscription
    db_subscription = WebhookSubscription(
        url=str(subscription.url),
        events=json.dumps(subscription.events),
        secret=subscription.secret,
        description=subscription.description,
        is_active=subscription.is_active,
    )

    db.add(db_subscription)
    await db.commit()
    await db.refresh(db_subscription)

    return WebhookSubscriptionResponse(
        id=db_subscription.id,
        url=db_subscription.url,
        events=json.loads(db_subscription.events),
        description=db_subscription.description,
        is_active=db_subscription.is_active,
        created_at=db_subscription.created_at,
        last_triggered_at=db_subscription.last_triggered_at,
        trigger_count=db_subscription.trigger_count or 0,
        last_error=db_subscription.last_error,
    )


@router.get(
    "/subscriptions",
    response_model=List[WebhookSubscriptionResponse],
    operation_id="listWebhookSubscriptions",
    summary="Alle Webhook-Subscriptions auflisten",
)
async def list_webhook_subscriptions(
    db: AsyncSession = Depends(get_db),
):
    """Listet alle Webhook-Subscriptions auf."""

    result = await db.execute(
        select(WebhookSubscription).order_by(WebhookSubscription.created_at.desc())
    )
    subscriptions = result.scalars().all()

    return [
        WebhookSubscriptionResponse(
            id=sub.id,
            url=sub.url,
            events=json.loads(sub.events) if sub.events else [],
            description=sub.description,
            is_active=sub.is_active,
            created_at=sub.created_at,
            last_triggered_at=sub.last_triggered_at,
            trigger_count=sub.trigger_count or 0,
            last_error=sub.last_error,
        )
        for sub in subscriptions
    ]


@router.delete(
    "/subscriptions/{subscription_id}",
    operation_id="deleteWebhookSubscription",
    summary="Webhook-Subscription löschen",
)
async def delete_webhook_subscription(
    subscription_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Löscht eine Webhook-Subscription."""

    result = await db.execute(
        select(WebhookSubscription).where(WebhookSubscription.id == subscription_id)
    )
    subscription = result.scalars().first()

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook-Subscription nicht gefunden"
        )

    await db.delete(subscription)
    await db.commit()

    return {"message": "Webhook-Subscription gelöscht", "id": subscription_id}


@router.post(
    "/subscriptions/{subscription_id}/test",
    response_model=WebhookTestResponse,
    operation_id="testWebhookSubscription",
    summary="Webhook-Subscription testen",
    description="Sendet einen Test-Payload an die Webhook-URL.",
)
async def test_webhook_subscription(
    subscription_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Testet eine Webhook-Subscription mit einem Test-Event."""

    result = await db.execute(
        select(WebhookSubscription).where(WebhookSubscription.id == subscription_id)
    )
    subscription = result.scalars().first()

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook-Subscription nicht gefunden"
        )

    import time
    start_time = time.time()

    success, status_code, error = await send_webhook(
        url=subscription.url,
        event="test",
        data={
            "message": "Dies ist ein Test-Event vom HR Document Generator",
            "subscription_id": subscription_id,
            "timestamp": datetime.utcnow().isoformat()
        },
        secret=subscription.secret
    )

    response_time_ms = (time.time() - start_time) * 1000

    if success:
        return WebhookTestResponse(
            success=True,
            status_code=status_code,
            response_time_ms=round(response_time_ms, 2),
            message=f"✅ Webhook erfolgreich getestet (HTTP {status_code})"
        )
    else:
        return WebhookTestResponse(
            success=False,
            status_code=status_code if status_code else None,
            response_time_ms=round(response_time_ms, 2),
            message=f"❌ Webhook-Test fehlgeschlagen: {error}"
        )


# ══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTION - Zum Auslösen von Webhooks aus anderen Modulen
# ══════════════════════════════════════════════════════════════════════════════

async def trigger_webhooks(
    event: str,
    data: dict,
    db: AsyncSession,
    background_tasks: Optional[BackgroundTasks] = None
):
    """
    Löst alle aktiven Webhooks für ein bestimmtes Event aus.

    Verwendung in anderen Endpoints:
    ```python
    from app.api.v1.endpoints.integration.webhooks import trigger_webhooks

    # Nach Dokumenterstellung:
    await trigger_webhooks(
        event="document.created",
        data={"document_id": doc.id, "employee_name": doc.employee_name},
        db=db,
        background_tasks=background_tasks
    )
    ```
    """
    result = await db.execute(
        select(WebhookSubscription).where(
            WebhookSubscription.is_active == True
        )
    )
    subscriptions = result.scalars().all()

    for sub in subscriptions:
        events = json.loads(sub.events) if sub.events else []
        if event in events:
            # Webhook im Hintergrund senden
            if background_tasks:
                background_tasks.add_task(
                    _send_and_update_webhook,
                    subscription_id=sub.id,
                    url=sub.url,
                    event=event,
                    data=data,
                    secret=sub.secret
                )
            else:
                # Direkt senden (blockierend)
                await _send_and_update_webhook(
                    subscription_id=sub.id,
                    url=sub.url,
                    event=event,
                    data=data,
                    secret=sub.secret
                )


async def _send_and_update_webhook(
    subscription_id: int,
    url: str,
    event: str,
    data: dict,
    secret: Optional[str]
):
    """Sendet Webhook und aktualisiert Statistik."""
    from app.db import async_session_factory

    success, status_code, error = await send_webhook(url, event, data, secret)

    # Update subscription stats
    async with async_session_factory() as db:
        result = await db.execute(
            select(WebhookSubscription).where(WebhookSubscription.id == subscription_id)
        )
        subscription = result.scalars().first()
        if subscription:
            subscription.last_triggered_at = datetime.utcnow()
            subscription.trigger_count = (subscription.trigger_count or 0) + 1
            if not success:
                subscription.last_error = error
            else:
                subscription.last_error = None
            await db.commit()

    if not success:
        logger.error(f"Webhook {subscription_id} failed for {event}: {error}")
    else:
        logger.info(f"Webhook {subscription_id} triggered for {event}")
