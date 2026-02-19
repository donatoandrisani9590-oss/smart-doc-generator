"""
Agent Tool Registry — 8 tool definitions + executors for LLM tool-use.

Each tool has:
1. An OpenAI-compatible JSON Schema definition (for the `tools` parameter)
2. An async executor function that runs the tool against the DB/services

Supports Groq, Mistral, and any OpenAI-compatible API.
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
from app.models.enterprise import GeneratedDocument, FormField, DocumentDraft, OnboardingJob
from app.services.pii_sanitizer import sanitize_employee_history

logger = logging.getLogger(__name__)

# Maximum iterations for agent loop (safety limit)
MAX_TOOL_ITERATIONS = 10


# ═══════════════════════════════════════════════════════════════════════════
# TOOL DEFINITIONS (OpenAI-compatible format for Groq/Mistral/OpenAI)
# ═══════════════════════════════════════════════════════════════════════════

AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "fill_form_fields",
            "description": (
                "Setze Formularfelder für das Dokument. Verwende Feldnamen aus dem "
                "Dokumenttyp (z.B. 'mitarbeiter_name', 'gehalt_brutto', 'eintrittsdatum'). "
                "Setze nur Felder, die du sicher kennst."
            ),
            "parameters": {
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
    },
    {
        "type": "function",
        "function": {
            "name": "select_clauses",
            "description": (
                "Aktiviere oder deaktiviere Textbausteine für das Dokument. "
                "Gib die IDs der zu aktivierenden und zu deaktivierenden Textbausteine an."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "enable": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "Textbaustein-IDs zum Aktivieren",
                    },
                    "disable": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "Textbaustein-IDs zum Deaktivieren",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Begründung für die Auswahl",
                    },
                },
                "required": ["enable"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_clauses",
            "description": (
                "Durchsuche die Textbaustein-Bibliothek nach passenden Textbausteinen. "
                "Suche nach Titel, Inhalt oder Kategorie."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Suchbegriff (Titel, Inhalt oder Kategorie)",
                    },
                    "document_type_id": {
                        "type": "integer",
                        "description": "Optional: Nur Textbausteine für diesen Dokumenttyp",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_clause_draft",
            "description": (
                "Erstelle einen KI-generierten Textbaustein-Entwurf. Der Anwender muss den "
                "Entwurf bestätigen, bevor er ins Dokument eingefügt wird. "
                "Verwende dies nur, wenn kein passender Textbaustein in der Bibliothek existiert."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Titel des neuen Textbausteins",
                    },
                    "content": {
                        "type": "string",
                        "description": "HTML-Inhalt des Textbausteins (kann {{ Platzhalter }} enthalten)",
                    },
                    "category": {
                        "type": "string",
                        "description": "Kategorie (z.B. 'Vergütung', 'Arbeitszeit', 'Urlaub')",
                    },
                },
                "required": ["title", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_employee_history",
            "description": (
                "Suche nach früheren Dokumenten eines Mitarbeiters. Gibt Formulardaten "
                "und Dokumenttypen zurück, um konsistente Daten zu übernehmen."
            ),
            "parameters": {
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
    },
    {
        "type": "function",
        "function": {
            "name": "run_compliance_check",
            "description": (
                "Führe einen Compliance-Check auf dem aktuellen Dokumentinhalt durch. "
                "Prüft auf rechtliche Risiken und gibt Verbesserungsvorschläge."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "content_html": {
                        "type": "string",
                        "description": "HTML-Inhalt des Dokuments zum Prüfen",
                    },
                    "country_code": {
                        "type": "string",
                        "description": "Ländercode (DE, IT, AT, CH)",
                    },
                },
                "required": ["content_html"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_text",
            "description": (
                "Generiere einen kurzen Textabschnitt für das Dokument. "
                "Der Text wird als 'KI-generiert' markiert. Verwende dies für "
                "Einleitungen, Überleitungen oder individuelle Absätze."
            ),
            "parameters": {
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
                    },
                },
                "required": ["purpose", "context"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_form_field_definitions",
            "description": (
                "Hole die Formularfeld-Definitionen für einen Dokumenttyp. "
                "Zeigt welche Felder verfügbar sind, welche Pflicht sind und welche "
                "Standardwerte sie haben."
            ),
            "parameters": {
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
    },
    {
        "type": "function",
        "function": {
            "name": "update_package_draft",
            "description": (
                "Aktualisiere einen einzelnen Entwurf aus einem Onboarding-Paket. "
                "Kann Formularfelder ändern. Verwende die Draft-ID aus dem Paket-Ergebnis."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "draft_id": {
                        "type": "integer",
                        "description": "ID des zu aktualisierenden Entwurfs",
                    },
                    "field_updates": {
                        "type": "object",
                        "description": "Key-Value-Paare der zu ändernden Felder",
                        "additionalProperties": {"type": "string"},
                    },
                },
                "required": ["draft_id", "field_updates"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "apply_to_all_drafts",
            "description": (
                "Wende Feldänderungen auf ALLE Entwürfe eines Onboarding-Pakets an. "
                "Nützlich für gemeinsame Felder wie Adresse, Name, Eintrittsdatum."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {
                        "type": "integer",
                        "description": "ID des Onboarding-Jobs",
                    },
                    "field_updates": {
                        "type": "object",
                        "description": "Key-Value-Paare der zu ändernden Felder",
                        "additionalProperties": {"type": "string"},
                    },
                },
                "required": ["job_id", "field_updates"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_user_input",
            "description": (
                "Zeige dem Anwender ein interaktives Widget zur Eingabe. "
                "Verwende dies anstatt in Text nach Informationen zu fragen. "
                "Der Anwender kann dann per Klick oder Eingabe antworten."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "widget_type": {
                        "type": "string",
                        "enum": ["chips", "input", "slider"],
                        "description": "Art des Widgets: chips (Schnellauswahl), input (Freitext), slider (Bereichswahl)",
                    },
                    "field_key": {
                        "type": "string",
                        "description": "Formularfeld-Name (z.B. 'position', 'gehalt', 'eintrittsdatum')",
                    },
                    "label": {
                        "type": "string",
                        "description": "Frage oder Label für das Widget",
                    },
                    "options": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "value": {"type": "string"},
                                "label": {"type": "string"},
                                "is_default": {"type": "boolean"},
                            },
                            "required": ["value", "label"],
                        },
                        "description": "Optionen für chips Widget",
                    },
                    "placeholder": {
                        "type": "string",
                        "description": "Platzhaltertext für input Widget",
                    },
                    "input_type": {
                        "type": "string",
                        "enum": ["text", "date", "number", "currency"],
                        "description": "Eingabetyp für input Widget",
                    },
                    "min": {
                        "type": "number",
                        "description": "Minimalwert für slider",
                    },
                    "max": {
                        "type": "number",
                        "description": "Maximalwert für slider",
                    },
                    "step": {
                        "type": "number",
                        "description": "Schrittweite für slider",
                    },
                    "unit": {
                        "type": "string",
                        "description": "Einheit für Anzeige (z.B. '€', 'Tage', 'Stunden')",
                    },
                    "hint": {
                        "type": "string",
                        "description": "Kontexthinweis (z.B. 'Dein Team zahlt typischerweise 55.000-75.000€')",
                    },
                },
                "required": ["widget_type", "field_key", "label"],
            },
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
        "update_package_draft": _exec_update_package_draft,
        "apply_to_all_drafts": _exec_apply_to_all_drafts,
        "request_user_input": _exec_request_user_input,
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
            return {"error": f"Unbekannte Textbaustein-IDs: {invalid}"}

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
    """Search for previous documents of an employee (team-isolated, PII-sanitized)."""
    employee_name = args.get("employee_name", "")
    employee_id = args.get("employee_id")

    if not employee_name and not employee_id:
        return {"error": "Mitarbeitername oder Personalnummer erforderlich"}

    conditions = [
        GeneratedDocument.is_deleted == False,
        # DSGVO: Team-Isolation — nur eigene Dokumente sichtbar
        GeneratedDocument.created_by_id == user_id,
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

    # DSGVO Art. 5(1c): PII-Sanitierung bevor Daten an Claude gesendet werden
    sanitized_docs = sanitize_employee_history(docs)

    return {
        "status": "ok",
        "count": len(sanitized_docs),
        "documents": sanitized_docs,
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


async def _exec_update_package_draft(
    args: dict, db: AsyncSession, user_id: int, country_code: str
) -> dict:
    """Update a single draft's form_data."""
    draft_id = args.get("draft_id")
    field_updates = args.get("field_updates", {})

    if not draft_id or not field_updates:
        return {"error": "draft_id und field_updates sind erforderlich"}

    draft = await db.get(DocumentDraft, draft_id)
    if not draft or draft.user_id != str(user_id):
        return {"error": f"Entwurf {draft_id} nicht gefunden"}

    # Merge updates into existing form_data
    try:
        form_data = json.loads(draft.form_data) if draft.form_data else {}
    except (json.JSONDecodeError, TypeError):
        form_data = {}

    form_data.update(field_updates)
    draft.form_data = json.dumps(form_data, ensure_ascii=False)
    await db.commit()

    return {
        "status": "ok",
        "draft_id": draft_id,
        "fields_updated": len(field_updates),
        "draft_name": draft.name or "",
    }


