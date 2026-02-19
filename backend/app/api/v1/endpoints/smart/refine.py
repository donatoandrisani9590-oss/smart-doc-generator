"""
AI Refine API: Inline text refinement for the document editor.

Allows users to select text in the TinyMCE editor and refine it with AI:
- Make text more formal
- Make text shorter/more concise
- Check for legal compliance
- Custom free-form instruction

Privacy: Uses Mistral AI (EU) or Ollama (local) - GDPR compliant.
"""
import asyncio
import json
import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.services.llm_service import LLMService, LLMMessage, LLMConfig, get_llm_service, log_llm_call
from app.services.ai_instructions import get_ai_instructions, get_user_primary_team_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/smart/refine", tags=["smart-refine"])

# ── Tone of Voice definitions ────────────────────────────────────────
TONE_PROMPTS = {
    1: "Verwende ausschließlich juristisch korrekte Formulierungen. Kein Smalltalk, keine emotionalen Ausdrücke. Passivkonstruktionen bevorzugt.",
    2: "Verwende klare, professionelle Sprache. Höflich, aber sachlich.",
    3: "Verwende professionelle, aber wertschätzende Sprache. Der Mitarbeiter soll sich willkommen fühlen.",
    4: "Verwende eine warme, persönliche Ansprache. Zeige Wertschätzung und menschliche Nähe.",
    5: "Verwende einfühlsame, verständnisvolle Sprache. Besonders geeignet für sensible Themen wie Kündigung oder Abmahnung.",
}


# ═══════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════

class RefineRequest(BaseModel):
    """Request body for text refinement."""
    text: str = Field(
        ...,
        min_length=3,
        max_length=10000,
        description="The selected text to refine"
    )
    instruction: str = Field(
        ...,
        min_length=2,
        max_length=500,
        description="Refinement instruction (e.g. 'förmlicher formulieren')"
    )
    context: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Document context (e.g. 'Kündigungsschreiben', 'Arbeitsvertrag')"
    )
    country_code: str = Field(
        default="DE",
        pattern="^(DE|AT|CH|IT)$",
        description="Country code for localization"
    )
    document_type_id: Optional[int] = Field(
        default=None,
        description="Document type ID for context-aware instructions"
    )
    tone_of_voice: Optional[int] = Field(None, ge=1, le=5)


class RefineResponse(BaseModel):
    """Response with refined text."""
    refined_text: str
    provider: str
    changes_summary: str  # Brief summary of what was changed


# ═══════════════════════════════════════════════════════════════════════════
# PRESET INSTRUCTIONS (German)
# ═══════════════════════════════════════════════════════════════════════════

