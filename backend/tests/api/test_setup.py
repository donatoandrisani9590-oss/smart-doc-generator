"""
Setup API Tests

Covers:
- GET /setup/status (check if setup is needed)
- POST /setup/initialize (first admin creation)
- Setup lockout after admin exists
"""
import pytest
from httpx import AsyncClient


class TestSetupStatus:
    async def test_setup_required_when_no_admin(self, client: AsyncClient):
        response = await client.get("/api/v1/setup/status")
        assert response.status_code == 200
        data = response.json()
        assert data["setup_required"] is True
        assert data["has_admin"] is False

    async def test_setup_not_required_when_admin_exists(
        self, client: AsyncClient, test_admin
    ):
        response = await client.get("/api/v1/setup/status")
        assert response.status_code == 200
        data = response.json()
        assert data["setup_required"] is False
        assert data["has_admin"] is True


class TestSetupInitialize:
    async def test_initialize_success(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/setup/initialize",
            json={
                "email": "firstadmin@example.com",
                "password": "AdminPass123!",
                "company_name": "Test GmbH",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["admin_email"] == "firstadmin@example.com"
        assert "admin_id" in data

    async def test_initialize_blocked_when_admin_exists(
        self, client: AsyncClient, test_admin
    ):
        """Once an admin exists, setup endpoint should be blocked."""
        response = await client.post(
            "/api/v1/setup/initialize",
            json={
                "email": "hacker@example.com",
                "password": "TryToHack1!",
            },
        )
        assert response.status_code == 403

    async def test_initialize_weak_password(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/setup/initialize",
            json={
                "email": "admin@example.com",
                "password": "short",
            },
        )
        assert response.status_code == 400
