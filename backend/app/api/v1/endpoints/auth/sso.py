"""
SSO / OAuth2 (OIDC) Authentication Endpoints

Supports:
- Microsoft Entra ID (Azure AD)
- Google Workspace
- Custom OIDC providers

Flow:
1. Frontend redirects to GET /auth/sso/authorize
2. Backend redirects to SSO provider's login page
3. User authenticates with SSO provider
4. Provider redirects back to GET /auth/sso/callback
5. Backend exchanges code for tokens, creates/finds user
6. Backend redirects to frontend with JWT token
"""
from __future__ import annotations

import logging
import secrets
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.core.config import settings
from app.core import security
from app.models.core import User

logger = logging.getLogger(__name__)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# OIDC PROVIDER CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

# Well-known OIDC configuration for supported providers
PROVIDER_CONFIGS = {
    "azure_ad": {
        "label": "Microsoft",
        "icon": "microsoft",
        "authorize_url": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
        "token_url": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        "userinfo_url": "https://graph.microsoft.com/v1.0/me",
        "scopes": "openid email profile User.Read",
    },
    "google": {
        "label": "Google",
        "icon": "google",
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://openidconnect.googleapis.com/v1/userinfo",
        "scopes": "openid email profile",
    },
}


def _get_provider_urls() -> dict:
    """Get OAuth2 URLs for the configured provider."""
    provider = settings.SSO_PROVIDER
    if provider not in PROVIDER_CONFIGS:
        raise HTTPException(
            status_code=500,
            detail=f"SSO-Provider '{provider}' ist nicht konfiguriert.",
        )
    config = PROVIDER_CONFIGS[provider]
    tenant = settings.SSO_TENANT_ID or "common"
    return {
        "authorize_url": config["authorize_url"].format(tenant=tenant),
        "token_url": config["token_url"].format(tenant=tenant),
        "userinfo_url": config["userinfo_url"],
        "scopes": config["scopes"],
    }


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/sso/providers")
async def list_sso_providers():
    """
    List available SSO providers.
    Returns empty list if SSO is not configured.
    Used by frontend to show/hide SSO login buttons.
    """
    if not settings.sso_enabled:
        return {"providers": [], "sso_enabled": False}

    provider = settings.SSO_PROVIDER
    config = PROVIDER_CONFIGS.get(provider, {})

    return {
        "sso_enabled": True,
        "providers": [
            {
                "id": provider,
                "label": config.get("label", provider),
                "icon": config.get("icon", "key"),
                "authorize_url": f"{settings.API_V1_STR}/auth/sso/authorize",
            }
        ],
    }


@router.get("/sso/authorize")
async def sso_authorize(request: Request):
    """
    Initiate SSO login flow.
    Redirects the user to the SSO provider's authorization page.
    """
    if not settings.sso_enabled:
        raise HTTPException(
            status_code=400,
            detail="SSO ist nicht konfiguriert.",
        )

    urls = _get_provider_urls()

    # Generate state parameter for CSRF protection
    state = secrets.token_urlsafe(32)

    # Build authorization URL
    params = {
        "client_id": settings.SSO_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.sso_callback_url,
        "scope": urls["scopes"],
        "state": state,
        "response_mode": "query",
    }

    # Azure AD specific: add nonce and prompt
    if settings.SSO_PROVIDER == "azure_ad":
        params["nonce"] = secrets.token_urlsafe(16)
        params["prompt"] = "select_account"

    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    authorize_url = f"{urls['authorize_url']}?{query_string}"

    logger.info(f"SSO authorize redirect to {settings.SSO_PROVIDER}")
    response = RedirectResponse(url=authorize_url, status_code=302)
    response.set_cookie(
        key="sso_state",
        value=state,
        max_age=600,  # 10 Minuten
        httponly=True,
        samesite="lax",
        secure=True,
    )
    return response


