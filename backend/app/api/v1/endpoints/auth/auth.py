from datetime import timedelta, datetime, timezone
from typing import Annotated, Optional
import logging
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

logger = logging.getLogger(__name__)

router = APIRouter()


class UserResponse(BaseModel):
    """User data for API responses."""
    id: int
    email: str
    role: str
    country_code: Optional[str] = None
    is_active: bool
    totp_enabled: bool = False

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
    """
    Login endpoint with brute-force protection (SEC-017).

    Security features:
    - Account lockout after 5 failed attempts (15 minutes)
    - Generic error messages to prevent user enumeration
    - Failed attempt counter per user
    """
    stmt = select(User).where(User.email == form_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # Check if account is locked
    if user and user.locked_until:
        if user.locked_until > datetime.now(timezone.utc):
            remaining_seconds = int((user.locked_until - datetime.now(timezone.utc)).total_seconds())
            logger.warning(f"Login attempt for locked account: {user.email}")
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account temporarily locked due to multiple failed login attempts. "
                       f"Please try again in {remaining_seconds // 60} minutes.",
                headers={"WWW-Authenticate": "Bearer", "Retry-After": str(remaining_seconds)},
            )
        else:
            # Lock expired - reset counters
            user.locked_until = None
            user.failed_login_attempts = 0
            await db.commit()

    # Verify credentials
    if not user or not security.verify_password(form_data.password, user.password_hash):
        # Increment failed login attempts
        if user:
            user.failed_login_attempts += 1

            # Lock account after 5 failed attempts
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
                logger.warning(f"Account locked due to 5 failed attempts: {user.email}")

            await db.commit()

        # IMPORTANT: Same error message for both cases to prevent user enumeration
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falsche E-Mail oder Passwort",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Benutzerkonto ist deaktiviert")

    # Successful login - reset failed attempts
    if user.failed_login_attempts > 0:
        user.failed_login_attempts = 0
        user.locked_until = None
        await db.commit()

    # Check if 2FA is enabled
    if user.totp_enabled:
        # Return a short-lived pre-auth token (5 min) - user must verify TOTP
        pre_auth_token = security.create_pre_auth_token(user.id)
        logger.info(f"2FA required for: {user.email}")
        return {"access_token": pre_auth_token, "token_type": "bearer", "requires_2fa": True}

    logger.info(f"Successful login: {user.email}")

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
    # Use generic error message to prevent user enumeration
    email_lower = register_data.email.lower()
    existing_query = select(User).where(User.email == email_lower)
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registrierung fehlgeschlagen. Bitte ueberpruefen Sie Ihre Eingaben."
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
        totp_enabled=current_user.totp_enabled or False,
    )


# ═══════════════════════════════════════════════════════════════════════════
# TWO-FACTOR AUTHENTICATION (TOTP)
# ═══════════════════════════════════════════════════════════════════════════

class TwoFactorVerifyRequest(BaseModel):
    pre_auth_token: str
    totp_code: str


class TwoFactorSetupResponse(BaseModel):
    secret: str
    qr_uri: str


class TwoFactorConfirmRequest(BaseModel):
    totp_code: str


class TwoFactorDisableRequest(BaseModel):
    password: str
    totp_code: str