async def _exec_apply_to_all_drafts(
    args: dict, db: AsyncSession, user_id: int, country_code: str
) -> dict:
    """Update all drafts in an onboarding job."""
    job_id = args.get("job_id")
    field_updates = args.get("field_updates", {})

    if not job_id or not field_updates:
        return {"error": "job_id und field_updates sind erforderlich"}

    job = await db.get(OnboardingJob, job_id)
    if not job or job.user_id != user_id:
        return {"error": f"Job {job_id} nicht gefunden"}

    draft_ids = json.loads(job.draft_ids) if job.draft_ids else []
    updated_count = 0

    for did in draft_ids:
        draft = await db.get(DocumentDraft, did)
        if not draft or draft.user_id != str(user_id):
            continue

        try:
            form_data = json.loads(draft.form_data) if draft.form_data else {}
        except (json.JSONDecodeError, TypeError):
            form_data = {}

        form_data.update(field_updates)
        draft.form_data = json.dumps(form_data, ensure_ascii=False)
        updated_count += 1

    await db.commit()

    return {
        "status": "ok",
        "job_id": job_id,
        "drafts_updated": updated_count,
        "fields_updated": len(field_updates),
    }


async def _exec_request_user_input(
    args: dict, db: AsyncSession, user_id: int, country_code: str
) -> dict:
    """Return widget data to be rendered in the frontend chat."""
    widget_type = args.get("widget_type", "chips")
    field_key = args.get("field_key", "")
    label = args.get("label", "")

    if not field_key or not label:
        return {"error": "field_key und label sind erforderlich"}

    return {
        "status": "ok",
        "widget": {
            "widget_type": widget_type,
            "field_key": field_key,
            "label": label,
            "options": args.get("options"),
            "placeholder": args.get("placeholder"),
            "input_type": args.get("input_type"),
            "min": args.get("min"),
            "max": args.get("max"),
            "step": args.get("step"),
            "unit": args.get("unit"),
            "hint": args.get("hint"),
        },
    }
