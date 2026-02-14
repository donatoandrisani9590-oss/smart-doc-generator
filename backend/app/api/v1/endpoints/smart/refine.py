"""
AI Refine API: Inline text refinement for the document editor.

Allows users to select text in the TinyMCE editor and refine it with AI:
- Make text more formal
- Make text shorter/more concise
- Check for legal compliance
- Custom free-form instruction

Privacy: Uses Mistral AI (EU) or Ollama (local) - GDPR compliant.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.services.llm_service import LLMService, LLMMessage, LLMConfig, get_llm_service
from app.services.ai_instructions import get_ai_instructions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/smart/refine", tags=["smart-refine"])


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
        custom_ai_instructions = await get_ai_instructions(
            db, request.country_code, request.document_type_id
        )
    except (ValueError, KeyError, AttributeError, TypeError):
        pass  # AI instructions are optional, skip on config errors
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Unerwarteter Fehler beim Laden der KI-Anweisungen: {e}")

    # Build system prompt
    system_prompt = f"""Du bist ein erfahrener HR-Textexperte für {_country_name(request.country_code)}.
Deine Aufgabe ist es, den gegebenen Text gemäß der Anweisung zu überarbeiten.

Regeln:
- Gib NUR den überarbeiteten Text zurück, keine Erklärungen oder Kommentare.
- Behalte die Sprache des Originaltexts bei (Deutsch oder Italienisch je nach Land).
- Behalte das HTML-Format bei, wenn der Text HTML-Tags enthält.
- Ändere nur das, was die Anweisung verlangt. Behalte den Rest so nah am Original wie möglich.
- Wenn der Text bereits gut ist und keine Änderung nötig ist, gib ihn unverändert zurück.
{f"- Berücksichtige folgende Unternehmensrichtlinien: {custom_ai_instructions}" if custom_ai_instructions else ""}
{f"- Dokumentkontext: {request.context}" if request.context else ""}"""

    user_prompt = f"""Anweisung: {instruction}

Text zum Überarbeiten:
{request.text}"""

    try:
        response = await llm.chat(
            messages=[
                LLMMessage(role="system", content=system_prompt),
                LLMMessage(role="user", content=user_prompt),
            ],
            config=LLMConfig(
                temperature=0.3,
                max_tokens=min(len(request.text) * 3, 4000),
            )
        )

        refined = response.content.strip()

        # Generate a brief changes summary
        summary = await _generate_summary(llm, request.text, refined, instruction)

        return RefineResponse(
            refined_text=refined,
            provider=response.provider,
            changes_summary=summary,
        )

    except Exception as e:
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
) -> str:
    """Generate a brief summary of what was changed."""
    if original.strip() == refined.strip():
        return "Keine Änderungen nötig – der Text ist bereits gut."

    try:
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
        return response.content.strip()
    except Exception as e:
        logger.debug("Zusammenfassung der Änderungen konnte nicht generiert werden: %s", e)
        return "Text wurde gemäß Anweisung überarbeitet."
