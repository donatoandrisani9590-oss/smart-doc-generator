"""
Compliance API: Proactive risk detection for employment documents.

Endpoints:
- POST /scan: Scan document for compliance risks
- GET /patterns: Get available risk patterns
- GET /provider: Get active LLM provider info

Privacy: Uses Mistral AI (EU) or Ollama (local) - GDPR compliant.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.services.compliance_service import (
    ComplianceService,
    ComplianceScanResult,
    ComplianceRisk,
    RiskSeverity,
    get_compliance_service,
    RISK_PATTERNS_DE
)
from app.services.llm_service import get_llm_service

router = APIRouter(prefix="/compliance", tags=["compliance"])


class ComplianceScanRequest(BaseModel):
    """Request body for compliance scan."""
    content_html: str = Field(
        ...,
        min_length=10,
        description="HTML content to scan for compliance risks"
    )
    country_code: str = Field(
        default="DE",
        pattern="^(DE|AT|CH|IT)$",
        description="Country code for jurisdiction-specific checks"
    )
    document_type: Optional[str] = Field(
        default=None,
        description="Document type for context (e.g., 'arbeitsvertrag', 'kuendigung')"
    )
    use_llm: bool = Field(
        default=False,
        description="Enable deep LLM analysis (slower but more thorough)"
    )


class RiskPatternInfo(BaseModel):
    """Information about a risk detection pattern."""
    title: str
    severity: str
    description: str
    legal_reference: Optional[str]
    category: str
    applicable_countries: List[str]


class PatternListResponse(BaseModel):
    """Response with available patterns."""
    patterns: List[RiskPatternInfo]
    total_count: int


class ProviderInfoResponse(BaseModel):
    """Information about the active LLM provider."""
    provider: str
    model: str
    is_local: bool
    is_eu_hosted: bool
    available: bool


@router.post("/scan", response_model=ComplianceScanResult)
async def scan_document(
    request: ComplianceScanRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Scan document content for compliance risks.

    Returns a list of identified risks with severity, description,
    and actionable recommendations.

    **Two-tier approach:**
    1. Fast pattern-based detection (always, <100ms)
    2. Deep LLM analysis (optional, when use_llm=true)

    **Privacy:** All processing uses either:
    - Local Ollama (no data leaves machine)
    - Mistral AI API (EU-hosted, GDPR compliant)
    """
    try:
        service = await get_compliance_service()
        result = await service.scan_content(
            content_html=request.content_html,
            country_code=request.country_code,
            document_type=request.document_type,
            use_llm=request.use_llm
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Compliance scan failed: {str(e)}"
        )


@router.get("/patterns", response_model=PatternListResponse)
async def get_patterns(
    country_code: str = Query(
        default="DE",
        pattern="^(DE|AT|CH|IT)$",
        description="Filter patterns by country"
    ),
    severity: Optional[str] = Query(
        default=None,
        description="Filter by severity (low, medium, high, critical)"
    )
):
    """
    Get available risk detection patterns.

    Use this to understand what types of issues are detected
    and their legal basis.
    """
    patterns = []

    for p in RISK_PATTERNS_DE:
        # Filter by country
        applicable = p.get("country_codes", ["DE", "AT", "CH"])
        if country_code.upper() not in applicable:
            continue

        # Filter by severity
        if severity and p["severity"].value != severity:
            continue

        patterns.append(RiskPatternInfo(
            title=p["title"],
            severity=p["severity"].value,
            description=p["description"],
            legal_reference=p.get("legal_reference"),
            category=p.get("category", "general"),
            applicable_countries=applicable
        ))

    return PatternListResponse(
        patterns=patterns,
        total_count=len(patterns)
    )


@router.get("/provider", response_model=ProviderInfoResponse)
async def get_provider_info():
    """
    Get information about the active LLM provider.

    Returns which LLM backend is being used:
    - "ollama": Local inference (maximum privacy)
    - "mistral": Mistral AI API (EU-hosted)
    """
    try:
        llm = await get_llm_service()
        info = await llm.get_provider_info()
        return ProviderInfoResponse(
            provider=info.get("provider", "unknown"),
            model=info.get("model", "unknown"),
            is_local=info.get("is_local", False),
            is_eu_hosted=info.get("is_eu_hosted", False),
            available=True
        )
    except Exception as e:
        return ProviderInfoResponse(
            provider="none",
            model="none",
            is_local=False,
            is_eu_hosted=False,
            available=False
        )


@router.post("/analyze-clause")
async def analyze_single_clause(
    clause_text: str = Query(..., min_length=10, description="Clause text to analyze"),
    country_code: str = Query(default="DE", pattern="^(DE|AT|CH|IT)$")
):
    """
    Analyze a single clause for compliance risks.

    Convenience endpoint for checking individual clauses
    without full document context.
    """
    # Wrap in minimal HTML
    content_html = f"<p>{clause_text}</p>"

    service = await get_compliance_service()
    result = await service.scan_content(
        content_html=content_html,
        country_code=country_code,
        use_llm=True  # Always use LLM for single clause analysis
    )

    return {
        "clause_text": clause_text,
        "risks": result.risks,
        "score": result.overall_score,
        "is_compliant": len(result.risks) == 0 or all(r.severity == RiskSeverity.LOW for r in result.risks)
    }
