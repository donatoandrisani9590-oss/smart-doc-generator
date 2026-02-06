"""
User Management API endpoints.

Provides CRUD operations for user management (Admin only).
"""

from __future__ import annotations
from typing import Any, Annotated, Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from pydantic import BaseModel, EmailStr

from app.db import get_db
from app.api import deps
from app.models import core as core_models
from app.core.security import get_password_hash

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class UserResponse(BaseModel):
    """User data for API responses."""
    id: int
    email: str
    role: str
    country_code: Optional[str] = None
    is_active: bool
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    """Schema for creating a new user."""
    email: EmailStr
    password: str
    role: str = "user"  # 'admin' or 'user'
    country_code: Optional[str] = "DE"


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    country_code: Optional[str] = None
    is_active: Optional[bool] = None


class PasswordReset(BaseModel):
    """Schema for password reset - in body, NOT query params for security."""
    new_password: str


class UserListResponse(BaseModel):
    """Response for user list."""
    users: List[UserResponse]
    total: int
    page: int
    page_size: int


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def require_admin(current_user: core_models.User):
    """Check if user is admin."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nur Administratoren können diese Aktion ausführen"
        )


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/", response_model=UserListResponse)
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> Any:
    """
    List all users (Admin only).

    Supports filtering by search (email), role, and active status.
    """
    require_admin(current_user)

    # Base query
    query = select(core_models.User)

    # Apply filters
    conditions = []
    if search:
        conditions.append(core_models.User.email.ilike(f"%{search}%"))
    if role:
        conditions.append(core_models.User.role == role)
    if is_active is not None:
        conditions.append(core_models.User.is_active == is_active)

    if conditions:
        query = query.where(and_(*conditions))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.order_by(core_models.User.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    users = result.scalars().all()

    return UserListResponse(
        users=[
            UserResponse(
                id=u.id,
                email=u.email,
                role=u.role,
                country_code=u.country_code,
                is_active=u.is_active,
                created_at=u.created_at.isoformat() if u.created_at else None,
            )
            for u in users
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
) -> Any:
    """
    Get a specific user (Admin only).
    """
    require_admin(current_user)

    user = await db.get(core_models.User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Benutzer nicht gefunden"
        )

    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        country_code=user.country_code,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
) -> Any:
    """
    Create a new user (Admin only).
    """
    require_admin(current_user)

    # Check if email already exists
    existing_query = select(core_models.User).where(
        core_models.User.email == user_data.email.lower()
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ein Benutzer mit dieser E-Mail existiert bereits"
        )

    # Validate role
    if user_data.role not in ["admin", "user"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ungültige Rolle. Erlaubt: 'admin', 'user'"
        )

    # Create user
    new_user = core_models.User(
        email=user_data.email.lower(),
        password_hash=get_password_hash(user_data.password),
        role=user_data.role,
        country_code=user_data.country_code,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        role=new_user.role,
        country_code=new_user.country_code,
        is_active=new_user.is_active,
        created_at=new_user.created_at.isoformat() if new_user.created_at else None,
    )


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
) -> Any:
    """
    Update a user (Admin only).

    Can update email, role, country_code, and is_active status.
    """
    require_admin(current_user)

    user = await db.get(core_models.User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Benutzer nicht gefunden"
        )

    # Prevent deactivating yourself
    if user_id == current_user.id and user_data.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sie können sich nicht selbst deaktivieren"
        )

    # Prevent removing your own admin role
    if user_id == current_user.id and user_data.role and user_data.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sie können Ihre eigene Admin-Rolle nicht entfernen"
        )

    # Check email uniqueness if changing
    if user_data.email and user_data.email.lower() != user.email:
        existing_query = select(core_models.User).where(
            and_(
                core_models.User.email == user_data.email.lower(),
                core_models.User.id != user_id
            )
        )
        existing_result = await db.execute(existing_query)
        if existing_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ein Benutzer mit dieser E-Mail existiert bereits"
            )
        user.email = user_data.email.lower()

    # Validate role
    if user_data.role is not None:
        if user_data.role not in ["admin", "user"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ungültige Rolle. Erlaubt: 'admin', 'user'"
            )
        user.role = user_data.role

    if user_data.country_code is not None:
        user.country_code = user_data.country_code

    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        country_code=user.country_code,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
) -> None:
    """
    Delete a user (Admin only).

    Note: This is a soft-delete - sets is_active to False.
    """
    require_admin(current_user)

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sie können sich nicht selbst löschen"
        )

    user = await db.get(core_models.User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Benutzer nicht gefunden"
        )

    # Soft delete
    user.is_active = False
    await db.commit()


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    password_data: PasswordReset,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
) -> Any:
    """
    Reset a user's password (Admin only).

    Password is passed in request body for security (not in URL/query params).
    """
    require_admin(current_user)

    user = await db.get(core_models.User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Benutzer nicht gefunden"
        )

    new_password = password_data.new_password
    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwort muss mindestens 8 Zeichen lang sein"
        )

    user.password_hash = get_password_hash(new_password)
    await db.commit()

    return {"message": "Passwort wurde zurückgesetzt"}


@router.get("/stats/summary")
async def get_user_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
) -> Any:
    """
    Get user statistics (Admin only).
    """
    require_admin(current_user)

    # Total users
    total_query = select(func.count(core_models.User.id))
    total_result = await db.execute(total_query)
    total = total_result.scalar() or 0

    # Active users
    active_query = select(func.count(core_models.User.id)).where(
        core_models.User.is_active == True
    )
    active_result = await db.execute(active_query)
    active = active_result.scalar() or 0

    # Admin users
    admin_query = select(func.count(core_models.User.id)).where(
        core_models.User.role == "admin"
    )
    admin_result = await db.execute(admin_query)
    admins = admin_result.scalar() or 0

    return {
        "total_users": total,
        "active_users": active,
        "inactive_users": total - active,
        "admin_users": admins,
        "regular_users": total - admins,
    }
