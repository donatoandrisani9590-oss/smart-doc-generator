"""
Consistency Service: Cross-document contradiction detection for employee documents.

Detects inconsistencies when creating a new document for an employee who already
has finalized documents (e.g., different Gerichtsstand in NDA vs. Arbeitsvertrag).

Two-tier approach:
1. Pattern-based field comparison (fast, deterministic)
2. Optional LLM analysis for subtle cross-field contradictions

Privacy: Uses Mistral AI (EU) or Ollama (local) - no US data transfer.
"""
import asyncio
import json
import hashlib
import logging
import time
from datetime import datetime
from typing import List, Optional, Dict, Any, Literal

from pydantic import BaseModel, Field
from sqlalchemy import or_, and_, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.llm_service import (
    LLMService, LLMMessage, LLMConfig, get_llm_service, log_llm_call
)
from app.services.cache import cache, consistency_check_key

logger = logging.getLogger(__name__)


# =============================================================================
# MODELS
# =============================================================================

class ConsistencyIssue(BaseModel):
    """A detected inconsistency between the current and a previous document."""
    id: str = Field(..., description="Unique issue identifier")
    severity: Literal["info", "warning", "conflict"] = Field(
        ..., description="info=normal change, warning=review needed, conflict=legal risk"
    )
    field_name: str = Field(..., description="Internal field key")
    field_label: str = Field(..., description="German display name")
    current_value: str = Field(..., description="Value in current document")
    previous_value: str = Field(..., description="Value in previous document")
    previous_document_title: str
    previous_document_id: int
    previous_document_date: str = Field(..., description="ISO date of previous document")
    description: str = Field(..., description="Human-readable explanation")
    suggestion: Optional[str] = None


class ConsistencyCheckResult(BaseModel):
    """Result of a consistency check."""
    issues: List[ConsistencyIssue] = Field(default_factory=list)
    documents_checked: int = Field(0, description="Number of related documents analyzed")
    overall_status: Literal["consistent", "warnings", "conflicts"] = "consistent"
    checked_at: str = Field(..., description="ISO timestamp")
    employee_name: str


# =============================================================================
# FIELD CHECK DEFINITIONS
# =============================================================================

FIELD_CHECKS: List[Dict[str, Any]] = [
    {
        "field_keys": ["gerichtsstand"],
        "label": "Gerichtsstand",
        "comparison": "exact",
        "severity": "conflict",
        "description_template": "Gerichtsstand weicht ab: '{prev}' → '{curr}'. Unterschiedliche Gerichtsstände in Dokumenten desselben Arbeitsverhältnisses können rechtliche Probleme verursachen.",
        "suggestion": "Gerichtsstand in allen Dokumenten desselben Arbeitsverhältnisses vereinheitlichen.",
    },
    {
        "field_keys": ["gehalt", "gehalt_brutto", "bruttogehalt"],
        "label": "Gehalt",
        "comparison": "numeric",
        "severity": "info",
        "description_template": "Gehalt wurde angepasst: {prev} → {curr}.",
        "suggestion": None,
    },
    {
        "field_keys": ["wochenstunden", "arbeitszeit_stunden"],
        "label": "Wochenstunden",
        "comparison": "numeric",
        "severity": "warning",
        "description_template": "Wochenstunden haben sich geändert: {prev} → {curr}. Dies kann Auswirkungen auf Urlaub, Gehalt und Sozialversicherung haben.",
        "suggestion": "Prüfen, ob abhängige Vertragsbestandteile (Gehalt, Urlaub) ebenfalls angepasst wurden.",
    },
    {
        "field_keys": ["urlaubstage"],
        "label": "Urlaubstage",
        "comparison": "numeric",
        "severity": "warning",
        "description_template": "Urlaubstage unterscheiden sich: {prev} → {curr}.",
        "suggestion": "Urlaubsanspruch sollte innerhalb eines Arbeitsverhältnisses konsistent sein, sofern keine Änderungsvereinbarung vorliegt.",
    },
    {
        "field_keys": ["kuendigungsfrist"],
        "label": "Kündigungsfrist",
        "comparison": "exact",
        "severity": "warning",
        "description_template": "Kündigungsfrist weicht ab: '{prev}' → '{curr}'.",
        "suggestion": "Die Kündigungsfrist sollte dem aktuellen Beschäftigungszeitraum entsprechen (§ 622 BGB).",
    },
    {
        "field_keys": ["probezeit", "probezeit_monate"],
        "label": "Probezeit",
        "comparison": "exact",
        "severity": "info",
        "description_template": "Probezeit geändert: '{prev}' → '{curr}'.",
        "suggestion": None,
    },
    {
        "field_keys": ["position", "taetigkeit"],
        "label": "Position/Tätigkeit",
        "comparison": "exact",
        "severity": "info",
        "description_template": "Position/Tätigkeit geändert: '{prev}' → '{curr}'.",
        "suggestion": None,
    },
    {
        "field_keys": ["arbeitszeitmodell"],
        "label": "Arbeitszeitmodell",
        "comparison": "exact",
        "severity": "warning",
        "description_template": "Arbeitszeitmodell geändert: '{prev}' → '{curr}'. Ein Wechsel zwischen Vollzeit und Teilzeit hat arbeitsrechtliche Auswirkungen.",
        "suggestion": "Prüfen, ob ein Nachtrag zum Arbeitsvertrag oder eine Änderungskündigung erforderlich ist.",
    },
]


