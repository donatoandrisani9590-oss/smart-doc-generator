"""
LegalAuditor Service -- Prüft Textbausteine auf rechtliche Aktualität.

Nutzt LLMService um Textbausteine gegen aktuelles deutsches Recht zu prüfen.
Speichert Ergebnisse als ClauseAuditResult und aktualisiert Clause.legal_status.
"""
import json
import logging
import time
import asyncio
from datetime import datetime
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.documents import Clause
from app.models.legal_audit import ClauseAuditResult
from app.services.llm_service import LLMService, LLMConfig, LLMMessage, log_llm_call

logger = logging.getLogger(__name__)

LEGAL_AUDITOR_SYSTEM_PROMPT = """Du bist ein Senior Legal Counsel mit Spezialisierung auf deutsches Arbeitsrecht.
Prüfe den folgenden Textbaustein auf Konformität mit dem aktuellen deutschen Recht
(Stand {year}). Achte besonders auf:
- AGB-Kontrolle (§ 307 BGB) — Ist die Klausel überraschend oder unangemessen benachteiligend?
- Nachweisgesetz (NachwG) — Sind alle Pflichtangaben enthalten?
- Aktuelle BAG-Rechtsprechung — Widerspricht der Baustein bekannten Urteilen?
- Tarifrecht — Falls anwendbar: Verstößt der Baustein gegen zwingendes Tarifrecht?

Gib NUR strukturiertes JSON zurück, KEIN anderer Text:
{{
  "status": "ok" | "warning" | "deprecated",
  "risk_level": "low" | "medium" | "high" | "critical",
  "reasoning": "Kurze Begründung in 1-3 Sätzen",
  "affected_law": "z.B. § 307 BGB oder NachwG §2 Abs.1 oder null",
  "suggestion": "Empfohlene Anpassung oder null"
}}"""


