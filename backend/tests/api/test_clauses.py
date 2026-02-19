"""
Clauses API Tests

Covers:
- CRUD operations (list, get, create, update, delete)
- Access control (admin-only for CUD, tenant isolation)
- Input validation (XSS sanitization, required fields)
"""
import pytest
from httpx import AsyncClient
from tests.conftest import make_auth_header


class TestClauseList:
    async def test_list_clauses_authenticated(
        self, client: AsyncClient, test_user, test_clause
    ):
        headers = make_auth_header(test_user.id)
        response = await client.get("/api/v1/clauses", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["title"] == "Probezeit"

    async def test_list_clauses_unauthenticated(self, client: AsyncClient):
        response = await client.get("/api/v1/clauses")
        assert response.status_code == 401

    async def test_list_clauses_filter_country(
        self, client: AsyncClient, test_user, test_clause
    ):
        headers = make_auth_header(test_user.id)
        response = await client.get(
            "/api/v1/clauses?country_code=IT", headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0  # test_clause is DE


class TestClauseGet:
    async def test_get_clause_success(
        self, client: AsyncClient, test_user, test_clause
    ):
        headers = make_auth_header(test_user.id)
        response = await client.get(
            f"/api/v1/clauses/{test_clause.id}", headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Probezeit"
        assert data["country_code"] == "DE"

    async def test_get_clause_not_found(self, client: AsyncClient, test_user):
        headers = make_auth_header(test_user.id)
        response = await client.get("/api/v1/clauses/99999", headers=headers)
        assert response.status_code == 404

    async def test_get_clause_tenant_isolation(
        self, client: AsyncClient, test_user, test_admin, db_session
    ):
        """User cannot access another user's private clause."""
        from app.models.documents import Clause

        private_clause = Clause(
            title="Privater Textbaustein",
            content_html="<p>Geheim</p>",
            country_code="DE",
            user_id=test_admin.id,
            is_active=True,
        )
        db_session.add(private_clause)
        await db_session.commit()
        await db_session.refresh(private_clause)

        headers = make_auth_header(test_user.id)
        response = await client.get(
            f"/api/v1/clauses/{private_clause.id}", headers=headers
        )
        assert response.status_code == 403


class TestClauseCreate:
    async def test_create_clause_admin_success(
        self, client: AsyncClient, test_admin
    ):
        headers = make_auth_header(test_admin.id)
        response = await client.post(
            "/api/v1/clauses",
            json={
                "title": "Kündigungsfrist",
                "content_html": "<p>Die Kündigungsfrist beträgt 4 Wochen.</p>",
                "country_code": "DE",
                "category": "Arbeitsrecht",
            },
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Kündigungsfrist"

    async def test_create_clause_non_admin_forbidden(
        self, client: AsyncClient, test_user
    ):
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/clauses",
            json={
                "title": "Versuch",
                "content_html": "<p>Test</p>",
            },
            headers=headers,
        )
        assert response.status_code == 403

    async def test_create_clause_xss_sanitized(
        self, client: AsyncClient, test_admin
    ):
        headers = make_auth_header(test_admin.id)
        response = await client.post(
            "/api/v1/clauses",
            json={
                "title": "XSS Test",
                "content_html": '<p>Safe</p><script>alert("xss")</script>',
                "country_code": "DE",
            },
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "<script>" not in data["content_html"]
        assert "<p>Safe</p>" in data["content_html"]

    async def test_create_clause_empty_title_rejected(
        self, client: AsyncClient, test_admin
    ):
        headers = make_auth_header(test_admin.id)
        response = await client.post(
            "/api/v1/clauses",
            json={"title": "", "content_html": "<p>Content</p>"},
            headers=headers,
        )
        assert response.status_code == 422


class TestClauseUpdate:
    async def test_update_clause_admin_success(
        self, client: AsyncClient, test_admin, test_clause
    ):
        headers = make_auth_header(test_admin.id)
        response = await client.put(
            f"/api/v1/clauses/{test_clause.id}",
            json={"title": "Probezeit (aktualisiert)"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Probezeit (aktualisiert)"

    async def test_update_clause_version_increment(
        self, client: AsyncClient, test_admin, test_clause
    ):
        """Changing content_html should increment version."""
        headers = make_auth_header(test_admin.id)
        response = await client.put(
            f"/api/v1/clauses/{test_clause.id}",
            json={"content_html": "<p>Neue Inhalte</p>"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["version"] == 2

    async def test_update_clause_non_admin_forbidden(
        self, client: AsyncClient, test_user, test_clause
    ):
        headers = make_auth_header(test_user.id)
        response = await client.put(
            f"/api/v1/clauses/{test_clause.id}",
            json={"title": "Hacked"},
            headers=headers,
        )
        assert response.status_code == 403


class TestClauseDelete:
    async def test_delete_clause_admin_success(
        self, client: AsyncClient, test_admin, test_clause
    ):
        headers = make_auth_header(test_admin.id)
        response = await client.delete(
            f"/api/v1/clauses/{test_clause.id}",
            headers=headers,
        )
        assert response.status_code == 200
        assert "erfolgreich" in response.json()["message"]

    async def test_delete_clause_non_admin_forbidden(
        self, client: AsyncClient, test_user, test_clause
    ):
        headers = make_auth_header(test_user.id)
        response = await client.delete(
            f"/api/v1/clauses/{test_clause.id}",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_delete_clause_not_found(
        self, client: AsyncClient, test_admin
    ):
        headers = make_auth_header(test_admin.id)
        response = await client.delete("/api/v1/clauses/99999", headers=headers)
        assert response.status_code == 404
