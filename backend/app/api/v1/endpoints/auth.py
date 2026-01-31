from datetime import timedelta
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db import get_db
from app.core import security
from app.core.config import settings
from app.schemas import token as token_schema
from app.models.core import User
from app.api import deps

router = APIRouter()


class UserResponse(BaseModel):
    """User data for API responses."""
    id: int
    email: str
    role: str
    country_code: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


@router.post("/login", response_model=token_schema.Token)
async def login_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    stmt = select(User).where(User.email == form_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: Annotated[User, Depends(deps.get_current_user)]
):
    """
    Get current authenticated user information.

    Returns user details for the authenticated user.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        country_code=current_user.country_code,
        is_active=current_user.is_active,
    )
