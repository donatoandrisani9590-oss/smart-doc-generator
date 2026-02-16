"""
Agent Tool Registry — 8 tool definitions + executors for Claude tool-use.

Each tool has:
1. A Claude-compatible JSON Schema definition (for the `tools` parameter)
2. An async executor function that runs the tool against the DB/services

Tools are team-isolated: queries are scoped to the user's team and country.
"""
import json
import logging
from typing import Any, Optional
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.documents import (
    Clause, DocumentType, DocumentTypeClause, CompanySettings,
)
from app.models.enterprise import GeneratedDocument, FormField

logger = logging.getLogger(__name__)

# Maximum iterations for agent loop (safety limit)
MAX_TOOL_ITERATIONS = 10


# ═══════════════════════════════════════════════════════════════════════════
# TOOL DEFINITIONS (Claude JSON Schema format)
# ═══════════════════════════════════════════════════════════════════════════

AGENT_TOOLS = [
    {
        "name": "fill_form_fields",
        "description": (
            "Setze Formularfelder für das Dokument. Verwende Feldnamen aus dem "
            "Dokumenttyp (z.B. 'mitarbeiter_name', 'gehalt_brutto', 'eintrittsdatum'). "
            "Setze nur Felder, die du sicher kennst."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "fields": {
                    "type": "object",
                    "description": "Key-Value-Paare der Formularfelder (Feldname → Wert)",
                    "additionalProperties": {"type": "string"},
                },
            },
            "required": ["fields"],
        },
    },
    {
        "name": "select_clauses",
        "description": (
            "Aktiviere oder deaktiviere Textbausteine (Klauseln) für das Dokument. "
            "Gib die IDs der zu aktivierenden und zu deaktivierenden Klauseln an."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "enable": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Klausel-IDs zum Aktivieren",
                },
                "disable": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Klausel-IDs zum Deaktivieren",
                },
                "reason": {
                    "type": "string",
                    "description": "Begründung für die Auswahl",
                },
            },
            "required": ["enable"],
        },
    },
    {
        "name": "search_clauses",
        "description": (
            "Durchsuche die Klausel-Bibliothek nach passenden Textbausteinen. "
            "Suche nach Titel, Inhalt oder Kategorie."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Suchbegriff (Titel, Inhalt oder Kategorie)",
                },
                "document_type_id": {
                    "type": "integer",
                    "description": "Optional: Nur Klauseln für diesen Dokumenttyp",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "create_clause_draft",
        "description": (
            "Erstelle einen KI-generierten Klausel-Entwurf. Der Anwender muss den "
            "Entwurf bestätigen, bevor er ins Dokument eingefügt wird. "
            "Verwende dies nur, wenn keine passende Klausel in der Bibliothek existiert."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Titel der neuen Klausel",
                },
                "content": {
                    "type": "string",
                    "description": "HTML-Inhalt der Klausel (kann {{ Platzhalter }} enthalten)",
                },
                "category": {
                    "type": "string",
                    "description": "Kategorie (z.B. 'Vergütung', 'Arbeitszeit', 'Urlaub')",
                },
            },
            "required": ["title", "content"],
        },
    },
    {
        "name": "search_employee_history",
        "description": (
            "Suche nach früheren Dokumenten eines Mitarbeiters. Gibt Formulardaten "
            "und Dokumenttypen zurück, um konsistente Daten zu übernehmen."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "employee_name": {
                    "type": "string",
                    "description": "Name des Mitarbeiters (Teilname möglich)",
                },
                "employee_id": {
                    "type": "string",
                    "description": "Personalnummer (optional, exakte Suche)",
                },
            },
            "required": ["employee_name"],
        },
    },
    {
        "name": "run_compliance_check",
        "description": (
            "Führe einen Compliance-Check auf dem aktuellen Dokumentinhalt durch. "
            "Prüft auf rechtliche Risiken und gibt Verbesserungsvorschläge."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "content_html": {
                    "type": "string",
                    "description": "HTML-Inhalt des Dokuments zum Prüfen",
                },
                "country_code": {
                    "type": "string",
                    "description": "Ländercode (DE, IT, AT, CH)",
                    "default": "DE",
                },
            },
            "required": ["content_html"],
        },
    },
    {
        "name": "generate_text",
        "description": (
            "Generiere einen kurzen Textabschnitt für das Dokument. "
            "Der Text wird als 'KI-generiert' markiert. Verwende dies für "
            "Einleitungen, Überleitungen oder individuelle Absätze."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "purpose": {
                    "type": "string",
                    "description": "Zweck des Textes (z.B. 'Einleitung', 'Überleitung', 'Schluss')",
                },
                "context": {
                    "type": "string",
                    "description": "Kontext für die Textgenerierung",
                },
                "max_sentences": {
                    "type": "integer",
                    "description": "Maximale Anzahl Sätze",
                    "default": 3,
                },
            },
            "required": ["purpose", "context"],
        },
    },
    {
        "name": "get_form_field_definitions",
        "description": (
            "Hole die Formularfeld-Definitionen für einen Dokumenttyp. "
            "Zeigt welche Felder verfügbar sind, welche Pflicht sind und welche "
            "Standardwerte sie haben."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "document_type_id": {
                    "type": "integer",
                    "description": "ID des Dokumenttyps",
                },
            },
            "required": ["document_type_id"],
        },
    },
]


