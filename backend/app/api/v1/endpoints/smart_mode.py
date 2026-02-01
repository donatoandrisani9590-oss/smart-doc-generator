"""
Smart Mode API: Conversational document creation.

Features:
- Dynamic field prompts based on document type
- LLM-powered form filling assistance
- Progressive disclosure of required fields
- Quick document generation

Privacy: Uses Mistral (EU) or Ollama (local) - no US data transfer.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import json

from app.db import get_db
from app.api.deps import get_current_user
from app.models.documents import DocumentType
from app.services.llm_service import LLMService, LLMMessage, LLMConfig, get_llm_service

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════

class SmartField(BaseModel):
    """A form field with smart defaults and hints."""
    name: str
    label: str
    field_type: str  # text, number, date, boolean, select
    required: bool = True
    placeholder: str = ""
    hint: str = ""
    options: List[str] = []  # For select fields
    default_value: Optional[str] = None
    order: int = 0


class SmartModeConfig(BaseModel):
    """Configuration for smart mode session."""
    document_type_id: int
    document_type_name: str
    priority_fields: List[SmartField]  # Most important fields first
    optional_fields: List[SmartField]  # Can be skipped
    suggested_title: str = ""
    estimated_time: str = "2 Minuten"


class SmartModeStartRequest(BaseModel):
    """Request to start smart mode."""
    document_type_id: int
    initial_context: Optional[Dict[str, Any]] = None  # From chat extraction


class SmartModeStartResponse(BaseModel):
    """Response with smart mode configuration."""
    config: SmartModeConfig
    first_question: str
    prefilled_data: Dict[str, Any] = {}


class SmartModeAnswerRequest(BaseModel):
    """User answer in smart mode."""
    document_type_id: int
    current_data: Dict[str, Any]
    user_input: str
    current_field: Optional[str] = None


class SmartModeAnswerResponse(BaseModel):
    """Response after processing user answer."""
    extracted_data: Dict[str, Any]  # Updated form data
    next_question: Optional[str] = None
    next_field: Optional[str] = None
    is_complete: bool = False
    completion_percentage: int = 0
    provider: str = "unknown"


class SmartModeGenerateRequest(BaseModel):
    """Request to generate document from smart mode data."""
    document_type_id: int
    form_data: Dict[str, Any]
    title: str


# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENT TYPE FIELD CONFIGURATIONS
# ═══════════════════════════════════════════════════════════════════════════

# Default field configurations per document category
# Erweitert für alle HR-Dokumenttypen (Phase 1-3)
DEFAULT_FIELD_CONFIGS: Dict[str, List[Dict[str, Any]]] = {
    # ==========================================================================
    # PHASE 1: EINSTELLUNG & ONBOARDING
    # ==========================================================================
    "Arbeitsvertrag": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1,
         "hint": "Familienname des Mitarbeiters"},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2,
         "hint": "Vorname des Mitarbeiters"},
        {"name": "position", "label": "Position", "type": "text", "required": True, "priority": 3,
         "hint": "z.B. Software Developer, Marketing Manager"},
        {"name": "gehalt", "label": "Monatsgehalt (brutto)", "type": "number", "required": True, "priority": 4,
         "hint": "Bruttogehalt in Euro"},
        {"name": "eintrittsdatum", "label": "Eintrittsdatum", "type": "date", "required": True, "priority": 5,
         "hint": "Wann beginnt das Arbeitsverhältnis?"},
        {"name": "wochenstunden", "label": "Wochenstunden", "type": "number", "required": False, "priority": 6,
         "default": "40", "hint": "Arbeitszeit pro Woche"},
        {"name": "probezeit", "label": "Probezeit", "type": "select", "required": False, "priority": 7,
         "options": ["Keine", "3 Monate", "6 Monate"], "default": "6 Monate"},
        {"name": "urlaubstage", "label": "Urlaubstage", "type": "number", "required": False, "priority": 8,
         "default": "30", "hint": "Jahresurlaub in Tagen"},
    ],
    "Einstellungszusage": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "position", "label": "Position", "type": "text", "required": True, "priority": 3},
        {"name": "gehalt", "label": "Monatsgehalt (brutto)", "type": "number", "required": True, "priority": 4},
        {"name": "eintrittsdatum", "label": "Geplanter Eintrittsdatum", "type": "date", "required": True, "priority": 5},
    ],
    "Absageschreiben": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "position", "label": "Beworbene Position", "type": "text", "required": False, "priority": 3},
    ],
    "Verschwiegenheit": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
    ],

    # ==========================================================================
    # PHASE 2: LAUFENDES ARBEITSVERHÄLTNIS
    # ==========================================================================
    "Nachtrag": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "urspruenglicher_vertrag", "label": "Datum ursprünglicher Vertrag", "type": "date", "required": True, "priority": 3,
         "hint": "Datum des Originalvertrags"},
        {"name": "aenderung", "label": "Was wird geändert?", "type": "text", "required": True, "priority": 4,
         "hint": "z.B. Gehalt, Arbeitszeit, Position"},
    ],
    "Gehaltserhöhung": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "neues_gehalt", "label": "Neues Monatsgehalt (brutto)", "type": "number", "required": True, "priority": 3},
        {"name": "gueltig_ab", "label": "Gültig ab", "type": "date", "required": True, "priority": 4},
    ],
    "Beförderung": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "neue_position", "label": "Neue Position", "type": "text", "required": True, "priority": 3},
        {"name": "gueltig_ab", "label": "Gültig ab", "type": "date", "required": True, "priority": 4},
        {"name": "neues_gehalt", "label": "Neues Monatsgehalt", "type": "number", "required": False, "priority": 5},
    ],
    "Abmahnung": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "vorfall_datum", "label": "Datum des Vorfalls", "type": "date", "required": True, "priority": 3},
        {"name": "vorfall_beschreibung", "label": "Beschreibung des Vorfalls", "type": "text", "required": True, "priority": 4,
         "hint": "Was ist passiert?"},
    ],
    "Elternzeit": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "elternzeit_von", "label": "Elternzeit von", "type": "date", "required": True, "priority": 3},
        {"name": "elternzeit_bis", "label": "Elternzeit bis", "type": "date", "required": True, "priority": 4},
    ],
    "Homeoffice": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "homeoffice_tage", "label": "Homeoffice-Tage pro Woche", "type": "number", "required": False, "priority": 3,
         "default": "2", "hint": "z.B. 2 oder 3 Tage"},
    ],
    "Firmenwagen": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "fahrzeugtyp", "label": "Fahrzeugtyp", "type": "text", "required": False, "priority": 3,
         "hint": "z.B. BMW 3er, VW Passat"},
    ],
    "Bonus": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "bonus_betrag", "label": "Bonusbetrag", "type": "number", "required": True, "priority": 3},
        {"name": "bonus_grund", "label": "Grund/Anlass", "type": "text", "required": False, "priority": 4},
    ],
    "Fortbildung": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "fortbildung_thema", "label": "Fortbildungsthema", "type": "text", "required": True, "priority": 3,
         "hint": "z.B. SAP Grundlagen, Projektmanagement"},
        {"name": "fortbildung_kosten", "label": "Kosten", "type": "number", "required": False, "priority": 4},
    ],
    "Überstunden": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "ueberstunden_anzahl", "label": "Anzahl Überstunden", "type": "number", "required": True, "priority": 3},
    ],

    # ==========================================================================
    # PHASE 3: BEENDIGUNG
    # ==========================================================================
    "Kündigung": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "kuendigungsdatum", "label": "Kündigungsdatum", "type": "date", "required": True, "priority": 3,
         "hint": "Wann endet das Arbeitsverhältnis?"},
        {"name": "kuendigungsgrund", "label": "Kündigungsgrund", "type": "select", "required": False, "priority": 4,
         "options": ["Ordentlich", "Außerordentlich", "Betriebsbedingt", "Personenbedingt", "Verhaltensbedingt"]},
    ],
    "Aufhebungsvertrag": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "beendigungsdatum", "label": "Beendigungsdatum", "type": "date", "required": True, "priority": 3},
        {"name": "abfindung", "label": "Abfindungsbetrag", "type": "number", "required": False, "priority": 4,
         "hint": "Abfindung in Euro (falls vereinbart)"},
    ],
    "Zeugnis": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "position", "label": "Position", "type": "text", "required": True, "priority": 3},
        {"name": "beschaeftigt_von", "label": "Beschäftigt von", "type": "date", "required": True, "priority": 4},
        {"name": "beschaeftigt_bis", "label": "Beschäftigt bis", "type": "date", "required": True, "priority": 5},
        {"name": "zeugnisart", "label": "Zeugnisart", "type": "select", "required": True, "priority": 6,
         "options": ["Einfaches Zeugnis", "Qualifiziertes Zeugnis", "Zwischenzeugnis"]},
    ],
    "Freistellung": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
        {"name": "freistellung_von", "label": "Freistellung von", "type": "date", "required": True, "priority": 3},
        {"name": "freistellung_bis", "label": "Freistellung bis", "type": "date", "required": True, "priority": 4},
        {"name": "freistellung_art", "label": "Art der Freistellung", "type": "select", "required": False, "priority": 5,
         "options": ["Bezahlt", "Unbezahlt", "Widerruflich", "Unwiderruflich"]},
    ],

    # ==========================================================================
    # FALLBACK
    # ==========================================================================
    "default": [
        {"name": "nachname", "label": "Nachname", "type": "text", "required": True, "priority": 1},
        {"name": "vorname", "label": "Vorname", "type": "text", "required": True, "priority": 2},
    ],
}


def get_field_config_for_doctype(doc_type_name: str) -> List[Dict[str, Any]]:
    """Get field configuration based on document type name."""
    # Try exact match first
    for key in DEFAULT_FIELD_CONFIGS:
        if key.lower() in doc_type_name.lower():
            return DEFAULT_FIELD_CONFIGS[key]
    return DEFAULT_FIELD_CONFIGS["default"]


def build_smart_fields(field_configs: List[Dict[str, Any]]) -> tuple[List[SmartField], List[SmartField]]:
    """Convert field configs to SmartField objects, split by priority."""
    priority_fields = []
    optional_fields = []

    for config in sorted(field_configs, key=lambda x: x.get("priority", 99)):
        field = SmartField(
            name=config["name"],
            label=config["label"],
            field_type=config.get("type", "text"),
            required=config.get("required", True),
            placeholder=config.get("placeholder", ""),
            hint=config.get("hint", ""),
            options=config.get("options", []),
            default_value=config.get("default"),
            order=config.get("priority", 99)
        )

        if config.get("required", True):
            priority_fields.append(field)
        else:
            optional_fields.append(field)

    return priority_fields, optional_fields


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/start", response_model=SmartModeStartResponse)
async def start_smart_mode(
    request: SmartModeStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Start a smart mode session for document creation.

    Returns the configuration with priority fields and a first question.
    """
    # Load document type
    doc_type = await db.get(DocumentType, request.document_type_id)
    if not doc_type:
        raise HTTPException(status_code=404, detail="Dokumenttyp nicht gefunden")

    # Get field configuration
    field_configs = get_field_config_for_doctype(doc_type.name)
    priority_fields, optional_fields = build_smart_fields(field_configs)

    # Build config
    config = SmartModeConfig(
        document_type_id=doc_type.id,
        document_type_name=doc_type.name,
        priority_fields=priority_fields,
        optional_fields=optional_fields,
        suggested_title=f"{doc_type.name} - Neu",
        estimated_time=f"{len(priority_fields)} Minuten"
    )

    # Determine first question
    first_field = priority_fields[0] if priority_fields else None
    first_question = ""
    if first_field:
        first_question = f"Wie lautet der {first_field.label}?"
        if first_field.hint:
            first_question += f" ({first_field.hint})"

    # Prefill from initial context if available
    prefilled_data = {}
    if request.initial_context:
        for field in priority_fields + optional_fields:
            if field.name in request.initial_context:
                prefilled_data[field.name] = request.initial_context[field.name]
            elif field.default_value:
                prefilled_data[field.name] = field.default_value

    return SmartModeStartResponse(
        config=config,
        first_question=first_question,
        prefilled_data=prefilled_data
    )


