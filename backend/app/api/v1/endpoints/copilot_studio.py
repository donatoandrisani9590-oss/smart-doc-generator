"""
Copilot Studio Configuration API

Verwaltet die Integration mit Microsoft Copilot Studio und Power Platform.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import secrets
import logging

from app.db import get_db
from app.models.enterprise import CopilotStudioConfig
from app.api import deps

router = APIRouter()
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class CopilotConfigResponse(BaseModel):
    """Response für Copilot Studio Konfiguration."""

    is_enabled: bool
    tenant_id: Optional[str]
    client_id: Optional[str]
    bot_id: Optional[str]
    api_key: Optional[str]  # Nur erste/letzte Zeichen anzeigen
    api_key_created_at: Optional[datetime]
    allow_document_creation: bool
    allow_document_search: bool
    allow_deadline_access: bool
    allowed_document_types: Optional[List[str]]
    request_count: int
    last_request_at: Optional[datetime]


class CopilotConfigUpdate(BaseModel):
    """Update für Copilot Studio Konfiguration."""

    is_enabled: Optional[bool] = None
    tenant_id: Optional[str] = None
    client_id: Optional[str] = None
    bot_id: Optional[str] = None
    allow_document_creation: Optional[bool] = None
    allow_document_search: Optional[bool] = None
    allow_deadline_access: Optional[bool] = None
    allowed_document_types: Optional[List[str]] = None


class ApiKeyResponse(BaseModel):
    """Response nach API-Key Generierung."""

    api_key: str
    created_at: datetime


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/config",
    response_model=CopilotConfigResponse,
    operation_id="getCopilotStudioConfig",
    summary="Copilot Studio Konfiguration abrufen",
)
async def get_config(
    db: AsyncSession = Depends(get_db),
):
    """Gibt die aktuelle Copilot Studio Konfiguration zurück."""

    result = await db.execute(select(CopilotStudioConfig).limit(1))
    config = result.scalars().first()

    if not config:
        # Default-Config erstellen
        config = CopilotStudioConfig(
            is_enabled=False,
            allow_document_creation=True,
            allow_document_search=True,
            allow_deadline_access=True,
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)

    # API Key maskieren (nur erste 4 und letzte 4 Zeichen zeigen)
    masked_api_key = None
    if config.api_key:
        if len(config.api_key) > 8:
            masked_api_key = f"{config.api_key[:4]}...{config.api_key[-4:]}"
        else:
            masked_api_key = "****"

    return CopilotConfigResponse(
        is_enabled=config.is_enabled,
        tenant_id=config.tenant_id,
        client_id=config.client_id,
        bot_id=config.bot_id,
        api_key=masked_api_key,
        api_key_created_at=config.api_key_created_at,
        allow_document_creation=config.allow_document_creation,
        allow_document_search=config.allow_document_search,
        allow_deadline_access=config.allow_deadline_access,
        allowed_document_types=config.allowed_document_types.split(",") if config.allowed_document_types else None,
        request_count=config.request_count or 0,
        last_request_at=config.last_request_at,
    )


@router.put(
    "/config",
    response_model=CopilotConfigResponse,
    operation_id="updateCopilotStudioConfig",
    summary="Copilot Studio Konfiguration aktualisieren",
)
async def update_config(
    update: CopilotConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Aktualisiert die Copilot Studio Konfiguration."""

    result = await db.execute(select(CopilotStudioConfig).limit(1))
    config = result.scalars().first()

    if not config:
        config = CopilotStudioConfig()
        db.add(config)

    # Update Felder
    if update.is_enabled is not None:
        config.is_enabled = update.is_enabled
    if update.tenant_id is not None:
        config.tenant_id = update.tenant_id
    if update.client_id is not None:
        config.client_id = update.client_id
    if update.bot_id is not None:
        config.bot_id = update.bot_id
    if update.allow_document_creation is not None:
        config.allow_document_creation = update.allow_document_creation
    if update.allow_document_search is not None:
        config.allow_document_search = update.allow_document_search
    if update.allow_deadline_access is not None:
        config.allow_deadline_access = update.allow_deadline_access
    if update.allowed_document_types is not None:
        config.allowed_document_types = ",".join(update.allowed_document_types) if update.allowed_document_types else None

    await db.commit()
    await db.refresh(config)

    # Maskierter API Key
    masked_api_key = None
    if config.api_key:
        if len(config.api_key) > 8:
            masked_api_key = f"{config.api_key[:4]}...{config.api_key[-4:]}"
        else:
            masked_api_key = "****"

    return CopilotConfigResponse(
        is_enabled=config.is_enabled,
        tenant_id=config.tenant_id,
        client_id=config.client_id,
        bot_id=config.bot_id,
        api_key=masked_api_key,
        api_key_created_at=config.api_key_created_at,
        allow_document_creation=config.allow_document_creation,
        allow_document_search=config.allow_document_search,
        allow_deadline_access=config.allow_deadline_access,
        allowed_document_types=config.allowed_document_types.split(",") if config.allowed_document_types else None,
        request_count=config.request_count or 0,
        last_request_at=config.last_request_at,
    )


@router.post(
    "/generate-api-key",
    response_model=ApiKeyResponse,
    operation_id="generateCopilotApiKey",
    summary="Neuen API-Schlüssel generieren",
)
async def generate_api_key(
    db: AsyncSession = Depends(get_db),
):
    """
    Generiert einen neuen API-Schlüssel für die Copilot Studio Integration.

    ACHTUNG: Der vollständige Schlüssel wird nur einmal angezeigt!
    """

    result = await db.execute(select(CopilotStudioConfig).limit(1))
    config = result.scalars().first()

    if not config:
        config = CopilotStudioConfig(
            is_enabled=False,
            allow_document_creation=True,
            allow_document_search=True,
            allow_deadline_access=True,
        )
        db.add(config)

    # Neuen API Key generieren (32 Bytes = 64 Hex Zeichen)
    new_api_key = f"docgen_{secrets.token_hex(32)}"
    config.api_key = new_api_key
    config.api_key_created_at = datetime.utcnow()

    await db.commit()

    logger.info("New Copilot Studio API key generated")

    return ApiKeyResponse(
        api_key=new_api_key,
        created_at=config.api_key_created_at,
    )


@router.delete(
    "/api-key",
    operation_id="revokeCopilotApiKey",
    summary="API-Schlüssel widerrufen",
)
async def revoke_api_key(
    db: AsyncSession = Depends(get_db),
):
    """Widerruft den aktuellen API-Schlüssel."""

    result = await db.execute(select(CopilotStudioConfig).limit(1))
    config = result.scalars().first()

    if config and config.api_key:
        config.api_key = None
        config.api_key_created_at = None
        await db.commit()
        logger.info("Copilot Studio API key revoked")
        return {"message": "API-Schlüssel wurde widerrufen"}

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Kein API-Schlüssel vorhanden"
    )