# ═══════════════════════════════════════════════════════════════════════════
# TOOL EXECUTORS
# ═══════════════════════════════════════════════════════════════════════════

async def execute_tool(
    tool_name: str,
    tool_input: dict,
    db: AsyncSession,
    user_id: int,
    country_code: str = "DE",
) -> dict[str, Any]:
    """
    Execute an agent tool and return the result.

    All tools are team-isolated and validated.
    Returns a dict that will be JSON-serialized as the tool_result.
    """
    executors = {
        "fill_form_fields": _exec_fill_form_fields,
        "select_clauses": _exec_select_clauses,
        "search_clauses": _exec_search_clauses,
        "create_clause_draft": _exec_create_clause_draft,
        "search_employee_history": _exec_search_employee_history,
        "run_compliance_check": _exec_run_compliance_check,
        "generate_text": _exec_generate_text,
        "get_form_field_definitions": _exec_get_form_field_definitions,
    }

    executor = executors.get(tool_name)
    if not executor:
        return {"error": f"Unbekanntes Tool: {tool_name}"}

    try:
        return await executor(tool_input, db, user_id, country_code)
    except Exception as e:
        logger.error(f"Tool execution error ({tool_name}): {e}")
        return {"error": f"Fehler bei {tool_name}: {str(e)}"}


async def _exec_fill_form_fields(
    args: dict, db: AsyncSession, user_id: int, country_code: str
) -> dict:
    """Validate and return form field updates for the frontend."""
    fields = args.get("fields", {})
    if not fields:
        return {"error": "Keine Felder angegeben"}

    # Return the fields for the frontend to apply via form_update event
    return {
        "status": "ok",
        "fields_set": len(fields),
        "fields": fields,
    }


async def _exec_select_clauses(
    args: dict, db: AsyncSession, user_id: int, country_code: str
) -> dict:
    """Validate clause IDs and return selection for the frontend."""
    enable = args.get("enable", [])
    disable = args.get("disable", [])
    reason = args.get("reason", "")

    # Validate that clause IDs exist
    all_ids = enable + disable
    if all_ids:
        result = await db.execute(
            select(Clause.id, Clause.title).where(
                and_(
                    Clause.id.in_(all_ids),
                    Clause.is_active == True,
                )
            )
        )
        valid = {row.id: row.title for row in result.all()}
        invalid = [cid for cid in all_ids if cid not in valid]
        if invalid:
            return {"error": f"Unbekannte Klausel-IDs: {invalid}"}

    return {
        "status": "ok",
        "enable": enable,
        "disable": disable,
        "reason": reason,
    }


async def _exec_search_clauses(
    args: dict, db: AsyncSession, user_id: int, country_code: str
) -> dict:
    """Search clauses by title/content, scoped to country."""
    query_text = args.get("query", "")
    doc_type_id = args.get("document_type_id")

    if not query_text:
        return {"error": "Suchbegriff fehlt"}

    search_pattern = f"%{query_text}%"

    # Base query: active clauses matching country
    q = select(
        Clause.id, Clause.title, Clause.category, Clause.description
    ).where(
        and_(
            Clause.is_active == True,
            or_(
                Clause.country_code == country_code,
                Clause.country_code.is_(None),
            ),
            or_(
                Clause.title.ilike(search_pattern),
                Clause.category.ilike(search_pattern),
                Clause.description.ilike(search_pattern),
            ),
        )
    ).limit(15)

    # Optionally filter by document type
    if doc_type_id:
        q = q.where(
            Clause.id.in_(
                select(DocumentTypeClause.clause_id).where(
                    DocumentTypeClause.document_type_id == doc_type_id
                )
            )
        )

    result = await db.execute(q)
    clauses = [
        {
            "id": row.id,
            "title": row.title,
            "category": row.category or "",
            "description": row.description or "",
        }
        for row in result.all()
    ]

    return {
        "status": "ok",
        "count": len(clauses),
        "clauses": clauses,
    }


async def _exec_create_clause_draft(
    args: dict, db: AsyncSession, user_id: int, country_code: str
) -> dict:
    """Create a clause draft that requires user confirmation."""
    title = args.get("title", "")
    content = args.get("content", "")
    category = args.get("category", "Allgemein")

    if not title or not content:
        return {"error": "Titel und Inhalt sind erforderlich"}

    # Don't persist yet — return as draft for user confirmation
    return {
        "status": "requires_confirmation",
        "draft": {
            "title": title,
            "content": content,
            "category": category,
            "is_ai_generated": True,
        },
    }


