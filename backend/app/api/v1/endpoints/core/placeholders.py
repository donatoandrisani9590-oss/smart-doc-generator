"""
Placeholder management and validation endpoints.

Provides:
- List of all known placeholders
- Validation of placeholder usage in clause content
"""

from __future__ import annotations
from typing import Any, List, Annotated, Optional, Dict
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api import deps
from app.models import documents as models
from app.services.placeholder_validator import (
    get_all_placeholders,
    get_placeholders_by_category,
    validate_placeholders,
)

router = APIRouter()


class PlaceholderResponse(BaseModel):
    """Single placeholder info."""
    name: str
    label: str
    type: str
    category: str
    example_value: Optional[str] = None


class PlaceholdersByCategory(BaseModel):
    """Placeholders grouped by category."""
    categories: Dict[str, List[PlaceholderResponse]]


class ValidationRequest(BaseModel):
    """Request body for placeholder validation."""
    content_html: str


class UnknownPlaceholder(BaseModel):
    """Info about an unknown placeholder found during validation."""
    name: str
    suggestions: List[str]
    suggestion_labels: List[str]


class ValidationResponse(BaseModel):
    """Response from placeholder validation."""
    is_valid: bool
    unknown_placeholders: List[UnknownPlaceholder]
    known_placeholders_used: List[str]


@router.get("", response_model=List[PlaceholderResponse])
async def list_placeholders(
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
) -> Any:
    """
    Get all known system placeholders.

    Returns a flat list of all available placeholders with their
    name, label, type, category, and example value.
    """
    return get_all_placeholders()


@router.get("/by-category")
async def list_placeholders_by_category(
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
) -> Any:
    """
    Get all placeholders grouped by category.

    Categories include: Mitarbeiter, Vertrag, Vergütung, Benefits,
    Unternehmen, Dokument, Zeugnis, Kündigung.
    """
    return get_placeholders_by_category()


@router.post("/validate", response_model=ValidationResponse)
async def validate_clause_placeholders(
    validation_request: ValidationRequest,
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
) -> Any:
    """
    Validate placeholders in clause HTML content.

    Checks if all {{ placeholder }} tags in the content match known
    system placeholders. For unknown placeholders, suggests similar
    alternatives based on spelling similarity.

    Returns:
    - is_valid: True if all placeholders are recognized
    - unknown_placeholders: List of unrecognized placeholders with suggestions
    - known_placeholders_used: List of valid placeholder names found
    """
    result = validate_placeholders(validation_request.content_html)
    return {
        "is_valid": result.is_valid,
        "unknown_placeholders": result.unknown_placeholders,
        "known_placeholders_used": result.known_placeholders_used
    }
