"""
Security Tests

Covers:
- Security headers (X-Frame-Options, CSP, etc.)
- Upload size limit middleware
- Password hashing
- JWT token verification
- Auth bypass protection
"""
import pytest
from httpx import AsyncClient
from datetime import timedelta

from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
)


class TestSecurityHeaders:
    async def test_health_returns_security_headers(self, client: AsyncClient):
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert "strict-origin" in response.headers.get("Referrer-Policy", "")
        assert "camera=()" in response.headers.get("Permissions-Policy", "")

    async def test_csp_header_present(self, client: AsyncClient):
        response = await client.get("/health")
        csp = response.headers.get("Content-Security-Policy", "")
        assert "default-src 'self'" in csp
        assert "script-src 'self'" in csp
        assert "frame-ancestors 'none'" in csp

    async def test_no_hsts_in_development(self, client: AsyncClient):
        """HSTS should only be set in production/staging."""
        response = await client.get("/health")
        assert "Strict-Transport-Security" not in response.headers


class TestCSRFProtection:
    async def test_post_without_csrf_header_rejected(self, client: AsyncClient):
        """POST without X-Requested-With should be blocked (403)."""
        response = await client.post(
            "/api/v1/drafts",
            json={"document_type_id": 1, "form_data": {}},
            headers={"Authorization": "Bearer fake"},
        )
        assert response.status_code == 403
        assert "CSRF" in response.json()["detail"]

    async def test_post_with_csrf_header_passes(
        self, client: AsyncClient, test_user
    ):
        """POST with X-Requested-With should pass CSRF check."""
        from tests.conftest import make_auth_header
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/drafts",
            json={
                "document_type_id": 1,
                "form_data": {"test": "data"},
                "country_code": "DE",
            },
            headers=headers,
        )
        # May be 200 or 422 (validation), but NOT 403 (CSRF)
        assert response.status_code != 403

    async def test_get_request_exempt_from_csrf(self, client: AsyncClient):
        """GET requests should not need X-Requested-With."""
        response = await client.get("/api/v1/health")
        assert response.status_code == 200

    async def test_login_exempt_from_csrf(self, client: AsyncClient):
        """Login endpoint should be exempt from CSRF check."""
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": "test@test.com", "password": "test"},
        )
        # Should get 401 (bad credentials), NOT 403 (CSRF)
        assert response.status_code == 401


class TestUploadSizeLimit:
    async def test_oversized_content_length_rejected(self, client: AsyncClient):
        """Request with Content-Length > 50MB should be rejected."""
        max_size = 50 * 1024 * 1024
        response = await client.post(
            "/api/v1/drafts",
            content=b"x",
            headers={"Content-Length": str(max_size + 1)},
        )
        assert response.status_code == 413


class TestPasswordHashing:
    def test_hash_and_verify(self):
        password = "SecureTestPass1!"
        hashed = get_password_hash(password)
        assert hashed != password
        assert verify_password(password, hashed)

    def test_wrong_password_fails(self):
        hashed = get_password_hash("CorrectPassword1!")
        assert not verify_password("WrongPassword1!", hashed)

    def test_different_hashes_for_same_password(self):
        """bcrypt should generate different salts each time."""
        h1 = get_password_hash("SamePassword1!")
        h2 = get_password_hash("SamePassword1!")
        assert h1 != h2


class TestJWTTokens:
    def test_create_access_token(self):
        token = create_access_token(subject=42, expires_delta=timedelta(hours=1))
        assert isinstance(token, str)
        assert len(token) > 50

    def test_create_refresh_token(self):
        token = create_refresh_token(subject=42)
        assert isinstance(token, str)

    def test_verify_refresh_token_valid(self):
        token = create_refresh_token(subject=42)
        user_id = verify_refresh_token(token)
        assert user_id == "42"

    def test_verify_refresh_token_invalid(self):
        result = verify_refresh_token("invalid.token.here")
        assert result is None

    def test_access_token_not_accepted_as_refresh(self):
        """Access tokens should not be accepted by verify_refresh_token."""
        token = create_access_token(subject=42)
        result = verify_refresh_token(token)
        assert result is None


class TestHealthCheck:
    async def test_basic_health(self, client: AsyncClient):
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    async def test_api_health(self, client: AsyncClient):
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "api_version" in data

    async def test_api_health_head(self, client: AsyncClient):
        response = await client.head("/api/v1/health")
        assert response.status_code == 200