PRESET_INSTRUCTIONS = {
    "formal": "Formuliere den Text förmlicher und professioneller, passend für ein offizielles HR-Dokument.",
    "concise": "Fasse den Text kürzer und prägnanter zusammen, ohne wichtige Inhalte zu verlieren.",
    "compliance": "Prüfe den Text auf arbeitsrechtliche Konformität und formuliere ihn bei Bedarf rechtskonform um. Weise auf problematische Formulierungen hin.",
    "friendly": "Formuliere den Text freundlicher und wertschätzender, dabei aber weiterhin professionell.",
    "clear": "Formuliere den Text klarer und verständlicher, vermeide Fachjargon wo möglich.",
}


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("", response_model=RefineResponse)
async def refine_text(
    request: RefineRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Refine selected text using AI.

    Accepts a text selection and an instruction, returns the refined version.
    Supports both preset instructions (formal, concise, compliance) and
    free-form custom instructions.
    """
    try:
        llm = await get_llm_service()
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=f"KI-Service nicht verfügbar: {str(e)}"
        )

    # Resolve preset instruction or use custom
    instruction = PRESET_INSTRUCTIONS.get(request.instruction, request.instruction)

    # Load optional AI instructions from user/company settings
    custom_ai_instructions = ""
    try:
        team_id = await get_user_primary_team_id(db, current_user.id)
        custom_ai_instructions = await get_ai_instructions(
            db, request.country_code, request.document_type_id, team_id=team_id
        )
    except (ValueError, KeyError, AttributeError, TypeError):
        pass  # AI instructions are optional, skip on config errors
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Unerwarteter Fehler beim Laden der KI-Anweisungen: {e}")

    # Build system prompt
    tone_text = TONE_PROMPTS.get(request.tone_of_voice or 2, TONE_PROMPTS[2])
    system_prompt = f"""Du bist ein erfahrener HR-Textexperte für {_country_name(request.country_code)}.
Deine Aufgabe ist es, den gegebenen Text gemäß der Anweisung zu überarbeiten.

Regeln:
- Gib NUR den überarbeiteten Text zurück, keine Erklärungen oder Kommentare.
- Behalte die Sprache des Originaltexts bei (Deutsch oder Italienisch je nach Land).
- Behalte das HTML-Format bei, wenn der Text HTML-Tags enthält.
- Ändere nur das, was die Anweisung verlangt. Behalte den Rest so nah am Original wie möglich.
- Wenn der Text bereits gut ist und keine Änderung nötig ist, gib ihn unverändert zurück.
{f"- Berücksichtige folgende Unternehmensrichtlinien: {custom_ai_instructions}" if custom_ai_instructions else ""}
{f"- Dokumentkontext: {request.context}" if request.context else ""}
Tonalität: {tone_text}"""

    user_prompt = f"""Anweisung: {instruction}

Text zum Überarbeiten:
{request.text}"""

    try:
        _llm_start = time.time()
        response = await llm.chat(
            messages=[
                LLMMessage(role="system", content=system_prompt),
                LLMMessage(role="user", content=user_prompt),
            ],
            config=LLMConfig(
                temperature=0.3,
                max_tokens=max(min(len(request.text) * 3, 4000), 200),
            )
        )
        asyncio.create_task(log_llm_call(
            feature="refine",
            response=response,
            latency_ms=int((time.time() - _llm_start) * 1000),
            user_id=str(current_user.id),
            country_code=request.country_code,
        ))

        refined = response.content.strip()

        # Generate a brief changes summary
        summary = await _generate_summary(llm, request.text, refined, instruction, current_user, request.country_code)

        return RefineResponse(
            refined_text=refined,
            provider=response.provider,
            changes_summary=summary,
        )

    except Exception as e:
        asyncio.create_task(log_llm_call(
            feature="refine",
            latency_ms=int((time.time() - _llm_start) * 1000),
            error_message=str(e),
            user_id=str(current_user.id),
            country_code=request.country_code,
        ))
        raise HTTPException(
            status_code=500,
            detail=f"KI-Verarbeitung fehlgeschlagen: {str(e)}"
        )


@router.get("/presets")
async def get_presets(
    current_user=Depends(get_current_user),
):
    """Get available refinement presets."""
    return {
        "presets": [
            {"id": "formal", "label": "Förmlicher formulieren", "icon": "graduation-cap", "description": "Professioneller und offizieller Ton"},
            {"id": "concise", "label": "Kürzer fassen", "icon": "scissors", "description": "Kompakter ohne Informationsverlust"},
            {"id": "compliance", "label": "Rechtskonform prüfen", "icon": "shield-check", "description": "Arbeitsrechtliche Konformität prüfen"},
            {"id": "friendly", "label": "Freundlicher formulieren", "icon": "heart", "description": "Wertschätzender und positiver Ton"},
            {"id": "clear", "label": "Verständlicher formulieren", "icon": "eye", "description": "Klarer, weniger Fachjargon"},
        ]
    }


# ═══════════════════════════════════════════════════════════════════════════
# STREAMING ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/stream")
async def refine_text_stream(
    request: RefineRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Stream refined text token-by-token via Server-Sent Events.

    SSE frames:
    - data: {"token": "..."} — each generated token
    - data: {"done": true, "provider": "...", "changes_summary": "..."} — final frame
    - data: {"error": "..."} — on failure
    """
    try:
        llm = await get_llm_service()
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=f"KI-Service nicht verfügbar: {str(e)}"
        )

    # Resolve preset instruction or use custom
    instruction = PRESET_INSTRUCTIONS.get(request.instruction, request.instruction)

    # Load optional AI instructions
    custom_ai_instructions = ""
    try:
        team_id = await get_user_primary_team_id(db, current_user.id)
        custom_ai_instructions = await get_ai_instructions(
            db, request.country_code, request.document_type_id, team_id=team_id
        )
    except (ValueError, KeyError, AttributeError, TypeError):
        pass
    except Exception as e:
        logger.warning(f"Unerwarteter Fehler beim Laden der KI-Anweisungen: {e}")

    # Build prompts (same as non-streaming endpoint)
    tone_text = TONE_PROMPTS.get(request.tone_of_voice or 2, TONE_PROMPTS[2])
    system_prompt = f"""Du bist ein erfahrener HR-Textexperte für {_country_name(request.country_code)}.
Deine Aufgabe ist es, den gegebenen Text gemäß der Anweisung zu überarbeiten.

Regeln:
- Gib NUR den überarbeiteten Text zurück, keine Erklärungen oder Kommentare.
- Behalte die Sprache des Originaltexts bei (Deutsch oder Italienisch je nach Land).
- Behalte das HTML-Format bei, wenn der Text HTML-Tags enthält.
- Ändere nur das, was die Anweisung verlangt. Behalte den Rest so nah am Original wie möglich.
- Wenn der Text bereits gut ist und keine Änderung nötig ist, gib ihn unverändert zurück.
{f"- Berücksichtige folgende Unternehmensrichtlinien: {custom_ai_instructions}" if custom_ai_instructions else ""}
{f"- Dokumentkontext: {request.context}" if request.context else ""}
Tonalität: {tone_text}"""

    user_prompt = f"""Anweisung: {instruction}

Text zum Überarbeiten:
{request.text}"""

    messages = [
        LLMMessage(role="system", content=system_prompt),
        LLMMessage(role="user", content=user_prompt),
    ]
    config = LLMConfig(
        temperature=0.3,
        max_tokens=max(min(len(request.text) * 3, 4000), 200),
    )

    async def _stream_generator():
        """Async generator yielding SSE frames."""
        _start = time.time()
        full_text = ""
        provider_name = "unknown"

        try:
            provider_info = await llm.get_provider_info()
            provider_name = provider_info.get("provider", "unknown")

            async for token in llm.chat_stream(messages, config):
                full_text += token
                yield f"data: {json.dumps({'token': token}, ensure_ascii=False)}\n\n"

            # Generate changes summary (blocking, short call)
            latency_ms = int((time.time() - _start) * 1000)
            summary = await _generate_summary(
                llm, request.text, full_text.strip(), instruction,
                current_user, request.country_code
            )

            # Send done frame
            yield f"data: {json.dumps({'done': True, 'provider': provider_name, 'changes_summary': summary}, ensure_ascii=False)}\n\n"

            # Log the call (fire-and-forget)
            asyncio.create_task(log_llm_call(
                feature="refine",
                response=None,  # No LLMResponse for streaming
                latency_ms=latency_ms,
                user_id=str(current_user.id),
                country_code=request.country_code,
            ))

        except Exception as e:
            latency_ms = int((time.time() - _start) * 1000)
            logger.error(f"Streaming refine error: {e}")
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
            asyncio.create_task(log_llm_call(
                feature="refine",
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


async def _generate_summary(
    llm: LLMService,
    original: str,
    refined: str,
    instruction: str,
    current_user=None,
    country_code: str = None,
) -> str:
    """Generate a brief summary of what was changed."""
    if original.strip() == refined.strip():
        return "Keine Änderungen nötig – der Text ist bereits gut."

    try:
        _llm_start = time.time()
        response = await llm.chat(
            messages=[
                LLMMessage(
                    role="system",
                    content="Fasse in EINEM kurzen deutschen Satz (max 15 Worte) zusammen, was am Text geändert wurde. Kein Markdown.",
                ),
                LLMMessage(
                    role="user",
                    content=f"Anweisung war: {instruction}\n\nOriginal: {original[:500]}\n\nNeu: {refined[:500]}",
                ),
            ],
            config=LLMConfig(temperature=0.1, max_tokens=100),
        )
        asyncio.create_task(log_llm_call(
            feature="refine",
            response=response,
            latency_ms=int((time.time() - _llm_start) * 1000),
            user_id=str(current_user.id) if current_user else None,
            country_code=country_code,
        ))
        return response.content.strip()
    except Exception as e:
        logger.debug("Zusammenfassung der Änderungen konnte nicht generiert werden: %s", e)
        return "Text wurde gemäß Anweisung überarbeitet."