@router.post("/answer", response_model=SmartModeAnswerResponse)
async def process_smart_mode_answer(
    request: SmartModeAnswerRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Process user answer and determine next question.

    Uses LLM to extract structured data from natural language answers.
    """
    # Load document type
    doc_type = await db.get(DocumentType, request.document_type_id)
    if not doc_type:
        raise HTTPException(status_code=404, detail="Dokumenttyp nicht gefunden")

    # Get field configuration
    field_configs = get_field_config_for_doctype(doc_type.name)
    priority_fields, optional_fields = build_smart_fields(field_configs)
    all_fields = priority_fields + optional_fields

    # Merge current data with user input
    updated_data = dict(request.current_data)

    # If we have a current field, try to parse the answer
    if request.current_field:
        # Direct assignment for now (LLM parsing can be added later)
        updated_data[request.current_field] = request.user_input
    else:
        # Try LLM extraction for free-form input
        try:
            llm = await get_llm_service()

            # Build extraction prompt
            field_list = ", ".join([f"{f.name} ({f.label})" for f in all_fields])
            extraction_prompt = f"""Extrahiere Daten aus der Benutzereingabe.

Verfügbare Felder: {field_list}
Aktuelle Daten: {json.dumps(updated_data, ensure_ascii=False)}
Benutzereingabe: "{request.user_input}"

Antworte im JSON-Format mit den extrahierten Feldern:
{{"field_name": "value", ...}}

Nur Felder ausgeben, die eindeutig erkannt wurden."""

            response = await llm.chat_json([
                LLMMessage(role="system", content="Du bist ein Datenextraktions-Assistent."),
                LLMMessage(role="user", content=extraction_prompt)
            ], LLMConfig(temperature=0.2, json_mode=True))

            if isinstance(response, dict):
                updated_data.update(response)

        except Exception as e:
            # Fallback: no extraction
            pass

    # Determine next unfilled required field
    next_field = None
    next_question = None

    for field in priority_fields:
        if field.name not in updated_data or not updated_data[field.name]:
            next_field = field.name
            next_question = f"Wie lautet {field.label}?"
            if field.hint:
                next_question += f" ({field.hint})"
            break

    # Calculate completion
    total_required = len(priority_fields)
    filled_required = sum(
        1 for f in priority_fields
        if f.name in updated_data and updated_data[f.name]
    )
    completion_percentage = int((filled_required / total_required) * 100) if total_required > 0 else 100
    is_complete = next_field is None

    return SmartModeAnswerResponse(
        extracted_data=updated_data,
        next_question=next_question,
        next_field=next_field,
        is_complete=is_complete,
        completion_percentage=completion_percentage,
        provider="pattern"  # or LLM provider if used
    )


@router.get("/fields/{document_type_id}", response_model=List[SmartField])
async def get_smart_fields(
    document_type_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get smart fields configuration for a document type.

    Returns priority and optional fields with defaults and hints.
    """
    doc_type = await db.get(DocumentType, document_type_id)
    if not doc_type:
        raise HTTPException(status_code=404, detail="Dokumenttyp nicht gefunden")

    field_configs = get_field_config_for_doctype(doc_type.name)
    priority_fields, optional_fields = build_smart_fields(field_configs)

    return priority_fields + optional_fields


@router.get("/suggest-title")
async def suggest_document_title(
    document_type_id: int,
    form_data: str = Query(..., description="JSON-encoded form data"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Suggest a document title based on form data.
    """
    doc_type = await db.get(DocumentType, document_type_id)
    if not doc_type:
        raise HTTPException(status_code=404, detail="Dokumenttyp nicht gefunden")

    try:
        data = json.loads(form_data)
    except json.JSONDecodeError:
        data = {}

    # Build title from data
    name_parts = []
    if data.get("vorname"):
        name_parts.append(data["vorname"])
    if data.get("nachname"):
        name_parts.append(data["nachname"])

    if name_parts:
        title = f"{doc_type.name} - {' '.join(name_parts)}"
    else:
        title = f"{doc_type.name} - Neu"

    return {"suggested_title": title}
