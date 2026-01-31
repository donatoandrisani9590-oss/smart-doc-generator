"""
User Favorites API endpoints.

Allows users to mark document types and documents as favorites
for quick access from the dashboard and sidebar.
"""

from __future__ import annotations
from typing import Any, Annotated, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_
from pydantic import BaseModel

from app.db import get_db
from app.api import deps
from app.models import core as core_models
from app.models import enterprise as models
from app.models import documents as doc_models

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class FavoriteCreate(BaseModel):
    """Request body for creating a favorite."""
    favorite_type: str  # 'document_type' or 'document'
    document_type_id: Optional[int] = None
    document_id: Optional[int] = None
    display_name: Optional[str] = None


class FavoriteResponse(BaseModel):
    """Response for a single favorite."""
    id: int
    favorite_type: str
    document_type_id: Optional[int] = None
    document_id: Optional[int] = None
    display_name: Optional[str] = None
    display_order: int

    # Resolved names from relations
    resolved_name: str
    category: Optional[str] = None


class FavoriteReorderRequest(BaseModel):
    """Request body for reordering favorites."""
    favorite_ids: List[int]  # IDs in desired order


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/", response_model=List[FavoriteResponse])
async def list_favorites(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    favorite_type: Optional[str] = None,
) -> Any:
    """
    List all favorites for the current user.

    Optionally filter by favorite_type ('document_type' or 'document').
    Returns resolved names from related objects.
    """
    user_id = str(current_user.id)

    query = select(models.UserFavorite).where(
        models.UserFavorite.user_id == user_id
    ).order_by(models.UserFavorite.display_order)

    if favorite_type:
        query = query.where(models.UserFavorite.favorite_type == favorite_type)

    result = await db.execute(query)
    favorites = result.scalars().all()

    # Resolve names from related objects
    response = []
    for fav in favorites:
        resolved_name = fav.display_name or ""
        category = None

        if fav.favorite_type == "document_type" and fav.document_type_id:
            # Fetch document type name
            dt_result = await db.execute(
                select(doc_models.DocumentType).where(
                    doc_models.DocumentType.id == fav.document_type_id
                )
            )
            dt = dt_result.scalar_one_or_none()
            if dt:
                resolved_name = fav.display_name or dt.name
                category = dt.category

        elif fav.favorite_type == "document" and fav.document_id:
            # Fetch document info
            doc_result = await db.execute(
                select(models.GeneratedDocument).where(
                    models.GeneratedDocument.id == fav.document_id
                )
            )
            doc = doc_result.scalar_one_or_none()
            if doc:
                # Try to get document type name
                dt_result = await db.execute(
                    select(doc_models.DocumentType).where(
                        doc_models.DocumentType.id == doc.document_type_id
                    )
                )
                dt = dt_result.scalar_one_or_none()
                resolved_name = fav.display_name or (dt.name if dt else f"Dokument #{fav.document_id}")

        response.append(FavoriteResponse(
            id=fav.id,
            favorite_type=fav.favorite_type,
            document_type_id=fav.document_type_id,
            document_id=fav.document_id,
            display_name=fav.display_name,
            display_order=fav.display_order,
            resolved_name=resolved_name,
            category=category,
        ))

    return response


@router.post("/", response_model=FavoriteResponse)
async def add_favorite(
    favorite_in: FavoriteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
) -> Any:
    """
    Add a new favorite for the current user.

    For document_type favorites, provide document_type_id.
    For document favorites, provide document_id.
    """
    user_id = str(current_user.id)

    # Validate input
    if favorite_in.favorite_type not in ("document_type", "document"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="favorite_type must be 'document_type' or 'document'"
        )

    if favorite_in.favorite_type == "document_type" and not favorite_in.document_type_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="document_type_id required for document_type favorites"
        )

    if favorite_in.favorite_type == "document" and not favorite_in.document_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="document_id required for document favorites"
        )

    # Check if already favorited
    existing_query = select(models.UserFavorite).where(
        and_(
            models.UserFavorite.user_id == user_id,
            models.UserFavorite.favorite_type == favorite_in.favorite_type,
        )
    )

    if favorite_in.document_type_id:
        existing_query = existing_query.where(
            models.UserFavorite.document_type_id == favorite_in.document_type_id
        )
    elif favorite_in.document_id:
        existing_query = existing_query.where(
            models.UserFavorite.document_id == favorite_in.document_id
        )

    existing_result = await db.execute(existing_query)
    existing = existing_result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already in favorites"
        )

    # Get max display_order for new favorite
    max_order_result = await db.execute(
        select(models.UserFavorite.display_order)
        .where(models.UserFavorite.user_id == user_id)
        .order_by(models.UserFavorite.display_order.desc())
        .limit(1)
    )
    max_order = max_order_result.scalar() or 0

    # Create favorite
    favorite = models.UserFavorite(
        user_id=user_id,
        favorite_type=favorite_in.favorite_type,
        document_type_id=favorite_in.document_type_id,
        document_id=favorite_in.document_id,
        display_name=favorite_in.display_name,
        display_order=max_order + 1,
    )

    db.add(favorite)
    await db.commit()
    await db.refresh(favorite)

    # Resolve name for response
    resolved_name = favorite.display_name or ""
    category = None

    if favorite.favorite_type == "document_type" and favorite.document_type_id:
        dt_result = await db.execute(
            select(doc_models.DocumentType).where(
                doc_models.DocumentType.id == favorite.document_type_id
            )
        )
        dt = dt_result.scalar_one_or_none()
        if dt:
            resolved_name = favorite.display_name or dt.name
            category = dt.category

    return FavoriteResponse(
        id=favorite.id,
        favorite_type=favorite.favorite_type,
        document_type_id=favorite.document_type_id,
        document_id=favorite.document_id,
        display_name=favorite.display_name,
        display_order=favorite.display_order,
        resolved_name=resolved_name,
        category=category,
    )


