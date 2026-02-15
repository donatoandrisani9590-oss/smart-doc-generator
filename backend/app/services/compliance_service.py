"""
Compliance Service: Proactive risk detection for employment documents.

Features:
- Pattern-based risk detection (fast, offline)
- LLM-enhanced analysis (deep, contextual)
- German labor law focus (BAG, BVerfG, BUrlG, etc.)
- Multi-language support (DE, AT, CH, IT)

Privacy: Uses Mistral AI (EU) or Ollama (local) - no US data transfer.
"""
import asyncio
import re
import hashlib
import time
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any, Callable
from pydantic import BaseModel, Field
from bs4 import BeautifulSoup
import logging

from app.services.llm_service import (
    LLMService, LLMMessage, LLMConfig, get_llm_service, log_llm_call
)
from app.services.cache import cache, compliance_scan_key

logger = logging.getLogger(__name__)


class RiskSeverity(str, Enum):
    """Risk severity levels."""
    LOW = "low"          # Hinweis - informativ
    MEDIUM = "medium"    # Warnung - sollte geprüft werden
    HIGH = "high"        # Wichtig - rechtliche Bedenken
    CRITICAL = "critical"  # Kritisch - wahrscheinlich rechtswidrig


class ComplianceRisk(BaseModel):
    """A detected compliance risk in the document."""
    id: str = Field(..., description="Unique risk identifier")
    severity: RiskSeverity
    title: str = Field(..., description="Short risk title")
    description: str = Field(..., description="Detailed description of the issue")
    affected_text: str = Field(..., description="The problematic text snippet")
    start_position: int = Field(..., description="Start position in plain text")
    end_position: int = Field(..., description="End position in plain text")
    suggestion: Optional[str] = Field(None, description="Recommended fix")
    legal_reference: Optional[str] = Field(None, description="Legal basis (law, court ruling)")
    category: str = Field("general", description="Risk category")


class ComplianceScanResult(BaseModel):
    """Result of a compliance scan."""
    risks: List[ComplianceRisk] = Field(default_factory=list)
    overall_score: int = Field(..., ge=0, le=100, description="Compliance score (100 = perfect)")
    scanned_at: str = Field(..., description="ISO timestamp of scan")
    provider: str = Field("pattern", description="LLM provider used (or 'pattern')")
    scan_duration_ms: int = Field(0, description="Scan duration in milliseconds")
    content_hash: str = Field(..., description="Hash of scanned content (for caching)")


class RiskPattern(BaseModel):
    """Definition of a risk pattern for pattern-based detection."""
    pattern: str  # Regex pattern
    severity: RiskSeverity
    title: str
    description: str
    legal_reference: Optional[str] = None
    suggestion: Optional[str] = None
    category: str = "general"
    country_codes: List[str] = ["DE", "AT", "CH"]  # Applicable countries
    value_check: Optional[str] = None  # Optional: "probezeit_months > 6"


# =============================================================================
# GERMAN LABOR LAW RISK PATTERNS
# =============================================================================

