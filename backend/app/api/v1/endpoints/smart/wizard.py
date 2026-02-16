"""
KI-Dokument-Wizard: Geführte Dokumenterstellung durch Chat-Dialog.

Der Wizard führt den Benutzer durch gezielte Fragen zur Erstellung
eines rechtssicheren HR-Dokuments. Er identifiziert den Dokumenttyp,
sammelt relevante Informationen und generiert das Dokument.

Supports both blocking and streaming (SSE) responses.
"""
import asyncio
import json
import logging
import time
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.models.documents import DocumentType
from app.models.core import User
from app.services.llm_service import (
    LLMMessage, LLMConfig, get_llm_service, log_llm_call
)
from app.services.ai_instructions import get_ai_instructions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/smart/wizard", tags=["smart-wizard"])


# ═══════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════

class WizardMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class WizardRequest(BaseModel):
    """Request for wizard chat interaction."""
    messages: List[WizardMessage] = Field(..., description="Bisheriger Chatverlauf")
    country_code: str = Field(default="DE", pattern="^(DE|AT|CH|IT)$")
    document_type_id: Optional[int] = Field(None, description="Bereits gewählter Dokumenttyp")
    form_data: Optional[Dict[str, Any]] = Field(None, description="Bereits gesammelte Formulardaten")


class WizardResponse(BaseModel):
    """Response from wizard chat."""
    message: str
    extracted_data: Dict[str, Any] = {}
    suggested_document_type_id: Optional[int] = None
    suggested_document_type_name: Optional[str] = None
    is_complete: bool = False
    provider: str = "unknown"


# ═══════════════════════════════════════════════════════════════════════════
# SYSTEM PROMPT
# ═══════════════════════════════════════════════════════════════════════════