# =============================================================================
# SERVICE
# =============================================================================

class ConsistencyService:
    """
    Service for cross-document consistency checking.

    Compares form_data fields of the current document against finalized
    documents for the same employee.

    Usage:
        service = ConsistencyService(db)
        result = await service.check_consistency(
            employee_name="Max Mustermann",
            current_form_data={"gehalt": "50000", "gerichtsstand": "München"},
        )
    """

    def __init__(self, db: AsyncSession, llm_service: Optional[LLMService] = None):
        self.db = db
        self.llm = llm_service

    def _compute_hash(self, employee_name: str, form_data: dict) -> str:
        """Compute cache key from employee + form data."""
        data = f"{employee_name}:{json.dumps(form_data, sort_keys=True, ensure_ascii=False)}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    def _extract_field_value(self, form_data: dict, field_keys: List[str]) -> Optional[str]:
        """Extract value from form_data trying multiple possible keys."""
        for key in field_keys:
            val = form_data.get(key)
            if val is not None and str(val).strip():
                return str(val).strip()
        return None

    def _values_differ(self, current: str, previous: str, comparison: str) -> bool:
        """Compare two values according to comparison type."""
        if comparison == "numeric":
            try:
                curr_num = float(current.replace(",", ".").replace("€", "").replace(" ", ""))
                prev_num = float(previous.replace(",", ".").replace("€", "").replace(" ", ""))
                return curr_num != prev_num
            except (ValueError, AttributeError):
                return current.strip().lower() != previous.strip().lower()
        # exact comparison (case-insensitive)
        return current.strip().lower() != previous.strip().lower()

    async def _get_related_documents(
        self,
        employee_name: str,
        employee_id: Optional[str],
    ) -> list:
        """Query finalized documents for the same employee."""
        from app.models.enterprise import GeneratedDocument

        conditions = []
        if employee_name:
            conditions.append(GeneratedDocument.employee_name == employee_name)
        if employee_id:
            conditions.append(GeneratedDocument.employee_id == employee_id)

        if not conditions:
            return []

        query = (
            select(GeneratedDocument)
            .where(
                and_(
                    or_(*conditions),
                    GeneratedDocument.is_deleted == False,
                )
            )
            .order_by(desc(GeneratedDocument.created_at))
            .limit(20)
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def check_consistency(
        self,
        employee_name: str,
        current_form_data: dict,
        employee_id: Optional[str] = None,
        document_type_id: Optional[int] = None,
        use_llm: bool = False,
        custom_instructions: str = "",
    ) -> ConsistencyCheckResult:
        """
        Check current form data against historical documents for the same employee.

        Returns a ConsistencyCheckResult with any detected inconsistencies.
        """
        start_time = time.time()

        # Check cache (Redis via CacheService with memory fallback)
        check_hash = self._compute_hash(employee_name, current_form_data)
        redis_key = consistency_check_key(check_hash)
        cached_data = await cache.get(redis_key)
        if cached_data:
            logger.debug(f"Returning cached consistency check: {check_hash}")
            return ConsistencyCheckResult(**cached_data)

        # Get related documents
        related_docs = await self._get_related_documents(employee_name, employee_id)

        if not related_docs:
            result = ConsistencyCheckResult(
                issues=[],
                documents_checked=0,
                overall_status="consistent",
                checked_at=datetime.utcnow().isoformat(),
                employee_name=employee_name,
            )
            await cache.set(redis_key, result.model_dump(), ttl=1800)
            return result

        # Parse form_data from historical documents
        historical: List[Dict[str, Any]] = []
        for doc in related_docs:
            if not doc.form_data:
                continue
            try:
                parsed = json.loads(doc.form_data) if isinstance(doc.form_data, str) else doc.form_data
                historical.append({
                    "id": doc.id,
                    "title": doc.title or "Unbenanntes Dokument",
                    "created_at": doc.created_at.isoformat() if doc.created_at else "",
                    "form_data": parsed,
                })
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(f"Fehler beim Parsen der Formulardaten für Dokument {doc.id}: {e}")

        # Pattern-based field comparison
        issues: List[ConsistencyIssue] = []

        for check in FIELD_CHECKS:
            current_val = self._extract_field_value(current_form_data, check["field_keys"])
            if current_val is None:
                continue

            # Find most recent document with this field
            for hist_doc in historical:
                prev_val = self._extract_field_value(hist_doc["form_data"], check["field_keys"])
                if prev_val is None:
                    continue

                if self._values_differ(current_val, prev_val, check["comparison"]):
                    description = check["description_template"].format(
                        prev=prev_val, curr=current_val
                    )
                    issue = ConsistencyIssue(
                        id=f"field_{check['field_keys'][0]}_{hist_doc['id']}",
                        severity=check["severity"],
                        field_name=check["field_keys"][0],
                        field_label=check["label"],
                        current_value=current_val,
                        previous_value=prev_val,
                        previous_document_title=hist_doc["title"],
                        previous_document_id=hist_doc["id"],
                        previous_document_date=hist_doc["created_at"],
                        description=description,
                        suggestion=check.get("suggestion"),
                    )
                    issues.append(issue)

                # Only compare against the most recent doc with this field
                break

        # Optional LLM analysis for cross-field contradictions
        if use_llm and self.llm and issues:
            try:
                llm_issues = await self._analyze_with_llm(
                    current_form_data, historical, issues, custom_instructions
                )
                issues.extend(llm_issues)
            except Exception as e:
                logger.warning(f"LLM-Konsistenzanalyse fehlgeschlagen: {e}")

        # Determine overall status
        has_conflicts = any(i.severity == "conflict" for i in issues)
        has_warnings = any(i.severity == "warning" for i in issues)
        overall_status: Literal["consistent", "warnings", "conflicts"]
        if has_conflicts:
            overall_status = "conflicts"
        elif has_warnings:
            overall_status = "warnings"
        elif issues:
            overall_status = "warnings"  # info-only still shows as warnings
        else:
            overall_status = "consistent"

        duration_ms = int((time.time() - start_time) * 1000)
        logger.info(
            f"Konsistenzprüfung abgeschlossen: {len(issues)} Abweichungen, "
            f"{len(historical)} Dokumente geprüft, {duration_ms}ms"
        )

        result = ConsistencyCheckResult(
            issues=issues,
            documents_checked=len(historical),
            overall_status=overall_status,
            checked_at=datetime.utcnow().isoformat(),
            employee_name=employee_name,
        )

        # Cache result (Redis with TTL, memory fallback)
        await cache.set(redis_key, result.model_dump(), ttl=1800)  # 30min TTL

        return result

    async def _analyze_with_llm(
        self,
        current_data: dict,
        historical: List[Dict[str, Any]],
        existing_issues: List[ConsistencyIssue],
        custom_instructions: str = "",
    ) -> List[ConsistencyIssue]:
        """Detect subtle cross-field inconsistencies using LLM."""
        if not self.llm:
            return []

        # Build context from already-detected issues
        existing_summary = "\n".join(
            f"- {i.field_label}: '{i.previous_value}' → '{i.current_value}'"
            for i in existing_issues[:10]
        )

        # Only include relevant fields from historical docs
        hist_summary = []
        for doc in historical[:3]:
            hist_summary.append(
                f"Dokument '{doc['title']}' ({doc['created_at'][:10]}): "
                f"{json.dumps(doc['form_data'], ensure_ascii=False)[:500]}"
            )

        system_prompt = f"""Du bist ein HR-Experte für Vertragsmanagement.

AUFGABE: Analysiere die Vertragsänderungen auf subtile logische Widersprüche, die
einfache Feldvergleiche nicht erkennen.

BEISPIELE für subtile Inkonsistenzen:
- Teilzeit-Wochenstunden aber Vollzeit-Gehalt
- Probezeit im Nachtrag (sollte bei bestehendem Arbeitsverhältnis entfallen)
- Befristung verlängert über Maximaldauer (§ 14 TzBfG: max. 2 Jahre)

Bereits erkannte Feldänderungen (NICHT wiederholen):
{existing_summary}

ANTWORT-FORMAT (strikt JSON):
{{
  "cross_field_issues": [
    {{
      "field_label": "Betroffenes Feld",
      "severity": "info|warning|conflict",
      "description": "Erklärung des Widerspruchs",
      "suggestion": "Empfohlene Korrektur"
    }}
  ]
}}

Antworte NUR mit dem JSON-Objekt.{f" " + custom_instructions if custom_instructions else ""}"""

        user_prompt = f"""Aktuelle Formulardaten:
{json.dumps(current_data, ensure_ascii=False)[:2000]}

Bisherige Dokumente:
{chr(10).join(hist_summary)}

Finde logische Widersprüche zwischen den Dokumenten."""

        try:
            _llm_start = time.time()
            response = await self.llm.chat_json(
                messages=[
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=user_prompt),
                ],
                config=LLMConfig(
                    temperature=0.2,
                    max_tokens=1500,
                    json_mode=True,
                ),
            )
            asyncio.create_task(log_llm_call(
                feature="consistency",
                latency_ms=int((time.time() - _llm_start) * 1000),
                user_id=None,
                country_code=None,
            ))

            llm_issues = []
            for idx, item in enumerate(response.get("cross_field_issues", [])):
                severity = item.get("severity", "info")
                if severity not in ("info", "warning", "conflict"):
                    severity = "info"

                issue = ConsistencyIssue(
                    id=f"llm_cross_{idx}",
                    severity=severity,
                    field_name="cross_field",
                    field_label=item.get("field_label", "Quervergleich"),
                    current_value="",
                    previous_value="",
                    previous_document_title="Mehrere Dokumente",
                    previous_document_id=0,
                    previous_document_date="",
                    description=item.get("description", ""),
                    suggestion=item.get("suggestion"),
                )
                llm_issues.append(issue)

            return llm_issues

        except Exception as e:
            asyncio.create_task(log_llm_call(
                feature="consistency",
                latency_ms=int((time.time() - _llm_start) * 1000),
                error_message=str(e),
            ))
            logger.error(f"LLM-Konsistenzanalyse Fehler: {e}")
            return []
