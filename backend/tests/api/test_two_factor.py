"""
Two-Factor Authentication (TOTP) Tests

Covers:
- 2FA setup flow (setup -> confirm)
- 2FA login verification (pre-auth token + TOTP code)
- 2FA disable
- 2FA status check
- Error cases (invalid codes, missing setup, etc.)
"""
import pytest
import pyotp
from httpx import AsyncClient
from tests.conftest import make_auth_header
from app.core.security import create_pre_auth_token


# ══════════════════════════════════════════════════════════════════════════════
# 2FA SETUP & CONFIRM
# ══════════════════════════════════════════════════════════════════════════════

class TestTwoFactorSetup:
    async def test_setup_returns_secret_and_qr(self, client: AsyncClient, test_user):
        """Setup should return a TOTP secret and QR provisioning URI."""
        headers = make_auth_header(test_user.id)
        response = await client.post("/api/v1/auth/2fa/setup", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "secret" in data
        assert "qr_uri" in data
        assert "otpauth://" in data["qr_uri"]
        assert len(data["secret"]) >= 16

    async def test_setup_unauthenticated(self, client: AsyncClient):
        """Setup requires authentication."""
        response = await client.post(
            "/api/v1/auth/2fa/setup",
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert response.status_code == 401


class TestTwoFactorConfirm:
    async def test_confirm_with_valid_code(self, client: AsyncClient, test_user):
        """Should enable 2FA when confirming with valid TOTP code."""
        headers = make_auth_header(test_user.id)

        # Step 1: Setup
        setup_resp = await client.post("/api/v1/auth/2fa/setup", headers=headers)
        secret = setup_resp.json()["secret"]

        # Step 2: Generate valid code
        totp = pyotp.TOTP(secret)
        code = totp.now()

        # Step 3: Confirm
        confirm_resp = await client.post(
            "/api/v1/auth/2fa/confirm",
            json={"totp_code": code},
            headers=headers,
        )
        assert confirm_resp.status_code == 200
        assert "aktiviert" in confirm_resp.json()["message"].lower()

    async def test_confirm_with_invalid_code(self, client: AsyncClient, test_user):
        """Should reject invalid TOTP code."""
        headers = make_auth_header(test_user.id)

        # Setup
        await client.post("/api/v1/auth/2fa/setup", headers=headers)

        # Try to confirm with wrong code
        confirm_resp = await client.post(
            "/api/v1/auth/2fa/confirm",
            json={"totp_code": "000000"},
            headers=headers,
        )
        assert confirm_resp.status_code == 400

    async def test_confirm_without_setup(self, client: AsyncClient, test_user):
        """Should fail if setup hasn't been called first."""
        headers = make_auth_header(test_user.id)
        confirm_resp = await client.post(
            "/api/v1/auth/2fa/confirm",
            json={"totp_code": "123456"},
            headers=headers,
        )
        assert confirm_resp.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# 2FA LOGIN VERIFICATION
# ══════════════════════════════════════════════════════════════════════════════

class TestTwoFactorVerify:
    async def test_login_with_2fa_returns_pre_auth(self, client: AsyncClient, totp_user):
        """Login with 2FA-enabled user should return a pre-auth token."""
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": "totp@example.com", "password": "TotpPasswort1!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        # The returned token should be a pre_auth token (not usable for API access)
        from app.core.security import verify_pre_auth_token
        user_id = verify_pre_auth_token(data["access_token"])
        assert user_id is not None
        assert int(user_id) == totp_user.id

    async def test_verify_with_valid_code(self, client: AsyncClient, totp_user):
        """Should exchange pre-auth token + valid code for real access token."""
        # Login to get pre-auth token
        login_resp = await client.post(
            "/api/v1/auth/login",
            data={"username": "totp@example.com", "password": "TotpPasswort1!"},
        )
        pre_auth_token = login_resp.json()["access_token"]

        # Generate valid TOTP code
        totp = pyotp.TOTP(totp_user._test_secret)
        code = totp.now()

        # Verify
        verify_resp = await client.post(
            "/api/v1/auth/2fa/verify",
            json={"pre_auth_token": pre_auth_token, "totp_code": code},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert verify_resp.status_code == 200
        data = verify_resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        # The returned token should NOT have requires_2fa
        assert "requires_2fa" not in data

    async def test_verify_with_invalid_code(self, client: AsyncClient, totp_user):
        """Should reject invalid TOTP code."""
        pre_auth_token = create_pre_auth_token(totp_user.id)
        verify_resp = await client.post(
            "/api/v1/auth/2fa/verify",
            json={"pre_auth_token": pre_auth_token, "totp_code": "000000"},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert verify_resp.status_code == 401

    async def test_verify_with_invalid_pre_auth_token(self, client: AsyncClient):
        """Should reject invalid pre-auth token."""
        verify_resp = await client.post(
            "/api/v1/auth/2fa/verify",
            json={"pre_auth_token": "invalid.token", "totp_code": "123456"},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert verify_resp.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# 2FA DISABLE
# ══════════════════════════════════════════════════════════════════════════════

class TestTwoFactorDisable:
    async def test_disable_with_valid_credentials(self, client: AsyncClient, totp_user):
        """Should disable 2FA with correct password and TOTP code."""
        headers = make_auth_header(totp_user.id)
        totp = pyotp.TOTP(totp_user._test_secret)

        response = await client.post(
            "/api/v1/auth/2fa/disable",
            json={"password": "TotpPasswort1!", "totp_code": totp.now()},
            headers=headers,
        )
        assert response.status_code == 200
        assert "deaktiviert" in response.json()["message"].lower()

    async def test_disable_with_wrong_password(self, client: AsyncClient, totp_user):
        """Should reject wrong password."""
        headers = make_auth_header(totp_user.id)
        totp = pyotp.TOTP(totp_user._test_secret)

        response = await client.post(
            "/api/v1/auth/2fa/disable",
            json={"password": "WrongPassword!", "totp_code": totp.now()},
            headers=headers,
        )
        assert response.status_code == 400

    async def test_disable_with_invalid_code(self, client: AsyncClient, totp_user):
        """Should reject invalid TOTP code."""
        headers = make_auth_header(totp_user.id)
        response = await client.post(
            "/api/v1/auth/2fa/disable",
            json={"password": "TotpPasswort1!", "totp_code": "000000"},
            headers=headers,
        )
        assert response.status_code == 400

    async def test_disable_when_not_enabled(self, client: AsyncClient, test_user):
        """Should fail if 2FA was never enabled."""
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/auth/2fa/disable",
            json={"password": "TestPasswort1!", "totp_code": "123456"},
            headers=headers,
        )
        assert response.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# 2FA STATUS
# ══════════════════════════════════════════════════════════════════════════════

class TestTwoFactorStatus:
    async def test_status_disabled(self, client: AsyncClient, test_user):
        """Should report 2FA as disabled for regular user."""
        headers = make_auth_header(test_user.id)
        response = await client.get("/api/v1/auth/2fa/status", headers=headers)
        assert response.status_code == 200
        assert response.json()["enabled"] is False

    async def test_status_enabled(self, client: AsyncClient, totp_user):
        """Should report 2FA as enabled for TOTP user."""
        headers = make_auth_header(totp_user.id)
        response = await client.get("/api/v1/auth/2fa/status", headers=headers)
        assert response.status_code == 200
        assert response.json()["enabled"] is True

    async def test_status_unauthenticated(self, client: AsyncClient):
        """Should require authentication."""
        response = await client.get(
            "/api/v1/auth/2fa/status",
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert response.status_code == 401
