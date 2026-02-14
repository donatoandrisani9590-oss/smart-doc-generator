"""
Consistency Check API: Cross-document contradiction detection.

Compares form_data fields of the current document against finalized
documents for the same employee. Detects inconsistencies like
different Gerichtsstand, Gehalt, or Kündigungsfrist.

Privacy: Uses Mistral AI (EU) or Ollama (local) - GDPR compliant.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.services.consistency_service import ConsistencyService, ConsistencyCheckResult
from app.services.llm_service import get_llm_service
from app.services.ai_instructions import get_ai_instructions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/smart/consistency", tags=["smart-consistency"])


# =============================================================================
# MODELS
# =============================================================================

class ConsistencyCheckRequest(BaseModel):
    """Request body for consistency check."""
    employee_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Full employee name (Vorname + Nachname)",
    )
    employee_id: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Employee ID / Personalnummer",
    )
    form_data: dict = Field(
        ...,
        description="Current document form data to check against historical documents",
    )
    country_code: str = Field(
        default="DE",
        pattern="^(DE|AT|CH|IT)$",
        description="Country code for localization",
    )
    document_type_id: Optional[int] = Field(
        default=None,
        description="Document type ID for context-aware instructions",
    )
    use_llm: bool = Field(
        default=False,
        description="Enable LLM analysis for subtle cross-field contradictions",
    )


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/check", response_model=ConsistencyCheckResult)
async def check_consistency(
    request: ConsistencyCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Check current document data against historical documents for the same employee.

    Detects inconsistencies in form_data fields like Gerichtsstand, Gehalt,
    Wochenstunden, Urlaubstage, Kündigungsfrist etc.
    """
    # Optional LLM service
    llm_service = None
    if request.use_llm:
        try:
            llm_service = await get_llm_service()
        except RuntimeError as e:
            raise HTTPException(
                status_code=503,
                detail=f"KI-Service nicht verfügbar: {str(e)}",
            )

    # Optional custom AI instructions
    custom_instructions = ""
    if request.use_llm:
        try:
            custom_instructions = await get_ai_instructions(
                db, request.country_code, request.document_type_id
            )
        except (ValueError, KeyError, AttributeError, TypeError):
            pass

    try:
        service = ConsistencyService(db=db, llm_service=llm_service)
        result = await service.check_consistency(
            employee_name=request.employee_name,
            employee_id=request.employee_id,
            current_form_data=request.form_data,
            document_type_id=request.document_type_id,
            use_llm=request.use_llm,
            custom_instructions=custom_instructions,
        )
        return result

    except Exception as e:
        logger.error(f"Konsistenzprüfung fehlgeschlagen: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Konsistenzprüfung fehlgeschlagen: {str(e)}",
        )
