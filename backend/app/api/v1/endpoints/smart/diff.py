"""
Diff Endpoint -- Berechnet wortweisen Diff zwischen zwei Texten.

POST /api/v1/smart/diff
"""
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.services.diff_service import compute_diff, DiffOperation, DiffResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/smart/diff", tags=["smart-diff"])


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class DiffRequest(BaseModel):
    """Request für einen Text-Diff."""
    original: str = Field(..., min_length=1, max_length=50000)
    modified: str = Field(..., min_length=1, max_length=50000)
    granularity: Optional[str] = Field("word", pattern="^(word|sentence)$")


class DiffOperationResponse(BaseModel):
    """Einzelne Diff-Operation."""
    type: str
    text: str


class DiffResponse(BaseModel):
    """Ergebnis des Text-Vergleichs."""
    operations: List[DiffOperationResponse]
    stats: dict


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════

@router.post("", response_model=DiffResponse)
async def diff_texts(
    request: DiffRequest,
    current_user=Depends(get_current_user),
):
    """
    Wortweisen Diff zwischen zwei Texten berechnen.

    Gibt strukturierte Diff-Operationen zurück (equal, insert, delete)
    mit Statistik über Einfügungen und Löschungen.
    """
    try:
        result = compute_diff(
            original=request.original,
            modified=request.modified,
            granularity=request.granularity or "word",
        )

        return DiffResponse(
            operations=[
                DiffOperationResponse(type=op.type, text=op.text)
                for op in result.operations
            ],
            stats=result.stats,
        )

    except Exception as e:
        logger.error("Fehler beim Berechnen des Diff: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Diff-Berechnung fehlgeschlagen.",
        )
