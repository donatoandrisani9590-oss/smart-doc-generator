"""
Tests for SSO/OAuth2 (OIDC) endpoints.

Tests the provider listing and configuration checks.
Full OAuth2 flow testing requires mocking external providers.
"""
import pytest
from httpx import AsyncClient


class TestSSOProviders:
    """Tests for GET /api/v1/auth/sso/providers"""

    @pytest.mark.anyio
    async def test_providers_returns_empty_when_not_configured(self, client: AsyncClient):
        """SSO not configured should return empty providers list."""
        response = await client.get("/api/v1/auth/sso/providers")
        assert response.status_code == 200
        data = response.json()
        assert data["sso_enabled"] is False
        assert data["providers"] == []

    @pytest.mark.anyio
    async def test_providers_endpoint_is_public(self, client: AsyncClient):
        """Providers endpoint should be accessible without authentication."""
        response = await client.get("/api/v1/auth/sso/providers")
        assert response.status_code == 200


class TestSSOAuthorize:
    """Tests for GET /api/v1/auth/sso/authorize"""

    @pytest.mark.anyio
    async def test_authorize_fails_when_not_configured(self, client: AsyncClient):
        """Should return 400 when SSO is not configured."""
        response = await client.get(
            "/api/v1/auth/sso/authorize",
            follow_redirects=False,
        )
        assert response.status_code == 400
        data = response.json()
        assert "nicht konfiguriert" in data["detail"]


class TestSSOCallback:
    """Tests for GET /api/v1/auth/sso/callback"""

    @pytest.mark.anyio
    async def test_callback_handles_provider_error(self, client: AsyncClient):
        """Should redirect to login with error when provider sends error."""
        response = await client.get(
            "/api/v1/auth/sso/callback",
            params={"error": "access_denied", "error_description": "User cancelled"},
            follow_redirects=False,
        )
        assert response.status_code == 302
        location = response.headers.get("location", "")
        assert "/login" in location
        assert "sso_error" in location

    @pytest.mark.anyio
    async def test_callback_handles_missing_code(self, client: AsyncClient):
        """Should redirect to login with error when no code is provided."""
        response = await client.get(
            "/api/v1/auth/sso/callback",
            follow_redirects=False,
        )
        assert response.status_code == 302
        location = response.headers.get("location", "")
        assert "/login" in location
        assert "sso_error" in location

    @pytest.mark.anyio
    async def test_callback_handles_invalid_code(self, client: AsyncClient):
        """Should redirect to login with error for invalid auth code."""
        response = await client.get(
            "/api/v1/auth/sso/callback",
            params={"code": "invalid_code_123", "state": "test_state"},
            follow_redirects=False,
        )
        assert response.status_code == 302
        location = response.headers.get("location", "")
        assert "/login" in location
        assert "sso_error" in location


class TestSSOUserModel:
    """Tests for SSO-related user model fields."""

    @pytest.mark.anyio
    async def test_user_model_has_sso_fields(self, db_session):
        """Verify User model supports SSO fields."""
        from app.models.core import User

        user = User(
            email="sso@example.com",
            password_hash=None,  # SSO-only users have no password
            role="user",
            sso_provider="azure_ad",
            sso_subject_id="abc-123-def",
            display_name="SSO Test User",
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        assert user.id is not None
        assert user.email == "sso@example.com"
        assert user.password_hash is None
        assert user.sso_provider == "azure_ad"
        assert user.sso_subject_id == "abc-123-def"
        assert user.display_name == "SSO Test User"

    @pytest.mark.anyio
    async def test_sso_user_without_password(self, db_session):
        """SSO-only users should have nullable password_hash."""
        from app.models.core import User
        from sqlalchemy import select

        user = User(
            email="sso-only@example.com",
            password_hash=None,
            role="user",
            sso_provider="google",
            sso_subject_id="google-xyz-456",
        )
        db_session.add(user)
        await db_session.commit()

        result = await db_session.execute(
            select(User).where(User.email == "sso-only@example.com")
        )
        fetched = result.scalar_one()
        assert fetched.password_hash is None
        assert fetched.sso_provider == "google"
