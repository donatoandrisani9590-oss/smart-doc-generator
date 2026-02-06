from datetime import timedelta
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

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


class UserRegister(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    password: str
    country_code: str = "DE"


class RegisterResponse(BaseModel):
    """Response after successful registration."""
    user: UserResponse
    access_token: str
    token_type: str = "bearer"


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
            detail="Falsche E-Mail oder Passwort",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Benutzerkonto ist deaktiviert")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=RegisterResponse)
async def register_user(
    register_data: UserRegister,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Register a new user account.

    Creates a new user with the provided email and password.
    Returns user data and access token for immediate login.
    """
    # Validate password strength (min 12 chars + complexity)
    password = register_data.password
    password_errors = []
    if len(password) < 12:
        password_errors.append("mindestens 12 Zeichen")
    if not any(c.isupper() for c in password):
        password_errors.append("mindestens einen Großbuchstaben")
    if not any(c.islower() for c in password):
        password_errors.append("mindestens einen Kleinbuchstaben")
    if not any(c.isdigit() for c in password):
        password_errors.append("mindestens eine Ziffer")
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?/~`" for c in password):
        password_errors.append("mindestens ein Sonderzeichen")
    if password_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Passwort benötigt: {', '.join(password_errors)}"
        )

    # Check if email already exists (case-insensitive)
    email_lower = register_data.email.lower()
    existing_query = select(User).where(User.email == email_lower)
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ein Benutzer mit dieser E-Mail existiert bereits"
        )

    # Create new user
    new_user = User(
        email=email_lower,
        password_hash=security.get_password_hash(register_data.password),
        role="user",  # New registrations are always regular users
        country_code=register_data.country_code,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Generate access token for immediate login
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=new_user.id, expires_delta=access_token_expires
    )

    return RegisterResponse(
        user=UserResponse(
            id=new_user.id,
            email=new_user.email,
            role=new_user.role,
            country_code=new_user.country_code,
            is_active=new_user.is_active,
        ),
        access_token=access_token,
        token_type="bearer"
    )


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
