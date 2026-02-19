"""
Clause-AI Bridge: Connects user-defined clauses to the LLM system prompt.

This service closes the critical gap between clause management (CRUD) and
AI-driven document generation. Without this bridge, the AI ignores all
user-defined clauses and either invents text or falls back to generic defaults.

Architecture: Context Injection (Scenario A)
- On each AI call, loads the user's active clauses from the database
- Builds a structured clause catalog and injects it into the system prompt
- The LLM selects and assembles clauses based on semantic matching against
  the clause title, description, tags, category, and tone

Why not RAG/Embeddings?
- The clause library per tenant is small (typically 20-200 clauses)
- Context injection is simpler, more deterministic, and auditable
- No vector DB dependency needed
- Full clause text fits within Mistral's 32k context window

Privacy: All processing happens via Mistral (EU) or Ollama (local).
"""
import asyncio
import logging
import time
from typing import List, Optional, Dict, Any
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.documents import Clause
from app.services.llm_service import (
    LLMService, LLMMessage, LLMConfig, LLMResponse, get_llm_service, log_llm_call
)

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# CLAUSE LOADING (Tenant-Isolated)
# ══════════════════════════════════════════════════════════════════════════════

async def load_user_clauses(
    db: AsyncSession,
    user_id: int,
    country_code: str = "DE",
    category: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Load all active clauses visible to this user (own + global).

    Tenant isolation: Returns ONLY clauses where:
    - user_id matches the current user (user's own clauses), OR
    - user_id is NULL (global/shared clauses)

    Additionally filtered by:
    - is_active = True
    - approval_status in ('active', 'approved')
    - country_code matches or is NULL (cross-country clauses)
    """
    query = select(Clause).where(
        and_(
            Clause.is_active == True,
            Clause.approval_status.in_(["active", "approved"]),
            or_(
                Clause.country_code == country_code,
                Clause.country_code.is_(None),
            ),
            # TENANT ISOLATION: Only own clauses + global clauses
            or_(
                Clause.user_id == user_id,
                Clause.user_id.is_(None),
            ),
        )
    )

    if category:
        query = query.where(Clause.category == category)

    query = query.order_by(Clause.category, Clause.title)

    result = await db.execute(query)
    clauses = result.scalars().all()

    return [
        {
            "id": c.id,
            "title": c.title,
            "category": c.category or "Sonstiges",
            "description": c.description or "",
            "tags": c.tags or [],
            "tone": c.tone or "neutral",
            "content_preview": _truncate_html(c.content_html, 200),
            "content_full": c.content_html,
            "is_global": c.user_id is None,
        }
        for c in clauses
    ]


def _truncate_html(html: str, max_length: int) -> str:
    """Strip HTML tags and truncate for preview."""
    import re
    text = re.sub(r'<[^>]+>', '', html or '')
    text = ' '.join(text.split())
    if len(text) > max_length:
        return text[:max_length] + "..."
    return text


# ══════════════════════════════════════════════════════════════════════════════
# PROMPT BUILDING (Context Injection)
# ══════════════════════════════════════════════════════════════════════════════

def build_clause_catalog_prompt(clauses: List[Dict[str, Any]]) -> str:
    """
    Build a structured clause catalog for injection into the system prompt.

    Format designed for optimal LLM matching:
    - Groups clauses by category for scannability
    - Includes tags and tone for semantic matching
    - Includes description for intent understanding
    - Includes content preview so the LLM knows what each clause does

    Example output:
    === VERFÜGBARE TEXTBAUSTEINE (12 Stück) ===

    ## Kategorie: Kündigung
    [ID:5] "Ordentliche Kündigung Standard"
      Tags: kuendigung, ordentlich, frist
      Ton: neutral
      Beschreibung: Standard-Kündigungs-Textbaustein mit gesetzlicher Frist
      Vorschau: Der Arbeitnehmer kann das Arbeitsverhältnis unter Einhaltung...

    [ID:8] "Fristlose Kündigung Streng"
      Tags: kuendigung, fristlos, streng, wichtiger-grund
      Ton: streng
      ...
    """
    if not clauses:
        return (
            "HINWEIS: Es sind keine benutzerdefinierten Textbausteine verfügbar. "
            "Du darfst KEINEN eigenen Vertragstext erfinden. Weise den Nutzer darauf hin, "
            "dass er zuerst Textbausteine in den Einstellungen anlegen muss."
        )

    # Group by category
    categories: Dict[str, List[Dict[str, Any]]] = {}
    for clause in clauses:
        cat = clause["category"]
        categories.setdefault(cat, []).append(clause)

    lines = [f"=== VERFÜGBARE TEXTBAUSTEINE ({len(clauses)} Stück) ===\n"]

    for cat_name, cat_clauses in sorted(categories.items()):
        lines.append(f"## Kategorie: {cat_name}")
        for c in cat_clauses:
            scope = "GLOBAL" if c["is_global"] else "BENUTZERDEFINIERT"
            lines.append(f'[ID:{c["id"]}] "{c["title"]}" ({scope})')
            if c["tags"]:
                lines.append(f'  Tags: {", ".join(c["tags"])}')
            lines.append(f'  Ton: {c["tone"]}')
            if c["description"]:
                lines.append(f'  Beschreibung: {c["description"]}')
            lines.append(f'  Vorschau: {c["content_preview"]}')
            lines.append("")
        lines.append("")

    return "\n".join(lines)


def build_ai_clause_system_prompt(
    clause_catalog: str,
    country_code: str = "DE",
    custom_instructions: str = "",
) -> str:
    """
    Build the complete system prompt for AI clause selection.

    CRITICAL: The prompt instructs the LLM to ONLY select from existing clauses
    and NEVER invent new text. This is the core architectural constraint.
    """
    country_name = {
        "DE": "Deutschland (deutsches Arbeitsrecht)",
        "AT": "Österreich (österreichisches Arbeitsrecht)",
        "IT": "Italien (italienisches Arbeitsrecht)",
        "CH": "Schweiz (Schweizer Arbeitsrecht)",
    }.get(country_code, "Deutschland (deutsches Arbeitsrecht)")

    return f"""Du bist ein KI-Assistent für die Textbaustein-Auswahl in {country_name}.

KERNREGEL: Du darfst KEINEN neuen Vertragstext erfinden. Du wählst ausschließlich
aus den unten aufgeführten benutzerdefinierten Textbausteine aus und stellst sie zusammen.

DEINE AUFGABE:
1. Verstehe den Wunsch des Nutzers (z.B. "Mach den Vertrag wasserdicht")
2. Wähle die passenden Textbausteine aus dem Katalog aus
3. Begründe kurz, warum du jede Textbaustein ausgewählt hast
4. Schlage eine Reihenfolge vor

MATCHING-STRATEGIE:
- Nutze die TAGS der Textbausteine für semantisches Matching
- Nutze den TON (streng/neutral/arbeitnehmerfreundlich) für Stil-Matching
- Nutze die BESCHREIBUNG für inhaltliches Verständnis
- Nutze die KATEGORIE für strukturelle Gruppierung
- "Wasserdicht" → bevorzuge Textbausteine mit Tag "streng" oder Ton "streng"
- "Arbeitnehmerfreundlich" → bevorzuge Textbausteine mit Ton "arbeitnehmerfreundlich"
- "Standard" → bevorzuge Textbausteine mit Ton "neutral"

ANTWORT-FORMAT (strikt JSON):
{{
  "selected_clauses": [
    {{
      "clause_id": <int>,
      "title": "<Textbaustein-Titel>",
      "reason": "<Warum wurde diesen Textbaustein gewählt?>",
      "order": <int, Reihenfolge im Dokument>
    }}
  ],
  "explanation": "<Kurze Erklärung der Gesamtstrategie>",
  "warnings": ["<Optionale Hinweise, z.B. fehlende Textbausteine>"]
}}

{clause_catalog}{custom_instructions}"""


# ══════════════════════════════════════════════════════════════════════════════
# AI CLAUSE SELECTION (Main Entry Point)
# ══════════════════════════════════════════════════════════════════════════════

async def select_clauses_with_ai(
    db: AsyncSession,
    user_id: int,
    user_intent: str,
    country_code: str = "DE",
    document_type: Optional[str] = None,
    category_filter: Optional[str] = None,
    document_type_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Main entry point: Select clauses from user's library using AI.

    Flow:
    1. Load user's active clauses (tenant-isolated)
    2. Build structured clause catalog
    3. Inject catalog into system prompt
    4. Send user intent to LLM
    5. Return selected clause IDs with reasoning

    Args:
        db: Database session
        user_id: Current user ID (for tenant isolation)
        user_intent: Natural language request, e.g. "Mach den Vertrag wasserdicht"
        country_code: DE, AT, IT, CH
        document_type: Optional filter by document type
        category_filter: Optional filter by clause category

    Returns:
        Dict with selected_clauses, explanation, warnings
    """
    # 1. Load clauses (tenant-isolated)
    clauses = await load_user_clauses(
        db=db,
        user_id=user_id,
        country_code=country_code,
        category=category_filter,
    )

    logger.info(
        f"AI clause selection: user={user_id}, intent='{user_intent[:50]}', "
        f"clauses_available={len(clauses)}, country={country_code}"
    )

    # 2. Build catalog prompt
    clause_catalog = build_clause_catalog_prompt(clauses)

    # 2.5 Load custom AI instructions
    from app.services.ai_instructions import get_ai_instructions
    custom_instructions = await get_ai_instructions(db, country_code, document_type_id)

    # 3. Build system prompt
    system_prompt = build_ai_clause_system_prompt(clause_catalog, country_code, custom_instructions)

    # 4. Build user message
    user_message = user_intent
    if document_type:
        user_message = f"Dokumenttyp: {document_type}\n\nAnforderung: {user_intent}"

    # 5. Call LLM
    try:
        llm = await get_llm_service()
    except RuntimeError as e:
        logger.error(f"LLM service unavailable: {e}")
        return {
            "selected_clauses": [],
            "explanation": "LLM-Service nicht verfügbar.",
            "warnings": [f"Fehler: {str(e)}"],
            "clauses_available": len(clauses),
        }

    try:
        _llm_start = time.time()
        response = await llm.chat_json(
            messages=[
                LLMMessage(role="system", content=system_prompt),
                LLMMessage(role="user", content=user_message),
            ],
            config=LLMConfig(
                temperature=0.2,  # Low for deterministic clause selection
                max_tokens=2000,
                json_mode=True,
            ),
        )
        asyncio.create_task(log_llm_call(
            feature="clause_ai",
            latency_ms=int((time.time() - _llm_start) * 1000),
            user_id=str(user_id),
            country_code=country_code,
        ))

        # 6. Parse response
        import json
        result = json.loads(response.content)

        # 7. Validate clause IDs exist in the loaded set
        valid_ids = {c["id"] for c in clauses}
        validated_clauses = []
        for selected in result.get("selected_clauses", []):
            if selected.get("clause_id") in valid_ids:
                validated_clauses.append(selected)
            else:
                logger.warning(
                    f"AI selected non-existent clause ID {selected.get('clause_id')} - filtered out"
                )

        return {
            "selected_clauses": validated_clauses,
            "explanation": result.get("explanation", ""),
            "warnings": result.get("warnings", []),
            "clauses_available": len(clauses),
            "provider": response.provider,
        }

    except json.JSONDecodeError as e:
        asyncio.create_task(log_llm_call(
            feature="clause_ai",
            latency_ms=int((time.time() - _llm_start) * 1000),
            error_message=str(e),
            user_id=str(user_id),
            country_code=country_code,
        ))
        logger.error(f"AI returned invalid JSON: {e}")
        return {
            "selected_clauses": [],
            "explanation": "KI-Antwort konnte nicht verarbeitet werden.",
            "warnings": [f"JSON-Fehler: {str(e)}"],
            "clauses_available": len(clauses),
        }
    except Exception as e:
        asyncio.create_task(log_llm_call(
            feature="clause_ai",
            latency_ms=int((time.time() - _llm_start) * 1000),
            error_message=str(e),
            user_id=str(user_id),
            country_code=country_code,
        ))
        logger.error(f"AI clause selection failed: {e}", exc_info=True)
        return {
            "selected_clauses": [],
            "explanation": "Textbaustein-Auswahl fehlgeschlagen.",
            "warnings": [f"Fehler: {str(e)}"],
            "clauses_available": len(clauses),
        }


# ══════════════════════════════════════════════════════════════════════════════
# CLAUSE ASSEMBLY (Build document content from selected clauses)
# ══════════════════════════════════════════════════════════════════════════════

async def assemble_clauses(
    db: AsyncSession,
    clause_ids: List[int],
    user_id: int,
    form_data: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Load and assemble the full clause content for selected clause IDs.

    Tenant-isolated: Only returns clauses the user is authorized to see.
    Replaces {{placeholders}} with form_data values if provided.
    """
    import re

    if not clause_ids:
        return []

    # Fetch clauses with tenant isolation
    result = await db.execute(
        select(Clause).where(
            and_(
                Clause.id.in_(clause_ids),
                Clause.is_active == True,
                or_(
                    Clause.user_id == user_id,
                    Clause.user_id.is_(None),
                ),
            )
        )
    )
    clauses = {c.id: c for c in result.scalars().all()}

    # Maintain requested order
    assembled = []
    for cid in clause_ids:
        clause = clauses.get(cid)
        if not clause:
            logger.warning(f"Clause {cid} not found or unauthorized for user {user_id}")
            continue

        content = clause.content_html

        # Replace placeholders if form_data provided
        if form_data:
            def replace_placeholder(match):
                key = match.group(1).strip()
                return str(form_data.get(key, match.group(0)))
            content = re.sub(r'\{\{\s*(\w+)\s*\}\}', replace_placeholder, content)

        assembled.append({
            "id": clause.id,
            "title": clause.title,
            "category": clause.category,
            "content_html": content,
            "version": clause.version,
        })

    return assembled
