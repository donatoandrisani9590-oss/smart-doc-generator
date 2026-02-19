"""
Gap Analysis API: Proactive document completeness check.

Pattern-based analysis that identifies missing required clauses,
recommends best-practice clauses based on form data patterns,
and confirms positive best practices already in place.

No LLM needed — fast pattern matching only.
"""
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.api.deps import get_current_user
from app.models.documents import DocumentType, DocumentTypeClause, Clause

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/smart/gap-analysis", tags=["smart-gap-analysis"])


# =============================================================================
# MODELS
# =============================================================================

class GapAnalysisItem(BaseModel):
    """Single gap analysis finding."""
    id: str
    severity: str = Field(description="success | recommendation | warning")
    title: str
    description: str
    clause_id: Optional[int] = None
    action_type: Optional[str] = None  # add_clause, change_field, review
    action_label: Optional[str] = None


class GapAnalysisResponse(BaseModel):
    """Complete gap analysis result."""
    items: list[GapAnalysisItem] = []
    summary: str = ""


class GapAnalysisRequest(BaseModel):
    """Request body for gap analysis."""
    document_type_id: int
    country_code: str = Field(default="DE", pattern="^(DE|AT|CH|IT)$")
    enabled_clause_ids: list[int] = []
    form_data: dict = {}
    document_title: str = ""


# =============================================================================
# HELPERS
# =============================================================================

def _make_id() -> str:
    return str(uuid.uuid4())[:8]


def _get_form_value(form_data: dict, key: str) -> Optional[str]:
    """Safely get a form data value as string (ignoring empty strings)."""
    val = form_data.get(key)
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def _is_truthy(form_data: dict, key: str) -> bool:
    """Check if a form field is truthy (True, 'true', 'ja', '1', non-empty string)."""
    val = form_data.get(key)
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    return s in ("true", "ja", "1", "yes")


# =============================================================================
# ENDPOINT
# =============================================================================

