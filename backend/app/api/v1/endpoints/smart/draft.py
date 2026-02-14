"""
Ghostwriter Draft API: Proactive paragraph generation based on form data.

When the user fills in enough form fields (>=3), this endpoint generates
a contextual introduction/summary paragraph for their document.

Supports both blocking and streaming (SSE) responses.
"""
import asyncio
import json
import logging
import time
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.models.documents import DocumentType
from app.services.llm_service import (
    LLMService, LLMMessage, LLMConfig, get_llm_service, log_llm_call
)
from app.services.ai_instructions import get_ai_instructions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/smart/draft", tags=["smart-draft"])


# ═══════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════

class DraftRequest(BaseModel):
    """Request for AI draft generation."""
    document_type_id: int = Field(..., description="ID des Dokumenttyps")
    form_data: Dict[str, Any] = Field(..., description="Aktuelle Formulardaten")
    country_code: str = Field(default="DE", pattern="^(DE|AT|CH|IT)$")


class DraftResponse(BaseModel):
    """Response with generated draft paragraph."""
    draft_html: str
    provider: str
    paragraph_type: str = "introduction"


# ═══════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def _country_name(code: str) -> str:
    """Map country code to German name."""
    return {
        "DE": "Deutschland",
        "AT": "Österreich",
        "CH": "die Schweiz",
        "IT": "Italien (Südtirol)",
    }.get(code, "Deutschland")


def _get_non_empty_fields(form_data: Dict[str, Any]) -> Dict[str, Any]:
    """Filter out empty/None fields from form data."""
    return {
        k: v for k, v in form_data.items()
        if v is not None and str(v).strip() != ""
    }


def _format_fields_for_prompt(fields: Dict[str, Any]) -> str:
    """Format field data as readable bullet points for the LLM prompt."""
    # Map internal field names to German labels
    label_map = {
        "vorname": "Vorname",
        "nachname": "Nachname",
        "position": "Position",
        "gehalt": "Gehalt",
        "eintrittsdatum": "Eintrittsdatum",
        "geburtsdatum": "Geburtsdatum",
        "wochenstunden": "Wochenstunden",
        "urlaubstage": "Urlaubstage",
        "probezeit": "Probezeit",
        "kuendigungsfrist": "Kündigungsfrist",
        "arbeitszeitmodell": "Arbeitszeitmodell",
        "firmenwagen": "Firmenwagen",
        "homeoffice": "Home-Office",
        "befristung": "Befristung",
        "gerichtsstand": "Gerichtsstand",
        "abteilung": "Abteilung",
        "vorgesetzter": "Vorgesetzter",
    }
    lines = []
    for key, value in fields.items():
        label = label_map.get(key, key.replace("_", " ").title())
        lines.append(f"- {label}: {value}")
    return "\n".join(lines)


