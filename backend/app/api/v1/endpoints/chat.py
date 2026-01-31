"""
Brief-Assistent API: LLM-powered writing assistant for document generation.
Uses OpenAI API for intelligent text suggestions and clause drafting.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import os

from app.db import get_db
from app.core.config import settings

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: Optional[dict] = None  # Current form data for context
    country_code: str = "DE"
    mode: str = "general"  # "general", "clause", "formal"


class ChatResponse(BaseModel):
    message: str
    suggestions: list[str] = []


# System prompts for different modes
SYSTEM_PROMPTS = {
    "general": """Du bist ein hilfreicher Assistent für die Erstellung von HR-Dokumenten.
Du hilfst bei der Formulierung von Arbeitsverträgen, Kündigungsschreiben und anderen Personaldokumenten.
Antworte immer professionell und juristisch korrekt für den deutschen/österreichischen/Schweizer Rechtsraum.
Halte deine Antworten präzise und auf den Punkt.""",
    
    "clause": """Du bist ein Experte für arbeitsrechtliche Klauseln.
Deine Aufgabe ist es, rechtssichere Vertragsklauseln zu formulieren.
Berücksichtige dabei:
- Aktuelle Rechtsprechung (BAG, EuGH)
- Branchenübliche Standards
- Klarheit und Verständlichkeit
Formuliere Klauseln immer in der dritten Person und verwende genderneutrale Sprache wo möglich.""",
    
    "formal": """Du hilfst beim Verfassen formeller Geschäftskorrespondenz.
Achte auf:
- Korrekte Anrede und Grußformel
- Formellen, aber freundlichen Ton
- Klare Struktur (Betreff, Einleitung, Hauptteil, Schluss)
- Rechtschreibung und Grammatik"""
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


async def get_openai_client():
    """Get OpenAI client with API key from environment."""
    try:
        from openai import AsyncOpenAI
        
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail="OpenAI API key nicht konfiguriert"
            )
        
        return AsyncOpenAI(api_key=api_key)
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="OpenAI SDK nicht installiert"
        )


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Send a message to the Brief-Assistent.
    
    Modes:
    - general: General document assistance
    - clause: Clause drafting and legal text
    - formal: Formal business correspondence
    """
    client = await get_openai_client()
    
    # Select system prompt based on country and mode
    if request.country_code.upper() == "IT":
        system_prompt = IT_SYSTEM_PROMPTS.get(request.mode, IT_SYSTEM_PROMPTS["general"])
    else:
        system_prompt = SYSTEM_PROMPTS.get(request.mode, SYSTEM_PROMPTS["general"])
    
    # Add context if provided
    if request.context:
        context_str = "\n".join([f"- {k}: {v}" for k, v in request.context.items() if v])
        system_prompt += f"\n\nAktuelle Formulardaten:\n{context_str}"
    
    # Build messages array
    messages = [{"role": "system", "content": system_prompt}]
    for msg in request.messages:
        messages.append({"role": msg.role, "content": msg.content})
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",  # Cost-effective, fast model
            messages=messages,
            temperature=0.7,
            max_tokens=1024
        )
        
        assistant_message = response.choices[0].message.content
        
        # Generate suggestions for follow-up
        suggestions = []
        if request.mode == "clause":
            suggestions = [
                "Kannst du diese Klausel vereinfachen?",
                "Gibt es rechtliche Risiken bei dieser Formulierung?",
                "Welche Alternativen gibt es?"
            ]
        elif request.mode == "formal":
            suggestions = [
                "Kannst du den Ton formeller gestalten?",
                "Wie kann ich das kürzer formulieren?"
            ]
        
        return ChatResponse(
            message=assistant_message,
            suggestions=suggestions
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Fehler bei der Kommunikation mit dem Assistenten: {str(e)}"
        )


@router.post("/suggest-clause")
async def suggest_clause(
    title: str,
    description: str,
    country_code: str = "DE",
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a suggested clause based on title and description.
    """
    client = await get_openai_client()
    
    prompt = f"""Erstelle eine rechtssichere Arbeitsvertragsklausel für folgendes Thema:

Titel: {title}
Beschreibung: {description}
Land: {'Deutschland' if country_code.upper() == 'DE' else 'Italien'}

Formatiere die Klausel mit HTML-Tags (<p>, <ol>, <li>) für die Verwendung in einem Dokumenten-Editor.
Die Klausel sollte:
1. Rechtlich wasserdicht sein
2. Klar und verständlich formuliert sein
3. Branchenüblichen Standards entsprechen
"""
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPTS["clause"]},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=1500
        )
        
        return {
            "title": title,
            "content": response.choices[0].message.content,
            "disclaimer": "Diese Klausel wurde automatisch generiert. Bitte prüfen Sie den Inhalt vor der Verwendung."
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Klausel-Generierung fehlgeschlagen: {str(e)}"
        )


@router.post("/improve-text")
async def improve_text(
    text: str,
    style: str = "formal",  # "formal", "simplified", "legal"
    db: AsyncSession = Depends(get_db)
):
    """
    Improve or rewrite text in a specific style.
    """
    client = await get_openai_client()
    
    style_instructions = {
        "formal": "Formuliere den Text formeller und professioneller.",
        "simplified": "Vereinfache den Text für bessere Verständlichkeit. Verwende einfachere Wörter und kürzere Sätze.",
        "legal": "Überarbeite den Text für rechtliche Präzision. Stelle sicher, dass alle Formulierungen eindeutig sind."
    }
    
    instruction = style_instructions.get(style, style_instructions["formal"])
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Du bist ein Experte für Textoptimierung in Geschäftsdokumenten."},
                {"role": "user", "content": f"{instruction}\n\nOriginaltext:\n{text}"}
            ],
            temperature=0.5,
            max_tokens=1000
        )
        
        return {
            "original": text,
            "improved": response.choices[0].message.content,
            "style": style
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Textverbesserung fehlgeschlagen: {str(e)}"
        )
