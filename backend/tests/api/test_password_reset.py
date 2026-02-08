"""
Password Reset & Change Tests

Covers:
- Forgot password (always returns success, prevents user enumeration)
- Reset password with valid/invalid tokens
- Change password for authenticated users
- Password validation rules
"""
import pytest
from httpx import AsyncClient
from tests.conftest import make_auth_header
from app.core.security import create_password_reset_token


# ══════════════════════════════════════════════════════════════════════════════
# FORGOT PASSWORD
# ══════════════════════════════════════════════════════════════════════════════

class TestForgotPassword:
    async def test_forgot_password_existing_user(self, client: AsyncClient, test_user):
        """Should always return success (prevents user enumeration)."""
        response = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "testuser@example.com"},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert response.status_code == 200
        assert "message" in response.json()

    async def test_forgot_password_nonexistent_user(self, client: AsyncClient):
        """Should also return success to prevent user enumeration."""
        response = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "nonexistent@example.com"},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert response.status_code == 200
        assert "message" in response.json()

    async def test_forgot_password_invalid_email_format(self, client: AsyncClient):
        """Should reject invalid email format."""
        response = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "not-an-email"},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert response.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# RESET PASSWORD
# ══════════════════════════════════════════════════════════════════════════════

class TestResetPassword:
    async def test_reset_password_success(self, client: AsyncClient, test_user):
        """Should reset password with a valid token."""
        token = create_password_reset_token(test_user.id)
        response = await client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "new_password": "NeuesPasswort123!"},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert response.status_code == 200
        assert "erfolgreich" in response.json()["message"].lower()

        # Verify can login with new password
        login_response = await client.post(
            "/api/v1/auth/login",
            data={"username": "testuser@example.com", "password": "NeuesPasswort123!"},
        )
        assert login_response.status_code == 200

    async def test_reset_password_invalid_token(self, client: AsyncClient):
        """Should reject invalid tokens."""
        response = await client.post(
            "/api/v1/auth/reset-password",
            json={"token": "invalid.token.here", "new_password": "NeuesPasswort123!"},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert response.status_code == 400

    async def test_reset_password_weak_password(self, client: AsyncClient, test_user):
        """Should reject weak new password."""
        token = create_password_reset_token(test_user.id)
        response = await client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "new_password": "weak"},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert response.status_code == 400

    async def test_reset_password_clears_lockout(self, client: AsyncClient, test_user):
        """After password reset, failed_login_attempts should be cleared."""
        # Lock the account with failed attempts
        for _ in range(5):
            await client.post(
                "/api/v1/auth/login",
                data={"username": "testuser@example.com", "password": "Wrong!"},
            )

        # Account should be locked
        locked_response = await client.post(
            "/api/v1/auth/login",
            data={"username": "testuser@example.com", "password": "Wrong!"},
        )
        assert locked_response.status_code == 423

        # Reset password
        token = create_password_reset_token(test_user.id)
        await client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "new_password": "NeuesPasswort123!"},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )

        # Should be able to login again
        login_response = await client.post(
            "/api/v1/auth/login",
            data={"username": "testuser@example.com", "password": "NeuesPasswort123!"},
        )
        assert login_response.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# CHANGE PASSWORD
# ══════════════════════════════════════════════════════════════════════════════

class TestChangePassword:
    async def test_change_password_success(self, client: AsyncClient, test_user):
        """Authenticated user can change their password."""
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "TestPasswort1!",
                "new_password": "NeuesPasswort123!",
            },
            headers=headers,
        )
        assert response.status_code == 200
        assert "erfolgreich" in response.json()["message"].lower()

    async def test_change_password_wrong_current(self, client: AsyncClient, test_user):
        """Should reject if current password is wrong."""
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "WrongPassword123!",
                "new_password": "NeuesPasswort123!",
            },
            headers=headers,
        )
        assert response.status_code == 400

    async def test_change_password_weak_new_password(self, client: AsyncClient, test_user):
        """Should reject weak new password."""
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "TestPasswort1!",
                "new_password": "short",
            },
            headers=headers,
        )
        assert response.status_code == 400

    async def test_change_password_unauthenticated(self, client: AsyncClient):
        """Should require authentication."""
        response = await client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "TestPasswort1!",
                "new_password": "NeuesPasswort123!",
            },
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert response.status_code == 401
