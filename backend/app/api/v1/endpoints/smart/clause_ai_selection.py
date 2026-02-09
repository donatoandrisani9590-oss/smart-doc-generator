"""
API Endpoints: AI-gestützte Textbaustein-Auswahl.

Schließt den Zyklus: "User erstellt Textbaustein → KI nutzt Klausel"

Endpoints:
- POST /ai-select    → KI wählt Textbausteine basierend auf User-Intent
- POST /ai-assemble  → Baut Dokument aus ausgewählten Textbausteine zusammen
"""
from typing import Annotated, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api import deps

router = APIRouter(prefix="/clause-ai", tags=["clause-ai"])


# ══════════════════════════════════════════════════════════════════════════════
# REQUEST / RESPONSE SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class ClauseAISelectRequest(BaseModel):
    """Request for AI clause selection."""
    user_intent: str = Field(
        ...,
        min_length=3,
        max_length=2000,
        description="Natural language request, e.g. 'Mach den Vertrag wasserdicht'"
    )
    country_code: str = Field("DE", min_length=2, max_length=2)
    document_type: Optional[str] = Field(
        None,
        description="Optional document type filter, e.g. 'Arbeitsvertrag Vollzeit'"
    )
    category_filter: Optional[str] = Field(
        None,
        description="Optional category filter, e.g. 'Kündigung'"
    )


class SelectedClause(BaseModel):
    clause_id: int
    title: str
    reason: str
    order: int


class ClauseAISelectResponse(BaseModel):
    """Response from AI clause selection."""
    selected_clauses: List[SelectedClause] = []
    explanation: str = ""
    warnings: List[str] = []
    clauses_available: int = 0
    provider: str = "unknown"


class ClauseAssembleRequest(BaseModel):
    """Request to assemble document from selected clause IDs."""
    clause_ids: List[int] = Field(..., min_length=1)
    form_data: Optional[dict] = Field(
        None,
        description="Form data for placeholder replacement"
    )


class AssembledClause(BaseModel):
    id: int
    title: str
    category: Optional[str]
    content_html: str
    version: int


class ClauseAssembleResponse(BaseModel):
    clauses: List[AssembledClause]
    total: int


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/ai-select", response_model=ClauseAISelectResponse)
async def ai_select_clauses(
    request: ClauseAISelectRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[deps.User, Depends(deps.get_current_user)],
):
    """
    KI-gestützte Textbaustein-Auswahl aus der Benutzer-Bibliothek.

    Die KI erfindet KEINEN neuen Text, sondern wählt aus den vorhandenen
    benutzerdefinierten Textbausteine die passenden aus.

    Flow:
    1. Lädt alle aktiven Textbausteine des Users (Mandanten-isoliert)
    2. Injiziert den Textbaustein-Katalog in den System-Prompt
    3. LLM matched User-Intent gegen Tags, Beschreibung, Ton, Kategorie
    4. Gibt ausgewählte Textbaustein-IDs mit Begründung zurück

    Beispiel:
        POST /clause-ai/ai-select
        {"user_intent": "Mach den Vertrag wasserdicht", "country_code": "DE"}

        →  Wählt Textbausteine mit Tags ["streng", "haftung", "geheimhaltung"] aus
    """
    from app.services.clause_ai_bridge import select_clauses_with_ai

    result = await select_clauses_with_ai(
        db=db,
        user_id=current_user.id,
        user_intent=request.user_intent,
        country_code=request.country_code,
        document_type=request.document_type,
        category_filter=request.category_filter,
    )

    return ClauseAISelectResponse(**result)


@router.post("/ai-assemble", response_model=ClauseAssembleResponse)
async def ai_assemble_clauses(
    request: ClauseAssembleRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[deps.User, Depends(deps.get_current_user)],
):
    """
    Baut den Dokumentinhalt aus ausgewählten Textbaustein-IDs zusammen.

    Mandanten-isoliert: Gibt nur Textbausteine zurück, die dem User gehören
    oder global sind. Ersetzt {{placeholders}} mit form_data.

    Typischer 2-Schritt-Flow:
    1. POST /clause-ai/ai-select  → KI wählt Textbausteine
    2. POST /clause-ai/ai-assemble → Inhalt zusammenbauen
    """
    from app.services.clause_ai_bridge import assemble_clauses

    assembled = await assemble_clauses(
        db=db,
        clause_ids=request.clause_ids,
        user_id=current_user.id,
        form_data=request.form_data,
    )

    return ClauseAssembleResponse(
        clauses=[AssembledClause(**c) for c in assembled],
        total=len(assembled),
    )