class LegalAuditorService:
    """Prüft Textbausteine auf rechtliche Konformität via LLM."""

    def __init__(self):
        self.llm = LLMService()

    async def audit_clause(
        self,
        clause: Clause,
        db: AsyncSession,
    ) -> ClauseAuditResult:
        """Audit a single clause and persist the result."""
        year = datetime.now().year
        system = LEGAL_AUDITOR_SYSTEM_PROMPT.format(year=year)

        user_prompt = (
            f"Textbaustein-Titel: {clause.title}\n"
            f"Kategorie: {clause.category or 'Keine'}\n"
            f"Land: {clause.country_code or 'DE'}\n\n"
            f"Inhalt:\n{clause.content_html}"
        )

        config = LLMConfig(temperature=0.2, max_tokens=800)
        messages = [
            LLMMessage(role="system", content=system),
            LLMMessage(role="user", content=user_prompt),
        ]

        start_ms = int(time.time() * 1000)
        llm_response = None
        error_msg = None

        try:
            llm_response = await self.llm.chat(messages, config)
            result_data = self._parse_audit_response(llm_response.content)
        except Exception as e:
            logger.error("Legal audit LLM error for clause %d: %s", clause.id, e)
            error_msg = str(e)[:200]
            result_data = {
                "status": "warning",
                "risk_level": "low",
                "reasoning": f"Automatische Prüfung fehlgeschlagen: {str(e)[:200]}",
                "affected_law": None,
                "suggestion": None,
            }

        latency_ms = int(time.time() * 1000) - start_ms

        # Fire-and-forget LLM logging
        asyncio.create_task(log_llm_call(
            feature="legal_audit",
            response=llm_response,
            latency_ms=latency_ms,
            country_code=clause.country_code or "DE",
            error_message=error_msg,
        ))

        # Create audit result
        audit_result = ClauseAuditResult(
            clause_id=clause.id,
            audited_by="legal_auditor_v1",
            status=result_data["status"],
            risk_level=result_data["risk_level"],
            reasoning=result_data.get("reasoning"),
            affected_law=result_data.get("affected_law"),
            suggestion=result_data.get("suggestion"),
        )
        db.add(audit_result)

        # Update clause legal_status
        clause.legal_status = result_data["status"]
        clause.last_audited_at = datetime.utcnow()

        await db.commit()
        await db.refresh(audit_result)

        return audit_result

    async def audit_batch(
        self,
        db: AsyncSession,
        clause_ids: Optional[list] = None,
        country_code: str = "DE",
        limit: int = 50,
    ) -> list:
        """Audit a batch of clauses. Returns list of ClauseAuditResult."""
        q = select(Clause).where(
            and_(
                Clause.is_active == True,
                Clause.country_code == country_code,
            )
        )
        if clause_ids:
            q = q.where(Clause.id.in_(clause_ids))
        q = q.limit(limit)

        result = await db.execute(q)
        clauses = result.scalars().all()

        results = []
        for c in clauses:
            audit = await self.audit_clause(c, db)
            results.append(audit)

        return results

    async def generate_auto_fix(
        self,
        clause: Clause,
        audit_result: ClauseAuditResult,
        db: AsyncSession,
    ) -> str:
        """Generate a corrected version of the clause using LLM."""
        year = datetime.now().year
        system = (
            f"Du bist ein Senior Legal Counsel (Stand {year}). "
            "Korrigiere den folgenden Textbaustein gemäß der Beanstandung. "
            "Gib NUR den korrigierten HTML-Text zurück, KEINE Erklärung."
        )

        user_prompt = (
            f"Originaler Textbaustein:\n{clause.content_html}\n\n"
            f"Beanstandung: {audit_result.reasoning}\n"
            f"Betroffenes Gesetz: {audit_result.affected_law or 'k.A.'}\n"
            f"Empfehlung: {audit_result.suggestion or 'k.A.'}\n\n"
            "Bitte korrigierten Textbaustein ausgeben:"
        )

        config = LLMConfig(temperature=0.2, max_tokens=1500)
        messages = [
            LLMMessage(role="system", content=system),
            LLMMessage(role="user", content=user_prompt),
        ]

        start_ms = int(time.time() * 1000)
        llm_response = None
        error_msg = None

        try:
            llm_response = await self.llm.chat(messages, config)
            corrected_html = llm_response.content.strip()
        except Exception as e:
            logger.error("Auto-fix LLM error for clause %d: %s", clause.id, e)
            error_msg = str(e)[:200]
            raise

        latency_ms = int(time.time() * 1000) - start_ms

        # Fire-and-forget LLM logging
        asyncio.create_task(log_llm_call(
            feature="legal_audit_autofix",
            response=llm_response,
            latency_ms=latency_ms,
            country_code=clause.country_code or "DE",
            error_message=error_msg,
        ))

        return corrected_html

    def _parse_audit_response(self, content: str) -> dict:
        """Parse the structured JSON from the LLM response."""
        content = content.strip()

        # Handle markdown code blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            logger.warning("Failed to parse audit JSON: %s", content[:200])
            return {
                "status": "warning",
                "risk_level": "low",
                "reasoning": "Audit-Ergebnis konnte nicht interpretiert werden",
                "affected_law": None,
                "suggestion": None,
            }

        # Validate required fields
        valid_statuses = {"ok", "warning", "deprecated"}
        valid_risk_levels = {"low", "medium", "high", "critical"}

        status = data.get("status", "warning")
        if status not in valid_statuses:
            status = "warning"

        risk_level = data.get("risk_level", "low")
        if risk_level not in valid_risk_levels:
            risk_level = "low"

        return {
            "status": status,
            "risk_level": risk_level,
            "reasoning": data.get("reasoning"),
            "affected_law": data.get("affected_law"),
            "suggestion": data.get("suggestion"),
        }


# Singleton getter
_legal_auditor: Optional[LegalAuditorService] = None


def get_legal_auditor() -> LegalAuditorService:
    """Get the LegalAuditorService singleton."""
    global _legal_auditor
    if _legal_auditor is None:
        _legal_auditor = LegalAuditorService()
    return _legal_auditor
