"""
Document Types API Tests

Covers:
- List document types (with country filter)
- Get single document type
- Create document type (admin only)
- Update document type (admin only)
- Delete/deactivate document type
- Access control (admin vs. regular user)
"""
import pytest
from httpx import AsyncClient
from tests.conftest import make_auth_header


# ══════════════════════════════════════════════════════════════════════════════
# LIST DOCUMENT TYPES
# ══════════════════════════════════════════════════════════════════════════════

class TestListDocumentTypes:
    async def test_list_authenticated(self, client: AsyncClient, test_user, test_document_type):
        """Should return document types for authenticated user."""
        headers = make_auth_header(test_user.id)
        response = await client.get("/api/v1/document-types/", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["name"] == "Arbeitsvertrag Vollzeit"

    async def test_list_unauthenticated(self, client: AsyncClient):
        """Should require authentication."""
        response = await client.get("/api/v1/document-types/")
        assert response.status_code == 401

    async def test_list_filter_by_country(self, client: AsyncClient, test_user, test_document_type):
        """Should filter by country_code."""
        headers = make_auth_header(test_user.id)

        # DE should have results
        resp_de = await client.get(
            "/api/v1/document-types/?country_code=DE", headers=headers
        )
        assert resp_de.status_code == 200
        assert len(resp_de.json()) >= 1

        # IT should be empty (no IT document types created)
        resp_it = await client.get(
            "/api/v1/document-types/?country_code=IT", headers=headers
        )
        assert resp_it.status_code == 200
        assert len(resp_it.json()) == 0


# ══════════════════════════════════════════════════════════════════════════════
# GET SINGLE DOCUMENT TYPE
# ══════════════════════════════════════════════════════════════════════════════

class TestGetDocumentType:
    async def test_get_by_id(self, client: AsyncClient, test_user, test_document_type):
        """Should return a document type by ID."""
        headers = make_auth_header(test_user.id)
        response = await client.get(
            f"/api/v1/document-types/{test_document_type.id}", headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Arbeitsvertrag Vollzeit"
        assert data["country_code"] == "DE"

    async def test_get_nonexistent(self, client: AsyncClient, test_user):
        """Should return 404 for non-existent document type."""
        headers = make_auth_header(test_user.id)
        response = await client.get("/api/v1/document-types/99999", headers=headers)
        assert response.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# CREATE DOCUMENT TYPE (ADMIN)
# ══════════════════════════════════════════════════════════════════════════════

class TestCreateDocumentType:
    async def test_create_as_admin(self, client: AsyncClient, test_admin):
        """Admin should be able to create a new document type."""
        headers = make_auth_header(test_admin.id)
        response = await client.post(
            "/api/v1/document-types/",
            json={
                "name": "Kündigung",
                "country_code": "DE",
                "category": "Kündigung",
                "description": "Standard Kündigungsschreiben",
            },
            headers=headers,
        )
        assert response.status_code in (200, 201)
        data = response.json()
        assert data["name"] == "Kündigung"

    async def test_create_as_regular_user(self, client: AsyncClient, test_user):
        """Regular user should be forbidden from creating document types."""
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/document-types/",
            json={
                "name": "Unauthorized Type",
                "country_code": "DE",
                "category": "Test",
            },
            headers=headers,
        )
        assert response.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# UPDATE DOCUMENT TYPE (ADMIN)
# ══════════════════════════════════════════════════════════════════════════════

class TestUpdateDocumentType:
    async def test_update_as_admin(self, client: AsyncClient, test_admin, test_document_type):
        """Admin should be able to update a document type."""
        headers = make_auth_header(test_admin.id)
        response = await client.put(
            f"/api/v1/document-types/{test_document_type.id}",
            json={"name": "Arbeitsvertrag Teilzeit", "category": "Arbeitsvertrag"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Arbeitsvertrag Teilzeit"

    async def test_update_as_regular_user(self, client: AsyncClient, test_user, test_document_type):
        """Regular user should be forbidden from updating document types."""
        headers = make_auth_header(test_user.id)
        response = await client.put(
            f"/api/v1/document-types/{test_document_type.id}",
            json={"name": "Hacked Name"},
            headers=headers,
        )
        assert response.status_code == 403

    async def test_update_nonexistent(self, client: AsyncClient, test_admin):
        """Should return 404 for non-existent document type."""
        headers = make_auth_header(test_admin.id)
        response = await client.put(
            "/api/v1/document-types/99999",
            json={"name": "Ghost"},
            headers=headers,
        )
        assert response.status_code == 404
