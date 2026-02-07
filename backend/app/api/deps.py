import os
import logging
from typing import AsyncGenerator, Annotated, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.core.config import settings
from app.models.core import User

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=not settings.DEBUG)


class MockUser:
    """Mock user for DEBUG mode - allows testing without database."""
    id = 1
    email = "dev@example.com"
    role = "admin"
    country_code = "DE"
    is_active = True


async def get_current_user(
    request: Request,
    token: Annotated[Optional[str], Depends(oauth2_scheme)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None
) -> User:
    # DEBUG MODE: Return mock admin user without authentication
    # SECURITY: Only allowed when DEBUG=True AND not in production environment
    if settings.DEBUG:
        env = os.environ.get("ENVIRONMENT", "development").lower()
        if env in ("production", "prod", "staging"):
            logger.critical(
                "DEBUG mode is enabled in a production/staging environment! "
                "Auth bypass is DISABLED. Set DEBUG=False in production."
            )
        else:
            logger.warning("DEBUG mode active: returning mock admin user without authentication")
            return MockUser()

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    stmt = select(User).where(User.id == int(user_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user

async def get_current_active_admin(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=400, detail="The user doesn't have enough privileges"
        )
    return current_user