@router.post("", response_model=GapAnalysisResponse)
async def gap_analysis(
    request: GapAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Perform proactive gap analysis on a document being created.

    Checks:
    1. Missing required (mandatory) clauses
    2. Best-practice clause recommendations based on form data
    3. Field consistency warnings (missing key fields)
    4. Positive confirmations (best practices already met)
    """
    items: list[GapAnalysisItem] = []

    try:
        # ─────────────────────────────────────────────────────────────
        # 1. Load document type with its clauses
        # ─────────────────────────────────────────────────────────────
        result = await db.execute(
            select(DocumentType)
            .options(selectinload(DocumentType.clauses).selectinload(DocumentTypeClause.clause))
            .where(DocumentType.id == request.document_type_id)
        )
        doc_type = result.scalar_one_or_none()

        if not doc_type:
            return GapAnalysisResponse(items=[], summary="")

        enabled_ids = set(request.enabled_clause_ids)

        # ─────────────────────────────────────────────────────────────
        # 2. Missing mandatory clauses
        # ─────────────────────────────────────────────────────────────
        mandatory_clauses = [
            dtc for dtc in doc_type.clauses
            if dtc.is_mandatory and dtc.clause and dtc.clause.is_active
        ]

        missing_mandatory = [
            dtc for dtc in mandatory_clauses
            if dtc.clause_id not in enabled_ids
        ]

        for dtc in missing_mandatory:
            clause = dtc.clause
            items.append(GapAnalysisItem(
                id=_make_id(),
                severity="warning",
                title=f"Pflicht-Textbaustein fehlt: {clause.title}",
                description=f"Dieser Textbaustein ist für den Dokumenttyp \"{doc_type.name}\" als Pflicht markiert.",
                clause_id=clause.id,
                action_type="add_clause",
                action_label="Textbaustein hinzufügen",
            ))

        # ─────────────────────────────────────────────────────────────
        # 3. Best-practice clause recommendations based on form data
        # ─────────────────────────────────────────────────────────────
        form_data = request.form_data

        # Build a lookup of all available clauses for this document type
        available_clauses = {
            dtc.clause_id: dtc.clause
            for dtc in doc_type.clauses
            if dtc.clause and dtc.clause.is_active
        }

        # Helper: search for a clause by title pattern among available clauses
        def find_clause_by_pattern(pattern: str) -> Optional[Clause]:
            pattern_lower = pattern.lower()
            for cid, clause in available_clauses.items():
                if pattern_lower in clause.title.lower():
                    return clause
            return None

        # 3a. Teilzeit → Mehrarbeitsvergütung
        wochenstunden = _get_form_value(form_data, "wochenstunden")
        if wochenstunden:
            try:
                hours = float(wochenstunden)
                if hours < 40:
                    clause = find_clause_by_pattern("mehrarbeit")
                    if clause and clause.id not in enabled_ids:
                        items.append(GapAnalysisItem(
                            id=_make_id(),
                            severity="recommendation",
                            title="Mehrarbeitsvergütung empfohlen",
                            description=f"Bei {hours:.0f} Wochenstunden (Teilzeit) sollte eine Mehrarbeitsregelung aufgenommen werden.",
                            clause_id=clause.id,
                            action_type="add_clause",
                            action_label="Textbaustein hinzufügen",
                        ))
            except (ValueError, TypeError):
                pass

        # 3b. AT-Angestellter → Wettbewerbsverbot
        vertragsart = _get_form_value(form_data, "vertragsart")
        if vertragsart and "at" in vertragsart.lower():
            clause = find_clause_by_pattern("wettbewerb")
            if clause and clause.id not in enabled_ids:
                items.append(GapAnalysisItem(
                    id=_make_id(),
                    severity="recommendation",
                    title="Wettbewerbsverbot empfohlen",
                    description="Für AT-Angestellte wird ein nachvertragliches Wettbewerbsverbot empfohlen.",
                    clause_id=clause.id,
                    action_type="add_clause",
                    action_label="Textbaustein hinzufügen",
                ))

        # 3c. Firmenwagen → Dienstwagenregelung
        if _is_truthy(form_data, "firmenwagen"):
            clause = find_clause_by_pattern("dienstwagen") or find_clause_by_pattern("firmenwagen")
            if clause and clause.id not in enabled_ids:
                items.append(GapAnalysisItem(
                    id=_make_id(),
                    severity="recommendation",
                    title="Dienstwagenregelung empfohlen",
                    description="Es wurde ein Firmenwagen angegeben, aber keine Dienstwagenregelung ausgewählt.",
                    clause_id=clause.id,
                    action_type="add_clause",
                    action_label="Textbaustein hinzufügen",
                ))

        # 3d. Homeoffice → Homeoffice-Vereinbarung
        if _is_truthy(form_data, "homeoffice"):
            clause = find_clause_by_pattern("homeoffice") or find_clause_by_pattern("telearbeit")
            if clause and clause.id not in enabled_ids:
                items.append(GapAnalysisItem(
                    id=_make_id(),
                    severity="recommendation",
                    title="Homeoffice-Vereinbarung empfohlen",
                    description="Homeoffice ist aktiviert, aber keine entsprechende Vereinbarung ausgewählt.",
                    clause_id=clause.id,
                    action_type="add_clause",
                    action_label="Textbaustein hinzufügen",
                ))

        # ─────────────────────────────────────────────────────────────
        # 4. Field consistency warnings
        # ─────────────────────────────────────────────────────────────
        # 4a. Gehalt missing but other fields filled
        has_other_fields = any(
            _get_form_value(form_data, k)
            for k in ("vorname", "nachname", "position", "eintrittsdatum")
        )
        if has_other_fields and not _get_form_value(form_data, "gehalt"):
            items.append(GapAnalysisItem(
                id=_make_id(),
                severity="warning",
                title="Gehalt nicht angegeben",
                description="Das Bruttogehalt fehlt. Bitte prüfe, ob das Gehalt vor dem Export eingetragen wird.",
                action_type="change_field",
                action_label="Prüfen",
            ))

        # 4b. Eintrittsdatum in the past
        eintrittsdatum = _get_form_value(form_data, "eintrittsdatum")
        if eintrittsdatum:
            try:
                entry_date = datetime.strptime(eintrittsdatum, "%Y-%m-%d").date()
                if entry_date < datetime.now().date():
                    items.append(GapAnalysisItem(
                        id=_make_id(),
                        severity="recommendation",
                        title="Eintrittsdatum liegt in der Vergangenheit",
                        description=f"Das Eintrittsdatum ({entry_date.strftime('%d.%m.%Y')}) liegt vor dem heutigen Datum. Bitte überprüfen.",
                        action_type="review",
                        action_label="Prüfen",
                    ))
            except (ValueError, TypeError):
                pass

        # 4c. Kündigungsfrist missing
        if not _get_form_value(form_data, "kuendigungsfrist"):
            items.append(GapAnalysisItem(
                id=_make_id(),
                severity="recommendation",
                title="Kündigungsfrist nicht angegeben",
                description="Es wurde keine Kündigungsfrist definiert. Die gesetzliche Frist gilt automatisch.",
                action_type="review",
                action_label="Prüfen",
            ))

        # ─────────────────────────────────────────────────────────────
        # 5. Positive confirmations (best-practice met)
        # ─────────────────────────────────────────────────────────────
        # 5a. Probezeit set
        if _get_form_value(form_data, "probezeit"):
            items.append(GapAnalysisItem(
                id=_make_id(),
                severity="success",
                title="Probezeit-Regelung vorhanden",
                description="Eine Probezeit wurde konfiguriert. Best Practice bestätigt.",
            ))

        # 5b. All mandatory clauses active
        if mandatory_clauses and not missing_mandatory:
            items.append(GapAnalysisItem(
                id=_make_id(),
                severity="success",
                title="Alle Pflicht-Textbausteine aktiv",
                description=f"Alle {len(mandatory_clauses)} Pflicht-Textbausteine für diesen Dokumenttyp sind ausgewählt.",
            ))

        # ─────────────────────────────────────────────────────────────
        # 6. Build summary
        # ─────────────────────────────────────────────────────────────
        warnings = sum(1 for i in items if i.severity == "warning")
        recommendations = sum(1 for i in items if i.severity == "recommendation")
        successes = sum(1 for i in items if i.severity == "success")

        parts = []
        if warnings:
            parts.append(f"{warnings} {'Warnung' if warnings == 1 else 'Warnungen'}")
        if recommendations:
            parts.append(f"{recommendations} {'Empfehlung' if recommendations == 1 else 'Empfehlungen'}")
        if successes:
            parts.append(f"{successes} {'Bestätigung' if successes == 1 else 'Bestätigungen'}")

        summary = ", ".join(parts) if parts else "Keine Auffälligkeiten"

        return GapAnalysisResponse(items=items, summary=summary)

    except Exception as e:
        logger.error(f"Lückenanalyse fehlgeschlagen: {e}")
        # Graceful degradation: return empty result
        return GapAnalysisResponse(items=[], summary="")