@router.delete("/{favorite_id}")
async def remove_favorite(
    favorite_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
) -> Any:
    """Remove a favorite by ID."""
    user_id = str(current_user.id)

    result = await db.execute(
        select(models.UserFavorite).where(
            and_(
                models.UserFavorite.id == favorite_id,
                models.UserFavorite.user_id == user_id,
            )
        )
    )
    favorite = result.scalar_one_or_none()

    if not favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Favorite not found"
        )

    await db.delete(favorite)
    await db.commit()

    return {"status": "removed", "id": favorite_id}


@router.post("/toggle")
async def toggle_favorite(
    favorite_in: FavoriteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
) -> Any:
    """
    Toggle a favorite on/off.

    If the item is not favorited, add it.
    If the item is already favorited, remove it.
    Returns the current state.
    """
    user_id = str(current_user.id)

    # Build query to find existing favorite
    existing_query = select(models.UserFavorite).where(
        and_(
            models.UserFavorite.user_id == user_id,
            models.UserFavorite.favorite_type == favorite_in.favorite_type,
        )
    )

    if favorite_in.document_type_id:
        existing_query = existing_query.where(
            models.UserFavorite.document_type_id == favorite_in.document_type_id
        )
    elif favorite_in.document_id:
        existing_query = existing_query.where(
            models.UserFavorite.document_id == favorite_in.document_id
        )

    existing_result = await db.execute(existing_query)
    existing = existing_result.scalar_one_or_none()

    if existing:
        # Remove existing favorite
        await db.delete(existing)
        await db.commit()
        return {"is_favorite": False, "action": "removed"}
    else:
        # Add new favorite
        max_order_result = await db.execute(
            select(models.UserFavorite.display_order)
            .where(models.UserFavorite.user_id == user_id)
            .order_by(models.UserFavorite.display_order.desc())
            .limit(1)
        )
        max_order = max_order_result.scalar() or 0

        favorite = models.UserFavorite(
            user_id=user_id,
            favorite_type=favorite_in.favorite_type,
            document_type_id=favorite_in.document_type_id,
            document_id=favorite_in.document_id,
            display_name=favorite_in.display_name,
            display_order=max_order + 1,
        )

        db.add(favorite)
        await db.commit()
        return {"is_favorite": True, "action": "added", "id": favorite.id}


@router.post("/reorder")
async def reorder_favorites(
    reorder_request: FavoriteReorderRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
) -> Any:
    """
    Reorder the user's favorites.

    Provide a list of favorite IDs in the desired order.
    """
    user_id = str(current_user.id)

    for idx, fav_id in enumerate(reorder_request.favorite_ids):
        await db.execute(
            models.UserFavorite.__table__.update()
            .where(
                and_(
                    models.UserFavorite.id == fav_id,
                    models.UserFavorite.user_id == user_id,
                )
            )
            .values(display_order=idx)
        )

    await db.commit()
    return {"status": "reordered", "count": len(reorder_request.favorite_ids)}


@router.get("/check/{favorite_type}/{item_id}")
async def check_is_favorite(
    favorite_type: str,
    item_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
) -> Any:
    """
    Check if a specific item is favorited by the current user.

    Returns {is_favorite: true/false}
    """
    user_id = str(current_user.id)

    query = select(models.UserFavorite.id).where(
        and_(
            models.UserFavorite.user_id == user_id,
            models.UserFavorite.favorite_type == favorite_type,
        )
    )

    if favorite_type == "document_type":
        query = query.where(models.UserFavorite.document_type_id == item_id)
    elif favorite_type == "document":
        query = query.where(models.UserFavorite.document_id == item_id)

    result = await db.execute(query)
    favorite = result.scalar_one_or_none()

    return {"is_favorite": favorite is not None}