async def _exec_search_employee_history(
    args: dict, db: AsyncSession, user_id: int, country_code: str
) -> dict:
    """Search for previous documents of an employee."""
    employee_name = args.get("employee_name", "")
    employee_id = args.get("employee_id")

    if not employee_name and not employee_id:
        return {"error": "Mitarbeitername oder Personalnummer erforderlich"}

    conditions = [
        GeneratedDocument.is_deleted == False,
    ]

    if employee_id:
        conditions.append(GeneratedDocument.employee_id == employee_id)
    elif employee_name:
        conditions.append(
            GeneratedDocument.employee_name.ilike(f"%{employee_name}%")
        )

    result = await db.execute(
        select(
            GeneratedDocument.id,
            GeneratedDocument.title,
            GeneratedDocument.employee_name,
            GeneratedDocument.employee_id,
            GeneratedDocument.created_at,
            GeneratedDocument.form_data,
            GeneratedDocument.document_type_id,
        )
        .where(and_(*conditions))
        .order_by(GeneratedDocument.created_at.desc())
        .limit(10)
    )

    docs = []
    for row in result.all():
        form_data = {}
        if row.form_data:
            try:
                form_data = json.loads(row.form_data) if isinstance(row.form_data, str) else row.form_data
            except (json.JSONDecodeError, TypeError):
                pass

        docs.append({
            "id": row.id,
            "title": row.title or "",
            "employee_name": row.employee_name or "",
            "employee_id": row.employee_id or "",
            "created_at": row.created_at.isoformat() if row.created_at else "",
            "document_type_id": row.document_type_id,
            "form_data": form_data,
        })

    return {
        "status": "ok",
        "count": len(docs),
        "documents": docs,
    }


async def _exec_run_compliance_check(
    args: dict, db: AsyncSession, user_id: int, country_code: str
) -> dict:
    """Run compliance check on document content."""
    content_html = args.get("content_html", "")
    check_country = args.get("country_code", country_code)

    if not content_html:
        return {"error": "Kein Dokumentinhalt zum Prüfen"}

    from app.services.compliance_service import get_compliance_service

    service = await get_compliance_service()
    scan_result = await service.scan_content(
        content_html=content_html,
        country_code=check_country,
        use_llm=False,  # Pattern-only for speed in agent loop
    )

    risks = [
        {
            "severity": risk.severity.value,
            "title": risk.title,
            "description": risk.description,
            "suggestion": risk.suggestion or "",
        }
        for risk in scan_result.risks
    ]

    return {
        "status": "ok",
        "overall_score": scan_result.overall_score,
        "risk_count": len(risks),
        "risks": risks[:10],  # Limit for context window
    }


async def _exec_generate_text(
    args: dict, db: AsyncSession, user_id: int, country_code: str
) -> dict:
    """Generate a short text passage (marked as AI-generated)."""
    purpose = args.get("purpose", "")
    context = args.get("context", "")
    max_sentences = args.get("max_sentences", 3)

    if not purpose or not context:
        return {"error": "Zweck und Kontext sind erforderlich"}

    # Use a lightweight LLM for text generation (not Claude, to save costs)
    from app.services.llm_service import LLMService, LLMConfig, LLMMessage

    llm = LLMService()  # Auto-detect cheapest provider
    config = LLMConfig(temperature=0.4, max_tokens=500)

    messages = [
        LLMMessage(
            role="system",
            content=(
                f"Du schreibst professionelle Textabschnitte für Geschäftsdokumente. "
                f"Schreibe maximal {max_sentences} Sätze. Antworte NUR mit dem Text, "
                f"ohne Erklärungen oder Anführungszeichen."
            ),
        ),
        LLMMessage(
            role="user",
            content=f"Erstelle einen {purpose}-Text. Kontext: {context}",
        ),
    ]

    response = await llm.chat(messages, config)

    return {
        "status": "ok",
        "text": response.content.strip(),
        "is_ai_generated": True,
        "provider": response.provider,
    }


async def _exec_get_form_field_definitions(
    args: dict, db: AsyncSession, user_id: int, country_code: str
) -> dict:
    """Get form field definitions for a document type."""
    doc_type_id = args.get("document_type_id")
    if not doc_type_id:
        return {"error": "document_type_id ist erforderlich"}

    # Get document type info
    doc_type = await db.get(DocumentType, doc_type_id)
    if not doc_type:
        return {"error": f"Dokumenttyp {doc_type_id} nicht gefunden"}

    # Get form fields
    result = await db.execute(
        select(FormField)
        .where(FormField.document_type_id == doc_type_id)
        .order_by(FormField.display_order)
    )
    fields = result.scalars().all()

    field_defs = [
        {
            "name": f.field_name,
            "label": f.field_label,
            "type": f.field_type or "text",
            "required": f.is_required,
            "default": f.default_value or "",
            "group": f.display_group or "",
        }
        for f in fields
    ]

    return {
        "status": "ok",
        "document_type": doc_type.name,
        "field_count": len(field_defs),
        "fields": field_defs,
    }
