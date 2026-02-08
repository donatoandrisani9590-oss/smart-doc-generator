"""
Auth API Tests

Covers:
- Login (happy path, wrong password, locked account, inactive user)
- Registration (happy path, weak password, duplicate email)
- GET /me (authenticated, unauthenticated)
"""
import pytest
from httpx import AsyncClient
from tests.conftest import make_auth_header


# ══════════════════════════════════════════════════════════════════════════════
# LOGIN
# ══════════════════════════════════════════════════════════════════════════════

class TestLogin:
    async def test_login_success(self, client: AsyncClient, test_user):
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": "testuser@example.com", "password": "TestPasswort1!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, test_user):
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": "testuser@example.com", "password": "WrongPassword1!"},
        )
        assert response.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": "nobody@example.com", "password": "Whatever1!"},
        )
        assert response.status_code == 401

    async def test_login_inactive_user(self, client: AsyncClient, inactive_user):
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": "inactive@example.com", "password": "TestPasswort1!"},
        )
        assert response.status_code == 400

    async def test_login_brute_force_lockout(self, client: AsyncClient, test_user):
        """After 5 failed attempts, account should be locked (HTTP 423)."""
        for _ in range(5):
            await client.post(
                "/api/v1/auth/login",
                data={"username": "testuser@example.com", "password": "Wrong!"},
            )
        # 6th attempt should be locked
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": "testuser@example.com", "password": "Wrong!"},
        )
        assert response.status_code == 423


# ══════════════════════════════════════════════════════════════════════════════
# REGISTRATION
# ══════════════════════════════════════════════════════════════════════════════

class TestRegister:
    async def test_register_success(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "SecurePass123!",
                "country_code": "DE",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["email"] == "newuser@example.com"
        assert data["user"]["role"] == "user"
        assert "access_token" in data

    async def test_register_weak_password_too_short(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "weak@example.com", "password": "Short1!"},
        )
        assert response.status_code == 400

    async def test_register_weak_password_no_special_char(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "weak@example.com", "password": "NoSpecialChars1"},
        )
        assert response.status_code == 400

    async def test_register_duplicate_email(self, client: AsyncClient, test_user):
        """Duplicate email should return generic error (no user enumeration)."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "testuser@example.com",
                "password": "AnotherPass123!",
            },
        )
        assert response.status_code == 400
        # Should NOT reveal that the email exists
        assert "existiert" not in response.json()["detail"].lower()


# ══════════════════════════════════════════════════════════════════════════════
# GET /ME
# ══════════════════════════════════════════════════════════════════════════════

class TestGetMe:
    async def test_get_me_authenticated(self, client: AsyncClient, test_user):
        headers = make_auth_header(test_user.id)
        response = await client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "testuser@example.com"
        assert data["role"] == "user"

    async def test_get_me_unauthenticated(self, client: AsyncClient):
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401

    async def test_get_me_invalid_token(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401