@router.post("/2fa/verify")
async def verify_two_factor(
    data: TwoFactorVerifyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Verify TOTP code after successful password login.
    Exchanges pre-auth token + valid TOTP code for a real access token.
    """
    import pyotp

    user_id = security.verify_pre_auth_token(data.pre_auth_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiger oder abgelaufener Authentifizierungstoken.",
        )

    user = await db.get(User, int(user_id))
    if not user or not user.is_active or not user.totp_enabled or not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="2FA-Verifizierung fehlgeschlagen.",
        )

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(data.totp_code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiger Code. Bitte versuchen Sie es erneut.",
        )

    logger.info(f"2FA verified for: {user.email}")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_two_factor(
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Begin 2FA setup. Generates a TOTP secret and returns the provisioning URI
    for QR code display. Does NOT enable 2FA yet - user must confirm with a valid code.
    """
    import pyotp

    secret = pyotp.random_base32()
    current_user.totp_secret = secret
    await db.commit()

    totp = pyotp.TOTP(secret)
    qr_uri = totp.provisioning_uri(
        name=current_user.email,
        issuer_name=settings.PROJECT_NAME,
    )

    return TwoFactorSetupResponse(secret=secret, qr_uri=qr_uri)


@router.post("/2fa/confirm")
async def confirm_two_factor(
    data: TwoFactorConfirmRequest,
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Confirm 2FA setup by verifying a TOTP code. This enables 2FA for the user.
    Must be called after /2fa/setup with a valid code from the authenticator app.
    """
    import pyotp

    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA-Setup wurde nicht gestartet. Rufen Sie zuerst /2fa/setup auf.",
        )

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(data.totp_code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ungültiger Code. Bitte scannen Sie den QR-Code erneut und geben Sie den aktuellen Code ein.",
        )

    current_user.totp_enabled = True
    await db.commit()

    logger.info(f"2FA enabled for: {current_user.email}")
    return {"message": "Zwei-Faktor-Authentifizierung wurde erfolgreich aktiviert."}


@router.post("/2fa/disable")
async def disable_two_factor(
    data: TwoFactorDisableRequest,
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Disable 2FA. Requires password and a valid TOTP code for security.
    """
    import pyotp

    if not security.verify_password(data.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwort ist falsch.",
        )

    if not current_user.totp_enabled or not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA ist nicht aktiviert.",
        )

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(data.totp_code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ungültiger Code.",
        )

    current_user.totp_enabled = False
    current_user.totp_secret = None
    await db.commit()

    logger.info(f"2FA disabled for: {current_user.email}")
    return {"message": "Zwei-Faktor-Authentifizierung wurde deaktiviert."}


@router.get("/2fa/status")
async def get_two_factor_status(
    current_user: Annotated[User, Depends(deps.get_current_user)],
):
    """Get current 2FA status for the authenticated user."""
    return {"enabled": current_user.totp_enabled or False}


# ═══════════════════════════════════════════════════════════════════════════
# PASSWORD RESET & CHANGE
# ═══════════════════════════════════════════════════════════════════════════

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


def _validate_password(password: str) -> list[str]:
    """Validate password strength. Returns list of error messages."""
    errors = []
    if len(password) < 12:
        errors.append("mindestens 12 Zeichen")
    if not any(c.isupper() for c in password):
        errors.append("mindestens einen Großbuchstaben")
    if not any(c.islower() for c in password):
        errors.append("mindestens einen Kleinbuchstaben")
    if not any(c.isdigit() for c in password):
        errors.append("mindestens eine Ziffer")
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?/~`" for c in password):
        errors.append("mindestens ein Sonderzeichen")
    return errors


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Request a password reset email.

    Always returns success to prevent user enumeration.
    If email exists, sends a reset link via Celery email task.
    """
    stmt = select(User).where(User.email == data.email.lower())
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user and user.is_active:
        reset_token = security.create_password_reset_token(user.id)

        # Queue email via Celery (if mail is configured)
        if settings.mail_enabled:
            from app.tasks.email_tasks import send_notification_email
            # Build frontend reset URL
            frontend_url = settings.CORS_ORIGINS.split(",")[0].strip()
            reset_url = f"{frontend_url}/reset-password?token={reset_token}"

            send_notification_email.delay(
                to_email=user.email,
                title="Passwort zurücksetzen",
                message=f"Klicken Sie auf den Button unten, um Ihr Passwort zurückzusetzen. "
                        f"Der Link ist 1 Stunde gültig.",
                priority="high",
                action_url=f"/reset-password?token={reset_token}",
                metadata={"E-Mail": user.email},
            )
            logger.info(f"Password reset email queued for {user.email}")
        else:
            logger.warning(f"Password reset requested but mail is disabled. Token: {reset_token}")

    # Always return success to prevent user enumeration
    return {
        "message": "Falls ein Konto mit dieser E-Mail existiert, wurde eine E-Mail zum Zurücksetzen des Passworts gesendet."
    }


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Reset password using a valid reset token.
    """
    user_id = security.verify_password_reset_token(data.token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ungültiger oder abgelaufener Reset-Link. Bitte fordern Sie einen neuen an.",
        )

    # Validate new password
    password_errors = _validate_password(data.new_password)
    if password_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Passwort benötigt: {', '.join(password_errors)}",
        )

    user = await db.get(User, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ungültiger oder abgelaufener Reset-Link.",
        )

    user.password_hash = security.get_password_hash(data.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    logger.info(f"Password reset successful for {user.email}")
    return {"message": "Passwort wurde erfolgreich zurückgesetzt. Sie können sich jetzt anmelden."}


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: Annotated[User, Depends(deps.get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Change password for the authenticated user.
    Requires current password for verification.
    """
    if not security.verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aktuelles Passwort ist falsch.",
        )

    password_errors = _validate_password(data.new_password)
    if password_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Neues Passwort benötigt: {', '.join(password_errors)}",
        )

    current_user.password_hash = security.get_password_hash(data.new_password)
    await db.commit()

    logger.info(f"Password changed for {current_user.email}")
    return {"message": "Passwort wurde erfolgreich geändert."}
