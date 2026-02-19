"""
Feature Settings API

Endpoints for managing user-specific feature toggles.
All features are enabled by default (opt-out model).
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

from app.db import get_db
from app.api.deps import get_current_user
from app.models.user_settings import (
    UserFeatureSettings,
    FEATURE_DEFINITIONS,
    FEATURE_CATEGORIES,
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class FeatureDefinition(BaseModel):
    """Definition of a single feature."""
    key: str
    label: str
    description: str
    category: str
    icon: str
    enabled: bool
    optional: bool = False


class FeatureCategory(BaseModel):
    """Category grouping for features."""
    key: str
    label: str
    icon: str
    features: List[FeatureDefinition]


class FeatureSettingsResponse(BaseModel):
    """Complete feature settings response."""
    categories: List[FeatureCategory]
    raw_settings: Dict[str, bool]


class FeatureSettingsUpdate(BaseModel):
    """Request to update feature settings."""
    settings: Dict[str, bool] = Field(..., description="Feature key -> enabled status")


class SingleFeatureUpdate(BaseModel):
    """Request to toggle a single feature."""
    enabled: bool


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

async def get_or_create_settings(
    db: AsyncSession, user_id: int
) -> UserFeatureSettings:
    """Get existing settings or create defaults for user."""
    result = await db.execute(
        select(UserFeatureSettings).where(UserFeatureSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        # Create default settings (all enabled)
        settings = UserFeatureSettings(user_id=user_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return settings


def settings_to_dict(settings: UserFeatureSettings) -> Dict[str, bool]:
    """Convert settings model to dictionary.

    Dynamically reads all keys from FEATURE_DEFINITIONS so that
    newly added features are automatically included without having
    to update this function.  Falls back to the feature's default
    value (True, except where defined otherwise) when a column
    does not exist yet in the DB (migration pending).
    """
    # Defaults per feature (most are True)
    _DEFAULTS: Dict[str, bool] = {
        "compact_sidebar": False,
        "enable_email_ingest": False,
    }
    result: Dict[str, bool] = {}
    for key in FEATURE_DEFINITIONS:
        try:
            value = getattr(settings, key, None)
            result[key] = value if value is not None else _DEFAULTS.get(key, True)
        except Exception:
            # Column might not exist yet on production DB
            result[key] = _DEFAULTS.get(key, True)
    return result


def build_categories_response(settings_dict: Dict[str, bool]) -> List[FeatureCategory]:
    """Build categorized feature list with current values."""
    # Group features by category
    categories_data: Dict[str, List[FeatureDefinition]] = {}

    for key, definition in FEATURE_DEFINITIONS.items():
        cat = definition["category"]
        if cat not in categories_data:
            categories_data[cat] = []

        categories_data[cat].append(FeatureDefinition(
            key=key,
            label=definition["label"],
            description=definition["description"],
            category=cat,
            icon=definition["icon"],
            enabled=settings_dict.get(key, True),
            optional=definition.get("optional", False),
        ))

    # Build response with category metadata
    result = []
    for cat_key, cat_meta in FEATURE_CATEGORIES.items():
        if cat_key in categories_data:
            result.append(FeatureCategory(
                key=cat_key,
                label=cat_meta["label"],
                icon=cat_meta["icon"],
                features=categories_data[cat_key],
            ))

    return result


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("", response_model=FeatureSettingsResponse)
async def get_feature_settings(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get current user's feature settings.

    Returns categorized list of all features with their current enabled status.
    All features default to enabled (opt-out model).
    """
    try:
        settings = await get_or_create_settings(db, current_user.id)
        settings_dict = settings_to_dict(settings)
    except Exception as exc:
        # Graceful fallback when user_feature_settings table is missing
        # columns (migration not yet applied on production)
        logger.warning("Feature-Settings DB-Fehler (Migration ausstehend?): %s", exc)
        _DEFAULTS: Dict[str, bool] = {
            "compact_sidebar": False,
            "enable_email_ingest": False,
        }
        settings_dict = {key: _DEFAULTS.get(key, True) for key in FEATURE_DEFINITIONS}

    return FeatureSettingsResponse(
        categories=build_categories_response(settings_dict),
        raw_settings=settings_dict,
    )


@router.put("", response_model=FeatureSettingsResponse)
async def update_feature_settings(
    request: FeatureSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Update multiple feature settings at once.

    Only updates the features specified in the request.
    Returns the complete updated settings.
    """
    settings = await get_or_create_settings(db, current_user.id)

    # Update only valid feature keys
    valid_keys = set(FEATURE_DEFINITIONS.keys())
    for key, value in request.settings.items():
        if key in valid_keys and hasattr(settings, key):
            setattr(settings, key, value)

    await db.commit()
    await db.refresh(settings)

    settings_dict = settings_to_dict(settings)

    return FeatureSettingsResponse(
        categories=build_categories_response(settings_dict),
        raw_settings=settings_dict,
    )


@router.patch("/{feature_key}", response_model=FeatureSettingsResponse)
async def toggle_single_feature(
    feature_key: str,
    request: SingleFeatureUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Toggle a single feature on or off.

    Path parameter:
    - feature_key: The feature to toggle (e.g., "show_deadlines_widget")
    """
    if feature_key not in FEATURE_DEFINITIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown feature: {feature_key}"
        )

    settings = await get_or_create_settings(db, current_user.id)

    if not hasattr(settings, feature_key):
        raise HTTPException(
            status_code=400,
            detail=f"Feature not configurable: {feature_key}"
        )

    setattr(settings, feature_key, request.enabled)
    await db.commit()
    await db.refresh(settings)

    settings_dict = settings_to_dict(settings)

    return FeatureSettingsResponse(
        categories=build_categories_response(settings_dict),
        raw_settings=settings_dict,
    )


@router.post("/reset", response_model=FeatureSettingsResponse)
async def reset_to_defaults(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Reset all feature settings to defaults (all enabled).
    """
    settings = await get_or_create_settings(db, current_user.id)

    # Reset all features to their default value (True, except special cases)
    _DEFAULTS: Dict[str, bool] = {
        "compact_sidebar": False,
        "enable_email_ingest": False,
    }
    for key in FEATURE_DEFINITIONS:
        default = _DEFAULTS.get(key, True)
        if hasattr(settings, key):
            try:
                setattr(settings, key, default)
            except Exception:
                pass  # Column may not exist in DB yet

    await db.commit()
    await db.refresh(settings)

    settings_dict = settings_to_dict(settings)

    return FeatureSettingsResponse(
        categories=build_categories_response(settings_dict),
        raw_settings=settings_dict,
    )


@router.get("/definitions")
async def get_feature_definitions():
    """
    Get all feature definitions (public, no auth required).

    Returns the feature catalog without user-specific settings.
    Useful for documentation and onboarding.
    """
    return {
        "features": FEATURE_DEFINITIONS,
        "categories": FEATURE_CATEGORIES,
    }


@router.get("/check/{feature_key}")
async def check_feature_enabled(
    feature_key: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Quick check if a specific feature is enabled for current user.

    Returns a simple boolean response for conditional rendering.
    """
    if feature_key not in FEATURE_DEFINITIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown feature: {feature_key}"
        )

    settings = await get_or_create_settings(db, current_user.id)
    enabled = getattr(settings, feature_key, True)

    return {
        "feature": feature_key,
        "enabled": enabled,
        "optional": FEATURE_DEFINITIONS[feature_key].get("optional", False),
    }
