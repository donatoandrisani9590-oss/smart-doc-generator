"""
Brief-Assistent API: LLM-powered writing assistant for document generation.

Privacy-First: Uses Mistral AI (EU-hosted) or Ollama (local) - NO OpenAI.
All data stays in EU or on your machine.
"""
import asyncio
import time

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import json
import re

from app.db import get_db
from app.api.deps import get_current_user
from app.models.core import User
from app.services.llm_service import (
    LLMService, LLMMessage, LLMConfig, get_llm_service, log_llm_call
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[Dict[str, Any]] = None  # Current form data for context
    country_code: str = "DE"
    mode: str = "general"  # "general", "clause", "formal", "document"


class ChatResponse(BaseModel):
    message: str
    suggestions: List[str] = []
    provider: str = "unknown"  # mistral or ollama


class DocumentIntent(BaseModel):
    """Detected intent from natural language input."""
    intent_type: str  # "create_document", "fill_field", "add_clause", "question"
    document_type: Optional[str] = None
    extracted_data: Dict[str, Any] = {}
    confidence: float = 0.0


class SmartChatRequest(BaseModel):
    """Request for smart document chat."""
    message: str
    current_context: Optional[Dict[str, Any]] = None
    country_code: str = "DE"


class SmartChatResponse(BaseModel):
    """Response with detected intents and actions."""
    message: str
    intent: Optional[DocumentIntent] = None
    suggested_actions: List[Dict[str, Any]] = []
    provider: str = "unknown"


# ═══════════════════════════════════════════════════════════════════════════
# SYSTEM PROMPTS
# ═══════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPTS = {
    "general": """Du bist ein hilfreicher Assistent für die Erstellung von HR-Dokumenten.
Du hilfst bei der Formulierung von Arbeitsverträgen, Kündigungsschreiben und anderen Personaldokumenten.
Antworte immer professionell und juristisch korrekt für den deutschen/österreichischen/Schweizer Rechtsraum.
Halte deine Antworten präzise und auf den Punkt.""",

    "clause": """Du bist ein Experte für arbeitsrechtliche Textbausteine.
Deine Aufgabe ist es, rechtssichere Textbausteine zu formulieren.
Berücksichtige dabei:
- Aktuelle Rechtsprechung (BAG, EuGH)
- Branchenübliche Standards
- Klarheit und Verständlichkeit
Formuliere Textbausteine immer in der dritten Person und verwende genderneutrale Sprache wo möglich.""",

    "formal": """Du hilfst beim Verfassen formeller Geschäftskorrespondenz.
Achte auf:
- Korrekte Anrede und Grußformel
- Formellen, aber freundlichen Ton
- Klare Struktur (Betreff, Einleitung, Hauptteil, Schluss)
- Rechtschreibung und Grammatik""",

    "document": """Du bist ein intelligenter Dokumenten-Assistent.
Deine Aufgabe ist es, natürliche Spracheingaben zu verstehen und in Dokumenten-Aktionen zu übersetzen.

VERFÜGBARE DOKUMENTTYPEN:

PHASE 1 - EINSTELLUNG:
- "Arbeitsvertrag Vollzeit", "Arbeitsvertrag Teilzeit", "Arbeitsvertrag Minijob", "Arbeitsvertrag Befristet"
- "Einstellungszusage", "Absageschreiben", "Verschwiegenheitserklärung"

PHASE 2 - LAUFENDES ARBEITSVERHÄLTNIS:
- "Nachtrag zum Arbeitsvertrag", "Gehaltserhöhungsschreiben", "Beförderungsschreiben"
- "Versetzungsschreiben", "Arbeitszeitänderung", "Elternzeit-Bestätigung"
- "Abmahnung", "Homeoffice-Vereinbarung", "Bonusvereinbarung"
- "Firmenwagen-Vereinbarung", "Überstundenvereinbarung", "Fortbildungsvereinbarung"

PHASE 3 - BEENDIGUNG:
- "Kündigung", "Fristlose Kündigung", "Kündigungsbestätigung", "Aufhebungsvertrag"
- "Arbeitszeugnis Qualifiziert", "Arbeitszeugnis Einfach", "Zwischenzeugnis"
- "Freistellungserklärung", "Arbeitsbescheinigung"

Beispiele:
- "Erstelle einen Arbeitsvertrag für Max Müller" → Dokumenttyp=Arbeitsvertrag Vollzeit
- "Gehaltserhöhung für Anna Schmidt auf 6000€" → Dokumenttyp=Gehaltserhöhungsschreiben
- "Abmahnung für Peter Weber wegen Fehlens" → Dokumenttyp=Abmahnung
- "Qualifiziertes Zeugnis für Lisa Braun" → Dokumenttyp=Arbeitszeugnis Qualifiziert

Antworte IMMER im folgenden JSON-Format:
{
    "intent": "create_document" | "fill_field" | "add_clause" | "question" | "other",
    "document_type": "[Exakter Dokumenttyp aus obiger Liste]" | null,
    "extracted_fields": {
        "vorname": "...",
        "nachname": "...",
        "gehalt": "...",
        "position": "...",
        "eintrittsdatum": "...",
        "kuendigungsdatum": "...",
        "vorfall_datum": "...",
        "beschaeftigt_von": "...",
        "beschaeftigt_bis": "...",
        ...
    },
    "confidence": 0.0-1.0,
    "response": "Natürliche Antwort an den Nutzer"
}"""
}