RISK_PATTERNS_DE: List[Dict[str, Any]] = [
    # KRITISCH: Unzulässige Rechtsverzichte
    {
        "pattern": r"verzicht(et|en)?\s+.{0,30}(anspruch|ansprüche|recht|rechte|urlaub|gehalt|lohn|vergütung)",
        "severity": RiskSeverity.CRITICAL,
        "title": "Unzulässiger Rechtsverzicht",
        "description": "Arbeitnehmer können nicht wirksam auf gesetzliche Mindestansprüche verzichten. Solche Textbausteine sind unwirksam.",
        "legal_reference": "§ 13 BUrlG, § 4 TzBfG, § 307 BGB",
        "suggestion": "Textbaustein ersatzlos streichen. Gesetzliche Ansprüche können nicht abbedungen werden.",
        "category": "rechtsverzicht"
    },
    {
        "pattern": r"kein(en?)?\s+(anspruch|recht)\s+(auf|an)\s+(urlaub|freizeit|pause|ruhezeit)",
        "severity": RiskSeverity.CRITICAL,
        "title": "Verstoß gegen Urlaubsrecht",
        "description": "Der gesetzliche Mindesturlaub (20 Tage bei 5-Tage-Woche) ist unabdingbar.",
        "legal_reference": "§ 1, § 3, § 13 BUrlG",
        "suggestion": "Urlaubsanspruch gemäß BUrlG gewähren (mind. 20 Tage/Jahr bei Vollzeit).",
        "category": "urlaub"
    },
    {
        "pattern": r"(ausschluss|verzicht|verbot|darf\s+kein|nicht\s+beitreten|kein.{0,5}beitr).{0,40}(gewerkschaft|betriebsrat|arbeitnehmervertretung|tarifvertrag)|(gewerkschaft|betriebsrat).{0,40}(untersagt|verboten|ausgeschlossen|nicht\s+erlaubt|nicht\s+gestattet|darf\s+nicht)",
        "severity": RiskSeverity.CRITICAL,
        "title": "Verstoß gegen Koalitionsfreiheit",
        "description": "Einschränkungen der Gewerkschaftszugehörigkeit oder Betriebsratsarbeit sind verfassungswidrig.",
        "legal_reference": "Art. 9 Abs. 3 GG, § 119 BetrVG",
        "suggestion": "Textbaustein ersatzlos streichen - verfassungswidrig.",
        "category": "grundrechte"
    },

    # HOCH: Grenzwertige Regelungen
    {
        "pattern": r"probezeit.{0,30}?(\d+)\s*monat",
        "severity": RiskSeverity.HIGH,
        "title": "Probezeitdauer prüfen",
        "description": "Die Probezeit darf maximal 6 Monate betragen.",
        "legal_reference": "§ 622 Abs. 3 BGB",
        "suggestion": "Probezeit auf maximal 6 Monate begrenzen.",
        "category": "probezeit",
        "value_check": "probezeit_months > 6"
    },
    {
        "pattern": r"wettbewerbsverbot\s+(für|von|über)\s+(\d+)\s*(jahr|monat)",
        "severity": RiskSeverity.HIGH,
        "title": "Wettbewerbsverbot prüfen",
        "description": "Nachvertragliches Wettbewerbsverbot max. 2 Jahre, nur mit Karenzentschädigung (mind. 50% des letzten Gehalts).",
        "legal_reference": "§ 74, § 74a HGB",
        "suggestion": "Wettbewerbsverbot auf max. 2 Jahre begrenzen und Karenzentschädigung (mind. 50%) vorsehen.",
        "category": "wettbewerb",
        "value_check": "wettbewerb_months > 24"
    },
    {
        "pattern": r"(alle|sämtliche)\s+überstunden\s+(sind|werden).{0,20}(abgegolten|vergütet|enthalten|inkludiert)",
        "severity": RiskSeverity.HIGH,
        "title": "Pauschale Überstundenabgeltung",
        "description": "Pauschale Abgeltung aller Überstunden durch das Gehalt ist nur begrenzt zulässig (max. 10-15% der Arbeitszeit).",
        "legal_reference": "BAG 5 AZR 517/09, § 307 BGB",
        "suggestion": "Konkrete Überstundenregelung mit Zeitausgleich oder Vergütung definieren. Max. 10% pauschal abgelten.",
        "category": "arbeitszeit"
    },
    {
        "pattern": r"kündigungsfrist.{0,30}(\d+)\s*(tag|woch)",
        "severity": RiskSeverity.HIGH,
        "title": "Kündigungsfrist zu kurz",
        "description": "Gesetzliche Mindestkündigungsfrist: 4 Wochen zum 15. oder Monatsende.",
        "legal_reference": "§ 622 BGB",
        "suggestion": "Mindestens 4 Wochen Kündigungsfrist zum Monatsende vorsehen.",
        "category": "kuendigung",
        "value_check": "kuendigungsfrist_weeks < 4"
    },

    # Arbeitszeit-Überschreitung
    {
        "pattern": r"(wöchentliche\s+)?arbeitszeit.{0,30}?(\d+)\s*stunden",
        "severity": RiskSeverity.HIGH,
        "title": "Überhöhte Wochenarbeitszeit",
        "description": "Die gesetzliche Höchstarbeitszeit beträgt 48 Stunden/Woche (8h × 6 Tage). Nur ausnahmsweise bis 60h bei Ausgleich innerhalb von 6 Monaten.",
        "legal_reference": "§ 3, § 7 ArbZG",
        "suggestion": "Wochenarbeitszeit auf maximal 40-48 Stunden begrenzen. Über 48h nur mit tarifvertraglicher Grundlage und Ausgleichszeitraum.",
        "category": "arbeitszeit",
        "value_check": "arbeitszeit_stunden > 48"
    },
    # Kündigungsausschluss/Kündigungsverbot
    {
        "pattern": r"(kündigung|kündigungs).{0,60}(ausgeschlossen|unzulässig|unwirksam|verzicht|nicht\s+möglich|nicht\s+gestattet|nicht\s+erlaubt)",
        "severity": RiskSeverity.CRITICAL,
        "title": "Unzulässiger Kündigungsausschluss",
        "description": "Das ordentliche Kündigungsrecht kann nicht wirksam ausgeschlossen werden. Ein genereller Kündigungsverzicht ist unwirksam.",
        "legal_reference": "§ 622 BGB, § 307 BGB",
        "suggestion": "Textbaustein ersatzlos streichen. Beide Parteien behalten ihr Kündigungsrecht.",
        "category": "kuendigung"
    },

    # MITTEL: Prüfenswerte Formulierungen
    {
        "pattern": r"vertragsstrafe|konventionalstrafe",
        "severity": RiskSeverity.MEDIUM,
        "title": "Vertragsstrafe prüfen",
        "description": "Vertragsstrafen in Arbeitsverträgen sind nur eingeschränkt zulässig und müssen verhältnismäßig sein.",
        "legal_reference": "BAG 8 AZR 196/02, § 307 BGB",
        "suggestion": "Verhältnismäßigkeit prüfen (max. 1 Bruttomonatsgehalt). Bei Auszubildenden unzulässig.",
        "category": "vertragsstrafe"
    },
    {
        "pattern": r"nebentätigkeit.{0,30}(untersagt|verboten|genehmigung|erlaubnis)",
        "severity": RiskSeverity.MEDIUM,
        "title": "Nebentätigkeitsverbot prüfen",
        "description": "Pauschale Verbote von Nebentätigkeiten sind unwirksam. Nur genehmigungspflichtig bei berechtigtem Interesse.",
        "legal_reference": "§ 307 BGB, Art. 12 GG",
        "suggestion": "Genehmigungsvorbehalt statt Verbot. Genehmigung nur bei berechtigtem Interesse verweigerbar.",
        "category": "nebentaetigkeit"
    },
    {
        "pattern": r"(geheimhaltung|verschwiegenheit).{0,50}(unbefristet|unbegrenzt|ewig|lebenslang)",
        "severity": RiskSeverity.MEDIUM,
        "title": "Unbefristete Geheimhaltung",
        "description": "Unbefristete Geheimhaltungspflichten können unverhältnismäßig sein.",
        "legal_reference": "§ 307 BGB, GeschGehG",
        "suggestion": "Zeitliche Begrenzung prüfen (z.B. 3-5 Jahre nach Vertragsende), außer bei echten Geschäftsgeheimnissen.",
        "category": "geheimhaltung"
    },
    {
        "pattern": r"(homeoffice|remote|telearbeit).{0,30}(jederzeit|einseitig).{0,20}(widerruf|aufheb|beend)",
        "severity": RiskSeverity.MEDIUM,
        "title": "Einseitiger Homeoffice-Widerruf",
        "description": "Einseitiger Widerruf von Homeoffice-Vereinbarungen kann unwirksam sein.",
        "legal_reference": "§ 307 BGB, § 315 BGB",
        "suggestion": "Widerrufsvorbehalt an sachliche Gründe und Ankündigungsfrist knüpfen.",
        "category": "homeoffice"
    },

    # NIEDRIG: Hinweise
    {
        "pattern": r"ausschlussfrist.{0,30}(\d+)\s*monat",
        "severity": RiskSeverity.LOW,
        "title": "Ausschlussfrist prüfen",
        "description": "Ausschlussfristen unter 3 Monaten können unwirksam sein.",
        "legal_reference": "§ 307 BGB, BAG Rechtsprechung",
        "suggestion": "Ausschlussfrist auf mindestens 3 Monate setzen.",
        "category": "ausschlussfrist",
        "value_check": "ausschlussfrist_months < 3"
    },
    {
        "pattern": r"(salvatorische|teilnichtigkeit).{0,30}klausel",
        "severity": RiskSeverity.LOW,
        "title": "Salvatorische Klausel",
        "description": "Standard-Textbaustein zur Vertragserhaltung - normalerweise unproblematisch.",
        "legal_reference": "§ 306 BGB",
        "suggestion": "Keine Änderung erforderlich, aber Einzelfallprüfung bei komplexen Verträgen.",
        "category": "allgemein"
    },
]