@router.get("/sso/callback")
async def sso_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle SSO callback from the OAuth2 provider.
    Exchanges authorization code for tokens, creates/finds user,
    and redirects to frontend with JWT.
    """
    frontend_url = settings.CORS_ORIGINS.split(",")[0].strip()

    # Handle provider errors
    if error:
        logger.warning(f"SSO error: {error} - {error_description}")
        return RedirectResponse(
            url=f"{frontend_url}/login?sso_error={error_description or error}",
            status_code=302,
        )

    if not code:
        return RedirectResponse(
            url=f"{frontend_url}/login?sso_error=Kein Autorisierungscode erhalten",
            status_code=302,
        )

    # Validate state parameter (CSRF protection)
    expected_state = request.cookies.get("sso_state")
    if not state or state != expected_state:
        return RedirectResponse(
            url=f"{frontend_url}/login?sso_error=Ungültiger State-Parameter (CSRF-Schutz)",
            status_code=302,
        )

    try:
        # Exchange code for tokens
        user_info = await _exchange_code_for_userinfo(code)

        if not user_info or not user_info.get("email"):
            return RedirectResponse(
                url=f"{frontend_url}/login?sso_error=Keine E-Mail vom SSO-Provider erhalten",
                status_code=302,
            )

        email = user_info["email"].lower()
        subject_id = user_info.get("sub") or user_info.get("id", "")
        display_name = user_info.get("name") or user_info.get("displayName", "")

        # Find or create user
        user = await _find_or_create_sso_user(
            db=db,
            email=email,
            subject_id=str(subject_id),
            display_name=display_name,
            provider=settings.SSO_PROVIDER,
        )

        if not user:
            return RedirectResponse(
                url=f"{frontend_url}/login?sso_error=SSO-Benutzerkonnte nicht erstellt werden",
                status_code=302,
            )

        if not user.is_active:
            return RedirectResponse(
                url=f"{frontend_url}/login?sso_error=Benutzerkonto ist deaktiviert",
                status_code=302,
            )

        # Generate JWT access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = security.create_access_token(
            subject=user.id, expires_delta=access_token_expires
        )

        logger.info(f"SSO login successful: {email} via {settings.SSO_PROVIDER}")

        # Redirect to frontend with token
        return RedirectResponse(
            url=f"{frontend_url}/sso-callback?token={access_token}",
            status_code=302,
        )

    except Exception as exc:
        logger.error(f"SSO callback error: {exc}", exc_info=True)
        return RedirectResponse(
            url=f"{frontend_url}/login?sso_error=SSO-Anmeldung fehlgeschlagen",
            status_code=302,
        )


# ═══════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════

async def _exchange_code_for_userinfo(code: str) -> dict:
    """Exchange authorization code for tokens and fetch user info."""
    import httpx

    urls = _get_provider_urls()

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            urls["token_url"],
            data={
                "client_id": settings.SSO_CLIENT_ID,
                "client_secret": settings.SSO_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.sso_callback_url,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if token_response.status_code != 200:
            logger.error(f"SSO token exchange failed: {token_response.text}")
            raise Exception("Token-Austausch fehlgeschlagen")

        token_data = token_response.json()
        provider_access_token = token_data.get("access_token")

        if not provider_access_token:
            raise Exception("Kein Access-Token vom Provider erhalten")

        # Fetch user info
        userinfo_response = await client.get(
            urls["userinfo_url"],
            headers={"Authorization": f"Bearer {provider_access_token}"},
        )

        if userinfo_response.status_code != 200:
            logger.error(f"SSO userinfo failed: {userinfo_response.text}")
            raise Exception("Benutzerinformationen konnten nicht geladen werden")

        user_info = userinfo_response.json()

        # Normalize email field (Azure uses 'mail' or 'userPrincipalName')
        if not user_info.get("email"):
            user_info["email"] = (
                user_info.get("mail")
                or user_info.get("userPrincipalName")
                or ""
            )

        return user_info


async def _find_or_create_sso_user(
    db: AsyncSession,
    email: str,
    subject_id: str,
    display_name: str,
    provider: str,
) -> Optional[User]:
    """
    Find existing user by email or SSO subject ID.
    Optionally create a new user if SSO_AUTO_CREATE_USERS is enabled.
    """
    # First try to find by SSO subject ID (most reliable)
    result = await db.execute(
        select(User).where(
            User.sso_provider == provider,
            User.sso_subject_id == subject_id,
        )
    )
    user = result.scalar_one_or_none()

    if user:
        # Update display name if changed
        if display_name and user.display_name != display_name:
            user.display_name = display_name
            await db.commit()
        return user

    # Try to find by email (link existing account to SSO)
    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()

    if user:
        # Link SSO to existing account
        user.sso_provider = provider
        user.sso_subject_id = subject_id
        if display_name:
            user.display_name = display_name
        await db.commit()
        logger.info(f"Linked SSO ({provider}) to existing user: {email}")
        return user

    # Auto-create new user
    if not settings.SSO_AUTO_CREATE_USERS:
        logger.warning(f"SSO auto-create disabled, user not found: {email}")
        return None

    new_user = User(
        email=email,
        password_hash=None,  # SSO-only user, no password
        role=settings.SSO_DEFAULT_ROLE,
        country_code="DE",  # Default, can be changed later
        is_active=True,
        sso_provider=provider,
        sso_subject_id=subject_id,
        display_name=display_name,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    logger.info(f"Auto-created SSO user: {email} via {provider}")
    return new_user