async def _build_draft_prompt(
    db: AsyncSession,
    request: DraftRequest,
    non_empty_fields: Dict[str, Any],
) -> tuple:
    """Build system and user prompts for draft generation. Returns (system_prompt, user_prompt)."""
    # Load document type name
    result = await db.execute(
        select(DocumentType).where(DocumentType.id == request.document_type_id)
    )
    doc_type = result.scalar_one_or_none()
    if not doc_type:
        raise HTTPException(status_code=404, detail="Dokumenttyp nicht gefunden")

    doc_type_name = doc_type.name

    # Load AI instructions
    custom_instructions = ""
    try:
        custom_instructions = await get_ai_instructions(
            db, request.country_code, request.document_type_id
        )
    except Exception:
        pass  # AI instructions are optional

    fields_text = _format_fields_for_prompt(non_empty_fields)

    system_prompt = f"""Du bist ein erfahrener HR-Experte für {_country_name(request.country_code)}.
Deine Aufgabe ist es, einen professionellen Einleitungsabsatz für ein HR-Dokument zu verfassen.

Regeln:
- Verfasse genau EINEN Einleitungsabsatz mit 3-4 Sätzen.
- Formatiere den Text als HTML (verwende <p>-Tags).
- Schreibe professionell und sachlich, passend für ein offizielles Dokument.
- Verwende die bereitgestellten Daten, um den Absatz zu personalisieren.
- Behalte die Sprache passend zum Land ({_country_name(request.country_code)}).
- Gib NUR den HTML-Absatz zurück, keine Erklärungen oder zusätzlichen Text.
{f"- Berücksichtige folgende Unternehmensrichtlinien: {custom_instructions}" if custom_instructions else ""}"""

    user_prompt = f"""Dokumenttyp: {doc_type_name}

Verfügbare Daten:
{fields_text}

Verfasse einen passenden Einleitungsabsatz für dieses Dokument."""

    return system_prompt, user_prompt


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("", response_model=DraftResponse)
async def generate_draft(
    request: DraftRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Generate a proactive draft paragraph based on form data.

    Requires at least 3 non-empty form fields.
    """
    non_empty = _get_non_empty_fields(request.form_data)
    if len(non_empty) < 3:
        raise HTTPException(
            status_code=422,
            detail="Mindestens 3 ausgefüllte Felder erforderlich für einen KI-Entwurf."
        )

    try:
        llm = await get_llm_service()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=f"KI-Service nicht verfügbar: {str(e)}")

    system_prompt, user_prompt = await _build_draft_prompt(db, request, non_empty)

    try:
        _start = time.time()
        response = await llm.chat(
            messages=[
                LLMMessage(role="system", content=system_prompt),
                LLMMessage(role="user", content=user_prompt),
            ],
            config=LLMConfig(temperature=0.4, max_tokens=500),
        )
        latency_ms = int((time.time() - _start) * 1000)

        asyncio.create_task(log_llm_call(
            feature="draft",
            response=response,
            latency_ms=latency_ms,
            user_id=str(current_user.id),
            country_code=request.country_code,
        ))

        return DraftResponse(
            draft_html=response.content.strip(),
            provider=response.provider,
            paragraph_type="introduction",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"KI-Entwurf fehlgeschlagen: {str(e)}")


@router.post("/stream")
async def generate_draft_stream(
    request: DraftRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Stream a draft paragraph token-by-token via SSE.

    SSE frames:
    - data: {"token": "..."} -- each generated token
    - data: {"done": true, "provider": "..."} -- final frame
    - data: {"error": "..."} -- on failure
    """
    non_empty = _get_non_empty_fields(request.form_data)
    if len(non_empty) < 3:
        raise HTTPException(
            status_code=422,
            detail="Mindestens 3 ausgefüllte Felder erforderlich für einen KI-Entwurf."
        )

    try:
        llm = await get_llm_service()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=f"KI-Service nicht verfügbar: {str(e)}")

    system_prompt, user_prompt = await _build_draft_prompt(db, request, non_empty)

    messages = [
        LLMMessage(role="system", content=system_prompt),
        LLMMessage(role="user", content=user_prompt),
    ]
    config = LLMConfig(temperature=0.4, max_tokens=500)

    async def _stream_generator():
        _start = time.time()
        provider_name = "unknown"

        try:
            provider_info = await llm.get_provider_info()
            provider_name = provider_info.get("provider", "unknown")

            async for token in llm.chat_stream(messages, config):
                yield f"data: {json.dumps({'token': token}, ensure_ascii=False)}\n\n"

            latency_ms = int((time.time() - _start) * 1000)
            yield f"data: {json.dumps({'done': True, 'provider': provider_name}, ensure_ascii=False)}\n\n"

            asyncio.create_task(log_llm_call(
                feature="draft",
                response=None,
                latency_ms=latency_ms,
                user_id=str(current_user.id),
                country_code=request.country_code,
            ))

        except Exception as e:
            latency_ms = int((time.time() - _start) * 1000)
            logger.error(f"Streaming draft error: {e}")
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
            asyncio.create_task(log_llm_call(
                feature="draft",
                latency_ms=latency_ms,
                error_message=str(e),
                user_id=str(current_user.id),
                country_code=request.country_code,
            ))

    return StreamingResponse(
        _stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