IT_SYSTEM_PROMPTS = {
    "general": """Sei un assistente per la creazione di documenti HR.
Aiuti nella formulazione di contratti di lavoro, lettere di licenziamento e altri documenti del personale.
Rispondi sempre in modo professionale e giuridicamente corretto per il sistema legale italiano.
Mantieni le risposte precise e concise.""",

    "clause": """Sei un esperto di clausole contrattuali per il diritto del lavoro italiano.
Il tuo compito è formulare clausole contrattuali sicure.
Considera: Giurisprudenza attuale, Standard di settore, Chiarezza e comprensibilità.""",

    "formal": """Aiuti nella stesura di corrispondenza commerciale formale.
Attenzione a: Saluto e formula di chiusura corretti, Tono formale ma cortese, Struttura chiara."""
}


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def get_system_prompt(mode: str, country_code: str, context: Optional[Dict] = None, custom_instructions: str = "") -> str:
    """Get appropriate system prompt based on mode and country."""
    if country_code.upper() == "IT":
        prompt = IT_SYSTEM_PROMPTS.get(mode, IT_SYSTEM_PROMPTS["general"])
    else:
        prompt = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["general"])

    # Add context if provided
    if context:
        context_str = "\n".join([f"- {k}: {v}" for k, v in context.items() if v])
        prompt += f"\n\nAktuelle Formulardaten:\n{context_str}"

    # Add custom AI instructions
    if custom_instructions:
        prompt += custom_instructions

    return prompt