class ComplianceService:
    """
    Service for compliance checking of employment documents.

    Two-tier approach:
    1. Fast pattern-based detection (offline, <100ms)
    2. Deep LLM analysis (optional, for complex cases)

    Usage:
        service = ComplianceService()
        result = await service.scan_content(html_content, country_code="DE")
    """

    def __init__(self, llm_service: Optional[LLMService] = None):
        self.llm = llm_service
        self.patterns = RISK_PATTERNS_DE

    def _strip_html(self, html: str) -> str:
        """Convert HTML to plain text for pattern matching."""
        soup = BeautifulSoup(html, "html.parser")
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        return soup.get_text(separator=" ").strip()

    def _compute_hash(self, content: str, country_code: str) -> str:
        """Compute hash of content for caching."""
        data = f"{content}:{country_code}".encode()
        return hashlib.sha256(data).hexdigest()[:16]

    def _calculate_score(self, risks: List[ComplianceRisk]) -> int:
        """
        Calculate compliance score (0-100).
        100 = No risks, 0 = Multiple critical risks
        """
        if not risks:
            return 100

        severity_weights = {
            RiskSeverity.LOW: 5,
            RiskSeverity.MEDIUM: 15,
            RiskSeverity.HIGH: 30,
            RiskSeverity.CRITICAL: 50
        }

        total_penalty = sum(severity_weights[r.severity] for r in risks)
        return max(0, 100 - total_penalty)

    def _check_value_condition(self, match: re.Match, condition: str) -> bool:
        """
        Check value-based conditions like "probezeit_months > 6".
        Returns True if the condition indicates a risk.
        """
        if not condition:
            return True  # No condition = always flag

        try:
            # Extract number from match
            groups = match.groups()
            for g in groups:
                if g and g.isdigit():
                    value = int(g)
                    # Parse condition
                    if ">" in condition:
                        threshold = int(condition.split(">")[1].strip())
                        return value > threshold
                    elif "<" in condition:
                        threshold = int(condition.split("<")[1].strip())
                        return value < threshold
        except (ValueError, IndexError):
            pass

        return True  # Default: flag it

    async def scan_content(
        self,
        content_html: str,
        country_code: str = "DE",
        document_type: Optional[str] = None,
        use_llm: bool = False,
        cache_enabled: bool = True,
        custom_instructions: str = ""
    ) -> ComplianceScanResult:
        """
        Scan document content for compliance risks.

        Args:
            content_html: HTML content to scan
            country_code: Country code (DE, AT, CH, IT)
            document_type: Optional document type for context
            use_llm: Enable deep LLM analysis
            cache_enabled: Use cached results if available

        Returns:
            ComplianceScanResult with risks and score
        """
        import time
        start_time = time.time()

        # Convert to plain text
        plain_text = self._strip_html(content_html)
        content_hash = self._compute_hash(plain_text, country_code)

        # Check cache (Redis via CacheService with memory fallback)
        if cache_enabled:
            cache_key = compliance_scan_key(content_hash, country_code, use_llm)
            cached_data = await cache.get(cache_key)
            if cached_data:
                logger.debug(f"Returning cached compliance scan: {content_hash}")
                return ComplianceScanResult(**cached_data)

        risks: List[ComplianceRisk] = []

        # Stage 1: Pattern-based detection
        plain_text_lower = plain_text.lower()

        for idx, pattern_def in enumerate(self.patterns):
            # Check if pattern applies to this country
            applicable_countries = pattern_def.get("country_codes", ["DE", "AT", "CH"])
            if country_code.upper() not in applicable_countries:
                continue

            regex = pattern_def["pattern"]
            # Use re.search instead of re.finditer to produce at most ONE
            # risk per pattern definition, avoiding duplicate warnings when
            # a pattern (e.g. "vertragsstrafe|konventionalstrafe") matches
            # multiple times in the same document.
            match = re.search(regex, plain_text_lower, re.IGNORECASE)

            if match:
                # Check value condition if present
                value_check = pattern_def.get("value_check")
                if value_check and not self._check_value_condition(match, value_check):
                    continue

                # Get the actual matched text from original (preserve case)
                start_pos = match.start()
                end_pos = match.end()

                # Expand to word boundaries for better context
                while start_pos > 0 and plain_text[start_pos - 1] not in " \n\t":
                    start_pos -= 1
                while end_pos < len(plain_text) and plain_text[end_pos] not in " \n\t":
                    end_pos += 1

                affected_text = plain_text[start_pos:end_pos].strip()

                # Create risk
                risk = ComplianceRisk(
                    id=f"pattern_{idx}_{match.start()}",
                    severity=pattern_def["severity"],
                    title=pattern_def["title"],
                    description=pattern_def["description"],
                    affected_text=affected_text,
                    start_position=start_pos,
                    end_position=end_pos,
                    suggestion=pattern_def.get("suggestion"),
                    legal_reference=pattern_def.get("legal_reference"),
                    category=pattern_def.get("category", "general")
                )
                risks.append(risk)

        # Stage 2: LLM-enhanced analysis (optional)
        provider = "pattern"
        if use_llm and self.llm and len(plain_text) > 100:
            try:
                llm_risks = await self._analyze_with_llm(plain_text, country_code, risks, custom_instructions)
                risks.extend(llm_risks)
                provider_info = await self.llm.get_provider_info()
                provider = provider_info.get("provider", "llm")
            except Exception as e:
                logger.warning(f"LLM analysis failed, using pattern-only: {e}")

        # Calculate score
        score = self._calculate_score(risks)

        # Create result
        duration_ms = int((time.time() - start_time) * 1000)
        result = ComplianceScanResult(
            risks=risks,
            overall_score=score,
            scanned_at=datetime.utcnow().isoformat(),
            provider=provider,
            scan_duration_ms=duration_ms,
            content_hash=content_hash
        )

        # Cache result (Redis with TTL, memory fallback)
        if cache_enabled:
            ttl = 7200 if use_llm else 3600  # 2h for LLM-enhanced, 1h for pattern-only
            await cache.set(
                compliance_scan_key(content_hash, country_code, use_llm),
                result.model_dump(),
                ttl=ttl,
            )

        logger.info(
            f"Compliance scan completed: {len(risks)} risks, "
            f"score={score}, duration={duration_ms}ms, provider={provider}"
        )

        return result

    async def _analyze_with_llm(
        self,
        text: str,
        country_code: str,
        existing_risks: List[ComplianceRisk],
        custom_instructions: str = ""
    ) -> List[ComplianceRisk]:
        """
        Deep analysis using LLM for complex/ambiguous cases.

        Optimized prompts for Mistral models.
        """
        if not self.llm:
            return []

        # Prepare context about existing risks
        existing_summaries = [
            f"- {r.title}: {r.affected_text[:50]}..."
            for r in existing_risks[:5]
        ]
        existing_context = "\n".join(existing_summaries) if existing_summaries else "Keine"

        country_name = {
            "DE": "Deutschland",
            "AT": "Österreich",
            "CH": "Schweiz",
            "IT": "Italien"
        }.get(country_code.upper(), "Deutschland")

        # Optimized prompt for Mistral (more structured, explicit instructions)
        system_prompt = f"""Du bist ein Experte für Arbeitsrecht in {country_name}.

AUFGABE: Analysiere den Vertragstext auf rechtliche Risiken, die NICHT durch einfache Muster erkennbar sind.

FOKUS auf:
1. Subtile Formulierungen die Arbeitnehmerrechte einschränken
2. Unklare oder mehrdeutige Textbausteine
3. Kombinationen von Textbausteine die problematisch sein könnten
4. Fehlende wichtige Regelungen

Bereits erkannte Risiken (NICHT wiederholen):
{existing_context}

ANTWORT-FORMAT (strikt JSON):
{{
  "additional_risks": [
    {{
      "title": "Kurzer Titel",
      "severity": "low|medium|high|critical",
      "description": "Beschreibung des Problems",
      "affected_text": "Relevanter Textausschnitt",
      "suggestion": "Empfohlene Änderung",
      "legal_reference": "Rechtliche Grundlage"
    }}
  ]
}}

Antworte NUR mit dem JSON-Objekt, ohne Erklärungen davor oder danach.{custom_instructions}"""

        user_prompt = f"""Vertragstext zur Analyse:

{text[:4000]}

Analysiere diesen Text und gib zusätzliche Risiken im JSON-Format zurück."""

        try:
            _llm_start = time.time()
            response = await self.llm.chat_json(
                messages=[
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=user_prompt)
                ],
                config=LLMConfig(
                    temperature=0.2,  # Low for consistent analysis
                    max_tokens=1500,
                    json_mode=True
                )
            )
            asyncio.create_task(log_llm_call(
                feature="compliance",
                latency_ms=int((time.time() - _llm_start) * 1000),
                user_id=None,
                country_code=country_code,
            ))

            llm_risks = []
            for idx, risk_data in enumerate(response.get("additional_risks", [])):
                try:
                    severity_str = risk_data.get("severity", "medium").lower()
                    severity = RiskSeverity(severity_str) if severity_str in RiskSeverity.__members__.values() else RiskSeverity.MEDIUM

                    risk = ComplianceRisk(
                        id=f"llm_{idx}_{hash(risk_data.get('title', ''))}",
                        severity=severity,
                        title=risk_data.get("title", "LLM-erkanntes Risiko"),
                        description=risk_data.get("description", ""),
                        affected_text=risk_data.get("affected_text", "")[:200],
                        start_position=0,  # LLM doesn't provide positions
                        end_position=0,
                        suggestion=risk_data.get("suggestion"),
                        legal_reference=risk_data.get("legal_reference"),
                        category="llm_analysis"
                    )
                    llm_risks.append(risk)
                except Exception as e:
                    logger.warning(f"Failed to parse LLM risk: {e}")

            return llm_risks

        except Exception as e:
            asyncio.create_task(log_llm_call(
                feature="compliance",
                latency_ms=int((time.time() - _llm_start) * 1000),
                error_message=str(e),
                country_code=country_code,
            ))
            logger.error(f"LLM analysis error: {e}")
            return []

    async def clear_cache(self):
        """Clear the compliance scan cache (Redis + memory)."""
        from app.services.cache import invalidate_compliance_cache
        await invalidate_compliance_cache()


# Singleton instance
compliance_service = ComplianceService()


async def get_compliance_service() -> ComplianceService:
    """Get compliance service with LLM support."""
    llm = await get_llm_service()
    return ComplianceService(llm_service=llm)