async def _build_system_prompt(
    db: AsyncSession,
    country_code: str,
    document_types: list[dict],
    document_type_id: Optional[int] = None,
    form_data: Optional[Dict[str, Any]] = None,
) -> str:
    """Build the wizard system prompt with available document types."""
    country_name = "Deutschland" if country_code == "DE" else "Italien" if country_code == "IT" else "Österreich" if country_code == "AT" else "Schweiz"

    # Format available document types
    type_list = "\n".join(
        f"  - ID {dt['id']}: {dt['name']} (Kategorie: {dt.get('category', 'Allgemein')})"
        for dt in document_types
    )

    selected_type = ""
    if document_type_id:
        dt = next((dt for dt in document_types if dt["id"] == document_type_id), None)
        if dt:
            selected_type = f"\nDer Benutzer hat bereits den Dokumenttyp '{dt['name']}' (ID {dt['id']}) gewählt."

    existing_data = ""
    if form_data:
        non_empty = {k: v for k, v in form_data.items() if v and str(v).strip()}
        if non_empty:
            existing_data = "\nBereits bekannte Daten:\n" + "\n".join(
                f"  - {k}: {v}" for k, v in non_empty.items()
            )

    # Load custom AI instructions
    custom_instructions = await get_ai_instructions(db, country_code)

    return f"""Du bist ein erfahrener HR-Rechtsexperte und Assistent für Dokumenterstellung in {country_name}.
Deine Aufgabe: Durch gezielte Fragen alle nötigen Informationen sammeln, um ein rechtssicheres HR-Dokument zu erstellen.

VERFÜGBARE DOKUMENTTYPEN:
{type_list}

REGELN:
1. Stelle EINE klare Frage pro Nachricht
2. Wenn der Dokumenttyp noch nicht klar ist, frage zuerst danach und biete passende Optionen an
3. Sammle schrittweise: Mitarbeiterdaten → Sachverhalt → Datum/Fristen → Besonderheiten
4. Verwende einfache, verständliche Sprache
5. Biete wo möglich Auswahloptionen in Stichpunkten an
6. Wenn alle wichtigen Informationen vorhanden sind, sage dem Benutzer, dass das Dokument erstellt werden kann

DATENEXTRAKTION:
Extrahiere aus jeder Benutzerantwort strukturierte Daten. Antworte IMMER in folgendem JSON-Format:
{{
  "message": "Deine Antwort/nächste Frage an den Benutzer",
  "extracted_data": {{"feldname": "wert"}},
  "suggested_document_type_id": null oder ID-Nummer,
  "suggested_document_type_name": null oder "Name",
  "is_complete": false oder true
}}

FELDNAMEN für extracted_data (verwende diese exakt):
- vorname, nachname: Mitarbeitername
- position: Stellenbezeichnung
- eintrittsdatum: Datum des Arbeitsbeginns
- gehalt: Bruttogehalt
- wochenstunden: Wochenarbeitsstunden
- probezeit: Probezeit (z.B. "6 Monate")
- urlaubstage: Jahresurlaub in Tagen
- kuendigungsfrist: Kündigungsfrist
- sachverhalt: Beschreibung des Sachverhalts (für Abmahnungen, Kündigungen)
- abmahnung_datum: Datum der Abmahnung/des Vorfalls
- signatory_name: Name des Unterzeichners
{selected_type}{existing_data}
{custom_instructions}

WICHTIG: Antworte AUSSCHLIESSLICH mit validem JSON im oben beschriebenen Format. Kein Text außerhalb des JSON."""


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("", response_model=WizardResponse)
async def wizard_chat(
    request: WizardRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Process a wizard chat message and return structured response."""
    if not request.messages:
        raise HTTPException(status_code=422, detail="Mindestens eine Nachricht erforderlich")

    # Load available document types
    result = await db.execute(
        select(DocumentType)
        .where(DocumentType.is_active == True)
        .where(DocumentType.country_code == request.country_code)
        .order_by(DocumentType.name)
    )
    doc_types = [
        {"id": dt.id, "name": dt.name, "category": getattr(dt, "category", None)}
        for dt in result.scalars().all()
    ]

    # Build system prompt
    system_prompt = await _build_system_prompt(
        db, request.country_code, doc_types,
        request.document_type_id, request.form_data,
    )

    # Build LLM messages
    messages = [LLMMessage(role="system", content=system_prompt)]
    for msg in request.messages:
        messages.append(LLMMessage(role=msg.role, content=msg.content))

    # Call LLM
    llm = await get_llm_service()
    _start = time.time()

    try:
        response = await llm.chat(
            messages,
            LLMConfig(temperature=0.4, max_tokens=1024, json_mode=True)
        )
    except Exception as e:
        logger.error(f"Wizard LLM call failed: {e}")
        raise HTTPException(status_code=503, detail="KI-Service nicht verfügbar")

    latency_ms = int((time.time() - _start) * 1000)

    # Log call
    asyncio.create_task(log_llm_call(
        feature="wizard",
        response=response,
        latency_ms=latency_ms,
        user_id=str(current_user.id),
        country_code=request.country_code,
    ))

    # Parse structured response
    try:
        parsed = json.loads(response.content)
        return WizardResponse(
            message=parsed.get("message", response.content),
            extracted_data=parsed.get("extracted_data", {}),
            suggested_document_type_id=parsed.get("suggested_document_type_id"),
            suggested_document_type_name=parsed.get("suggested_document_type_name"),
            is_complete=parsed.get("is_complete", False),
            provider=response.provider,
        )
    except (json.JSONDecodeError, AttributeError):
        # Fallback: return raw text as message
        return WizardResponse(
            message=response.content,
            provider=response.provider,
        )


@router.post("/stream")
async def wizard_chat_stream(
    request: WizardRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream wizard chat response via SSE."""
    if not request.messages:
        raise HTTPException(status_code=422, detail="Mindestens eine Nachricht erforderlich")

    # Load available document types
    result = await db.execute(
        select(DocumentType)
        .where(DocumentType.is_active == True)
        .where(DocumentType.country_code == request.country_code)
        .order_by(DocumentType.name)
    )
    doc_types = [
        {"id": dt.id, "name": dt.name, "category": getattr(dt, "category", None)}
        for dt in result.scalars().all()
    ]

    # Build system prompt
    system_prompt = await _build_system_prompt(
        db, request.country_code, doc_types,
        request.document_type_id, request.form_data,
    )

    # Build LLM messages
    messages = [LLMMessage(role="system", content=system_prompt)]
    for msg in request.messages:
        messages.append(LLMMessage(role=msg.role, content=msg.content))

    llm = await get_llm_service()
    config = LLMConfig(temperature=0.4, max_tokens=1024)

    async def _stream():
        _start = time.time()
        full_text = ""
        provider_name = "unknown"

        try:
            provider_info = await llm.get_provider_info()
            provider_name = provider_info.get("provider", "unknown")

            async for token in llm.chat_stream(messages, config):
                full_text += token
                yield f"data: {json.dumps({'token': token}, ensure_ascii=False)}\n\n"

            # Try to parse structured data from accumulated text
            extracted_data = {}
            suggested_type_id = None
            suggested_type_name = None
            is_complete = False
            display_message = full_text

            try:
                parsed = json.loads(full_text)
                display_message = parsed.get("message", full_text)
                extracted_data = parsed.get("extracted_data", {})
                suggested_type_id = parsed.get("suggested_document_type_id")
                suggested_type_name = parsed.get("suggested_document_type_name")
                is_complete = parsed.get("is_complete", False)
            except (json.JSONDecodeError, AttributeError):
                pass

            latency_ms = int((time.time() - _start) * 1000)

            yield f"data: {json.dumps({'done': True, 'provider': provider_name, 'message': display_message, 'extracted_data': extracted_data, 'suggested_document_type_id': suggested_type_id, 'suggested_document_type_name': suggested_type_name, 'is_complete': is_complete}, ensure_ascii=False)}\n\n"

            asyncio.create_task(log_llm_call(
                feature="wizard",
                response=type("R", (), {"provider": provider_name, "model": "stream", "usage": None, "content": full_text})(),
                latency_ms=latency_ms,
                user_id=str(current_user.id),
                country_code=request.country_code,
            ))

        except Exception as e:
            logger.error(f"Wizard stream error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/document-types")
async def get_wizard_document_types(
    country_code: str = "DE",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get available document types for wizard suggestions."""
    result = await db.execute(
        select(DocumentType)
        .where(DocumentType.is_active == True)
        .where(DocumentType.country_code == country_code)
        .order_by(DocumentType.name)
    )
    return [
        {
            "id": dt.id,
            "name": dt.name,
            "category": getattr(dt, "category", None),
        }
        for dt in result.scalars().all()
    ]