def parse_document_intent(llm_response: str) -> Optional[DocumentIntent]:
    """Parse LLM response to extract document intent."""
    try:
        # Try to extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', llm_response)
        if json_match:
            data = json.loads(json_match.group())
            return DocumentIntent(
                intent_type=data.get("intent", "other"),
                document_type=data.get("document_type"),
                extracted_data=data.get("extracted_fields", {}),
                confidence=data.get("confidence", 0.5)
            )
    except (json.JSONDecodeError, KeyError):
        pass
    return None


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send a message to the Brief-Assistent.

    Privacy-First: Uses Mistral AI (EU) or Ollama (local).
    No data is sent to US providers.

    Modes:
    - general: General document assistance
    - clause: Clause drafting and legal text
    - formal: Formal business correspondence
    - document: Smart document creation from natural language
    """
    try:
        llm = await get_llm_service()
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=f"LLM nicht verfügbar: {str(e)}"
        )

    # Load custom AI instructions
    from app.services.ai_instructions import get_ai_instructions
    custom_instructions = await get_ai_instructions(db, request.country_code)

    # Build messages
    system_prompt = get_system_prompt(request.mode, request.country_code, request.context, custom_instructions)

    messages = [LLMMessage(role="system", content=system_prompt)]
    for msg in request.messages:
        messages.append(LLMMessage(role=msg.role, content=msg.content))

    try:
        _llm_start = time.time()
        response = await llm.chat(
            messages,
            LLMConfig(temperature=0.7, max_tokens=1024)
        )
        asyncio.create_task(log_llm_call(
            feature="chat",
            response=response,
            latency_ms=int((time.time() - _llm_start) * 1000),
            user_id=str(current_user.id),
            country_code=request.country_code,
        ))

        # Generate suggestions for follow-up
        suggestions = []
        if request.mode == "clause":
            suggestions = [
                "Kannst du diesen Textbaustein vereinfachen?",
                "Gibt es rechtliche Risiken bei dieser Formulierung?",
                "Welche Alternativen gibt es?"
            ]
        elif request.mode == "formal":
            suggestions = [
                "Kannst du den Ton formeller gestalten?",
                "Wie kann ich das kürzer formulieren?"
            ]
        elif request.mode == "document":
            suggestions = [
                "Welche Daten fehlen noch?",
                "Zeige eine Vorschau",
                "Ändere das Gehalt"
            ]

        return ChatResponse(
            message=response.content,
            suggestions=suggestions,
            provider=response.provider
        )

    except Exception as e:
        asyncio.create_task(log_llm_call(
            feature="chat",
            latency_ms=int((time.time() - _llm_start) * 1000),
            error_message=str(e),
            user_id=str(current_user.id),
            country_code=request.country_code,
        ))
        raise HTTPException(
            status_code=500,
            detail=f"Fehler bei der Kommunikation mit dem Assistenten: {str(e)}"
        )


# ═══════════════════════════════════════════════════════════════════════════
# STREAMING CHAT ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stream chat responses token-by-token via Server-Sent Events.

    Same as POST /chat but with real-time streaming for better UX.

    SSE frames:
    - data: {"token": "..."} — each generated token
    - data: {"done": true, "provider": "...", "suggestions": [...]} — final frame
    - data: {"error": "..."} — on failure
    """
    try:
        llm = await get_llm_service()
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=f"LLM nicht verfügbar: {str(e)}"
        )

    # Load custom AI instructions
    from app.services.ai_instructions import get_ai_instructions
    custom_instructions = await get_ai_instructions(db, request.country_code)

    # Build messages (identical to blocking endpoint)
    system_prompt = get_system_prompt(request.mode, request.country_code, request.context, custom_instructions)

    messages = [LLMMessage(role="system", content=system_prompt)]
    for msg in request.messages:
        messages.append(LLMMessage(role=msg.role, content=msg.content))

    config = LLMConfig(temperature=0.7, max_tokens=1024)

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

            # Generate follow-up suggestions (same logic as blocking endpoint)
            suggestions = []
            if request.mode == "clause":
                suggestions = [
                    "Kannst du diesen Textbaustein vereinfachen?",
                    "Gibt es rechtliche Risiken bei dieser Formulierung?",
                    "Welche Alternativen gibt es?"
                ]
            elif request.mode == "formal":
                suggestions = [
                    "Kannst du den Ton formeller gestalten?",
                    "Wie kann ich das kürzer formulieren?"
                ]
            elif request.mode == "document":
                suggestions = [
                    "Welche Daten fehlen noch?",
                    "Zeige eine Vorschau",
                    "Ändere das Gehalt"
                ]

            # Send done frame with suggestions
            latency_ms = int((time.time() - _start) * 1000)
            yield f"data: {json.dumps({'done': True, 'provider': provider_name, 'suggestions': suggestions}, ensure_ascii=False)}\n\n"

            # Log the call (fire-and-forget)
            asyncio.create_task(log_llm_call(
                feature="chat",
                response=None,
                latency_ms=latency_ms,
                user_id=str(current_user.id),
                country_code=request.country_code,
            ))

        except Exception as e:
            latency_ms = int((time.time() - _start) * 1000)
            logger.error(f"Streaming chat error: {e}")
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
            asyncio.create_task(log_llm_call(
                feature="chat",
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


@router.post("/smart", response_model=SmartChatResponse)
async def smart_chat(
    request: SmartChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Smart document chat - understands natural language and extracts intents.

    Example inputs:
    - "Erstelle einen Arbeitsvertrag für Max Müller"
    - "Der Mitarbeiter verdient 5000€ pro Monat"
    - "Füge eine Homeoffice-Klausel hinzu"

    Returns detected intent and extracted data for form filling.
    """
    try:
        llm = await get_llm_service()
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=f"LLM nicht verfügbar: {str(e)}"
        )

    # Load custom AI instructions
    from app.services.ai_instructions import get_ai_instructions
    custom_instructions = await get_ai_instructions(db, request.country_code)

    # Use document mode for intent extraction
    system_prompt = SYSTEM_PROMPTS["document"]

    # Add current context if available
    if request.current_context:
        context_str = json.dumps(request.current_context, ensure_ascii=False, indent=2)
        system_prompt += f"\n\nAktueller Dokumentstatus:\n{context_str}"

    # Add custom AI instructions
    if custom_instructions:
        system_prompt += custom_instructions

    messages = [
        LLMMessage(role="system", content=system_prompt),
        LLMMessage(role="user", content=request.message)
    ]

    try:
        _llm_start = time.time()
        response = await llm.chat(
            messages,
            LLMConfig(
                temperature=0.3,  # Lower for more deterministic extraction
                max_tokens=1024,
                json_mode=True
            )
        )
        asyncio.create_task(log_llm_call(
            feature="chat",
            response=response,
            latency_ms=int((time.time() - _llm_start) * 1000),
            user_id=str(current_user.id),
            country_code=request.country_code,
        ))

        # Parse the intent
        intent = parse_document_intent(response.content)

        # Build suggested actions based on intent
        suggested_actions = []
        if intent:
            if intent.intent_type == "create_document":
                suggested_actions.append({
                    "action": "create_draft",
                    "document_type": intent.document_type,
                    "initial_data": intent.extracted_data
                })
            elif intent.intent_type == "fill_field":
                for field, value in intent.extracted_data.items():
                    suggested_actions.append({
                        "action": "update_field",
                        "field": field,
                        "value": value
                    })
            elif intent.intent_type == "add_clause":
                suggested_actions.append({
                    "action": "search_clause",
                    "query": request.message
                })

        # Extract natural response from JSON
        natural_response = response.content
        try:
            parsed = json.loads(response.content)
            if "response" in parsed:
                natural_response = parsed["response"]
        except:
            pass

        return SmartChatResponse(
            message=natural_response,
            intent=intent,
            suggested_actions=suggested_actions,
            provider=response.provider
        )

    except Exception as e:
        asyncio.create_task(log_llm_call(
            feature="chat",
            latency_ms=int((time.time() - _llm_start) * 1000),
            error_message=str(e),
            user_id=str(current_user.id),
            country_code=request.country_code,
        ))
        raise HTTPException(
            status_code=500,
            detail=f"Smart Chat fehlgeschlagen: {str(e)}"
        )


@router.post("/suggest-clause")
async def suggest_clause(
    title: str,
    description: str,
    country_code: str = "DE",
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Suggest clauses from the user's library based on title and description.

    v4.3: Uses clause_ai_bridge to select from EXISTING user-defined clauses
    instead of generating new text. Falls back to LLM generation only if
    no matching clauses are found.
    """
    from app.services.clause_ai_bridge import select_clauses_with_ai, assemble_clauses

    # Step 1: Try to find matching clauses from user's library
    user_intent = f"Ich brauche einen Textbaustein zum Thema: {title}. {description}"
    ai_result = await select_clauses_with_ai(
        db=db,
        user_id=current_user.id,
        user_intent=user_intent,
        country_code=country_code,
    )

    selected = ai_result.get("selected_clauses", [])

    # If AI found matching clauses, return them from the library
    if selected:
        clause_ids = [s["clause_id"] for s in selected]
        assembled = await assemble_clauses(
            db=db,
            clause_ids=clause_ids,
            user_id=current_user.id,
        )

        return {
            "title": title,
            "source": "library",
            "selected_clauses": [
                {
                    "id": c["id"],
                    "title": c["title"],
                    "content": c["content_html"],
                    "reason": next(
                        (s["reason"] for s in selected if s["clause_id"] == c["id"]),
                        ""
                    ),
                }
                for c in assembled
            ],
            "explanation": ai_result.get("explanation", ""),
            "provider": ai_result.get("provider", "unknown"),
            "disclaimer": "Diese Textbausteine stammen aus Ihrer Bibliothek und wurden von der KI als passend ausgewählt.",
        }

    # Fallback: No matching clauses found, generate with LLM
    try:
        llm = await get_llm_service()
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=f"LLM nicht verfügbar: {str(e)}"
        )

    # Load custom AI instructions for fallback generation
    from app.services.ai_instructions import get_ai_instructions as get_ai_instr
    custom_instr = await get_ai_instr(db, country_code)

    country_name = "Deutschland" if country_code.upper() == "DE" else "Italien"

    prompt = f"""Erstelle eine rechtssichere Arbeitsvertrag-Textbaustein für folgendes Thema:

Titel: {title}
Beschreibung: {description}
Land: {country_name}

Formatiere den Textbaustein mit HTML-Tags (<p>, <ol>, <li>) für die Verwendung in einem Dokumenten-Editor.
Der Textbaustein sollte:
1. Rechtlich wasserdicht sein
2. Klar und verständlich formuliert sein
3. Branchenüblichen Standards entsprechen
"""

    system_content = SYSTEM_PROMPTS["clause"]
    if custom_instr:
        system_content += custom_instr

    messages = [
        LLMMessage(role="system", content=system_content),
        LLMMessage(role="user", content=prompt)
    ]

    try:
        _llm_start = time.time()
        response = await llm.chat(
            messages,
            LLMConfig(temperature=0.5, max_tokens=1500)
        )
        asyncio.create_task(log_llm_call(
            feature="chat",
            response=response,
            latency_ms=int((time.time() - _llm_start) * 1000),
            user_id=str(current_user.id),
            country_code=country_code,
        ))

        return {
            "title": title,
            "source": "generated",
            "content": response.content,
            "provider": response.provider,
            "disclaimer": "Kein passender Textbaustein in Ihrer Bibliothek gefunden. Dieser Textbaustein wurde automatisch generiert. Bitte prüfen und ggf. in die Bibliothek aufnehmen.",
            "warnings": ai_result.get("warnings", []) + [
                f"Es stehen {ai_result.get('clauses_available', 0)} Textbausteine in Ihrer Bibliothek zur Verfügung, aber keine passte zum Thema '{title}'."
            ],
        }

    except Exception as e:
        asyncio.create_task(log_llm_call(
            feature="chat",
            latency_ms=int((time.time() - _llm_start) * 1000),
            error_message=str(e),
            user_id=str(current_user.id),
            country_code=country_code,
        ))
        raise HTTPException(
            status_code=500,
            detail=f"Textbaustein-Generierung fehlgeschlagen: {str(e)}"
        )


@router.post("/improve-text")
async def improve_text(
    text: str,
    style: str = "formal",  # "formal", "simplified", "legal"
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Improve or rewrite text in a specific style.
    Uses Mistral/Ollama (privacy-first).
    """
    try:
        llm = await get_llm_service()
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=f"LLM nicht verfügbar: {str(e)}"
        )

    style_instructions = {
        "formal": "Formuliere den Text formeller und professioneller.",
        "simplified": "Vereinfache den Text für bessere Verständlichkeit. Verwende einfachere Wörter und kürzere Sätze.",
        "legal": "Überarbeite den Text für rechtliche Präzision. Stelle sicher, dass alle Formulierungen eindeutig sind."
    }

    instruction = style_instructions.get(style, style_instructions["formal"])

    # Load custom AI instructions
    from app.services.ai_instructions import get_ai_instructions as get_ai_inst
    custom_instructions = await get_ai_inst(db, "DE")

    system_content = "Du bist ein Experte für Textoptimierung in Geschäftsdokumenten."
    if custom_instructions:
        system_content += custom_instructions

    messages = [
        LLMMessage(role="system", content=system_content),
        LLMMessage(role="user", content=f"{instruction}\n\nOriginaltext:\n{text}")
    ]

    try:
        _llm_start = time.time()
        response = await llm.chat(
            messages,
            LLMConfig(temperature=0.5, max_tokens=1000)
        )
        asyncio.create_task(log_llm_call(
            feature="chat",
            response=response,
            latency_ms=int((time.time() - _llm_start) * 1000),
            user_id=str(current_user.id),
        ))

        return {
            "original": text,
            "improved": response.content,
            "style": style,
            "provider": response.provider
        }

    except Exception as e:
        asyncio.create_task(log_llm_call(
            feature="chat",
            latency_ms=int((time.time() - _llm_start) * 1000),
            error_message=str(e),
            user_id=str(current_user.id),
        ))
        raise HTTPException(
            status_code=500,
            detail=f"Textverbesserung fehlgeschlagen: {str(e)}"
        )


@router.get("/provider")
async def get_chat_provider(
    current_user: User = Depends(get_current_user),
):
    """
    Get information about the active LLM provider for chat.

    Returns:
    - provider: "mistral" (EU) or "ollama" (local)
    - is_local: True if using Ollama
    - is_eu_hosted: True if using Mistral
    """
    try:
        llm = await get_llm_service()
        info = await llm.get_provider_info()
        return {
            "available": True,
            **info
        }
    except Exception as e:
        return {
            "available": False,
            "provider": "none",
            "error": str(e)
        }
