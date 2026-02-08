import logging
from typing import Annotated, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.core.config import settings
from app.models.core import User

logger = logging.getLogger(__name__)

# In production, always require a token. In dev with auth bypass, make token optional.
_auth_bypass_active = (
    settings.DEBUG
    and settings.ALLOW_AUTH_BYPASS
    and settings.ENVIRONMENT.lower() not in ("production", "prod", "staging")
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=not _auth_bypass_active,
)


class MockUser:
    """Mock user for local development only — never admin by default."""
    id = 1
    email = "dev@example.com"
    role = "user"
    country_code = "DE"
    is_active = True
    totp_enabled = False
    totp_secret = None
    sso_provider = None
    sso_subject_id = None
    display_name = None
    failed_login_attempts = 0
    locked_until = None


async def get_current_user(
    request: Request,
    token: Annotated[Optional[str], Depends(oauth2_scheme)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> User:
    # Auth bypass: requires DEBUG=True AND ALLOW_AUTH_BYPASS=True AND non-production env
    if _auth_bypass_active:
        logger.warning(
            "Auth bypass active (DEBUG=True, ALLOW_AUTH_BYPASS=True, ENV=%s). "
            "DO NOT use in production.",
            settings.ENVIRONMENT,
        )
        return MockUser()

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Ungültige Anmeldedaten",
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
        raise HTTPException(status_code=400, detail="Benutzer ist deaktiviert")
    return user


async def get_current_active_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403, detail="Unzureichende Berechtigungen"
        )
    return current_user
