"""
Drafts API Tests

Covers:
- CRUD operations (create, read, update, delete)
- Optimistic locking (version conflict → 409)
- Access control (user can only see own drafts)
- Validation (form_data size, country_code format)
"""
import json
import pytest
from httpx import AsyncClient
from tests.conftest import make_auth_header


class TestDraftCreate:
    async def test_create_draft_success(
        self, client: AsyncClient, test_user, test_document_type
    ):
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/drafts",
            json={
                "document_type_id": test_document_type.id,
                "country_code": "DE",
                "name": "Mein Entwurf",
                "form_data": {"vorname": "Max", "nachname": "Mustermann"},
            },
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "created"
        assert data["version"] == 1
        assert "id" in data

    async def test_create_draft_unauthenticated(
        self, client: AsyncClient, test_document_type
    ):
        response = await client.post(
            "/api/v1/drafts",
            json={
                "document_type_id": test_document_type.id,
                "form_data": {"test": "data"},
            },
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert response.status_code == 401

    async def test_create_draft_invalid_country_code(
        self, client: AsyncClient, test_user, test_document_type
    ):
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/drafts",
            json={
                "document_type_id": test_document_type.id,
                "country_code": "INVALID",
                "form_data": {"test": "data"},
            },
            headers=headers,
        )
        assert response.status_code == 422


class TestDraftRead:
    async def test_get_draft_success(
        self, client: AsyncClient, test_user, test_draft
    ):
        headers = make_auth_header(test_user.id)
        response = await client.get(
            f"/api/v1/drafts/{test_draft.id}",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Entwurf"
        assert data["version"] == 1
        assert data["form_data"]["vorname"] == "Max"

    async def test_get_draft_not_found(self, client: AsyncClient, test_user):
        headers = make_auth_header(test_user.id)
        response = await client.get("/api/v1/drafts/99999", headers=headers)
        assert response.status_code == 404

    async def test_get_draft_wrong_user(
        self, client: AsyncClient, test_admin, test_draft
    ):
        """User cannot access another user's draft."""
        headers = make_auth_header(test_admin.id)
        response = await client.get(
            f"/api/v1/drafts/{test_draft.id}",
            headers=headers,
        )
        assert response.status_code == 404

    async def test_list_drafts_success(
        self, client: AsyncClient, test_user, test_draft
    ):
        headers = make_auth_header(test_user.id)
        response = await client.get("/api/v1/drafts", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["name"] == "Test Entwurf"


class TestDraftUpdate:
    async def test_update_draft_success(
        self, client: AsyncClient, test_user, test_draft
    ):
        headers = make_auth_header(test_user.id)
        response = await client.put(
            f"/api/v1/drafts/{test_draft.id}",
            json={
                "name": "Aktualisierter Entwurf",
                "form_data": {"vorname": "Erika"},
                "version": 1,
            },
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "updated"
        assert data["version"] == 2

    async def test_update_draft_version_conflict(
        self, client: AsyncClient, test_user, test_draft
    ):
        """Sending stale version should trigger 409 Conflict."""
        headers = make_auth_header(test_user.id)
        # First update bumps version to 2
        await client.put(
            f"/api/v1/drafts/{test_draft.id}",
            json={"name": "V2", "version": 1},
            headers=headers,
        )
        # Second update with version=1 should fail
        response = await client.put(
            f"/api/v1/drafts/{test_draft.id}",
            json={"name": "V3 conflict", "version": 1},
            headers=headers,
        )
        assert response.status_code == 409

    async def test_update_draft_not_found(self, client: AsyncClient, test_user):
        headers = make_auth_header(test_user.id)
        response = await client.put(
            "/api/v1/drafts/99999",
            json={"name": "Ghost"},
            headers=headers,
        )
        assert response.status_code == 404


class TestDraftDelete:
    async def test_delete_draft_success(
        self, client: AsyncClient, test_user, test_draft
    ):
        headers = make_auth_header(test_user.id)
        response = await client.delete(
            f"/api/v1/drafts/{test_draft.id}",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

        # Confirm it's gone
        response = await client.get(
            f"/api/v1/drafts/{test_draft.id}",
            headers=headers,
        )
        assert response.status_code == 404

    async def test_delete_draft_wrong_user(
        self, client: AsyncClient, test_admin, test_draft
    ):
        headers = make_auth_header(test_admin.id)
        response = await client.delete(
            f"/api/v1/drafts/{test_draft.id}",
            headers=headers,
        )
        assert response.status_code == 404
