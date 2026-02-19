"""
User Favorites API Tests

Covers:
- List favorites (with and without filter)
- Add favorite (document_type and validation)
- Remove favorite
- Toggle favorite on/off
- Check if item is favorited
- Duplicate prevention (409 conflict)
- User isolation
"""
import pytest
from httpx import AsyncClient
from tests.conftest import make_auth_header


# ══════════════════════════════════════════════════════════════════════════════
# LIST FAVORITES
# ══════════════════════════════════════════════════════════════════════════════

class TestListFavorites:
    async def test_list_favorites(self, client: AsyncClient, test_user, test_favorite):
        """Should return user's favorites."""
        headers = make_auth_header(test_user.id)
        response = await client.get("/api/v1/favorites", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["favorite_type"] == "document_type"

    async def test_list_favorites_empty(self, client: AsyncClient, test_admin):
        """Should return empty list for user without favorites."""
        headers = make_auth_header(test_admin.id)
        response = await client.get("/api/v1/favorites", headers=headers)
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_favorites_unauthenticated(self, client: AsyncClient):
        """Should require authentication."""
        response = await client.get("/api/v1/favorites")
        assert response.status_code == 401

    async def test_list_favorites_filter_type(self, client: AsyncClient, test_user, test_favorite):
        """Should filter by favorite_type."""
        headers = make_auth_header(test_user.id)
        response = await client.get(
            "/api/v1/favorites?favorite_type=document_type", headers=headers
        )
        assert response.status_code == 200
        assert len(response.json()) >= 1

        # Filter by a type with no entries
        response2 = await client.get(
            "/api/v1/favorites?favorite_type=document", headers=headers
        )
        assert response2.status_code == 200
        assert len(response2.json()) == 0


# ══════════════════════════════════════════════════════════════════════════════
# ADD FAVORITE
# ══════════════════════════════════════════════════════════════════════════════

class TestAddFavorite:
    async def test_add_favorite_success(self, client: AsyncClient, test_user, test_document_type):
        """Should add a new favorite."""
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/favorites",
            json={
                "favorite_type": "document_type",
                "document_type_id": test_document_type.id,
                "display_name": "Mein Lieblingsvertrag",
            },
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["favorite_type"] == "document_type"
        assert data["document_type_id"] == test_document_type.id

    async def test_add_duplicate_favorite(self, client: AsyncClient, test_user, test_favorite, test_document_type):
        """Should reject duplicate favorites (409)."""
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/favorites",
            json={
                "favorite_type": "document_type",
                "document_type_id": test_document_type.id,
            },
            headers=headers,
        )
        assert response.status_code == 409

    async def test_add_favorite_invalid_type(self, client: AsyncClient, test_user):
        """Should reject invalid favorite_type."""
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/favorites",
            json={"favorite_type": "invalid", "document_type_id": 1},
            headers=headers,
        )
        assert response.status_code == 400

    async def test_add_favorite_missing_id(self, client: AsyncClient, test_user):
        """Should reject document_type favorite without document_type_id."""
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/favorites",
            json={"favorite_type": "document_type"},
            headers=headers,
        )
        assert response.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# REMOVE FAVORITE
# ══════════════════════════════════════════════════════════════════════════════

class TestRemoveFavorite:
    async def test_remove_favorite(self, client: AsyncClient, test_user, test_favorite):
        """Should remove a favorite."""
        headers = make_auth_header(test_user.id)
        response = await client.delete(
            f"/api/v1/favorites/{test_favorite.id}", headers=headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "removed"

    async def test_remove_nonexistent(self, client: AsyncClient, test_user):
        """Should return 404 for non-existent favorite."""
        headers = make_auth_header(test_user.id)
        response = await client.delete("/api/v1/favorites/99999", headers=headers)
        assert response.status_code == 404

    async def test_remove_other_users_favorite(self, client: AsyncClient, test_admin, test_favorite):
        """Should not allow removing other user's favorite."""
        headers = make_auth_header(test_admin.id)
        response = await client.delete(
            f"/api/v1/favorites/{test_favorite.id}", headers=headers
        )
        assert response.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# TOGGLE FAVORITE
# ══════════════════════════════════════════════════════════════════════════════

class TestToggleFavorite:
    async def test_toggle_add(self, client: AsyncClient, test_user, test_document_type):
        """Toggle should add if not favorited."""
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/favorites/toggle",
            json={
                "favorite_type": "document_type",
                "document_type_id": test_document_type.id,
            },
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["is_favorite"] is True
        assert response.json()["action"] == "added"

    async def test_toggle_remove(self, client: AsyncClient, test_user, test_favorite, test_document_type):
        """Toggle should remove if already favorited."""
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/favorites/toggle",
            json={
                "favorite_type": "document_type",
                "document_type_id": test_document_type.id,
            },
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["is_favorite"] is False
        assert response.json()["action"] == "removed"


# ══════════════════════════════════════════════════════════════════════════════
# CHECK IS FAVORITE
# ══════════════════════════════════════════════════════════════════════════════

class TestCheckIsFavorite:
    async def test_check_is_favorite_true(self, client: AsyncClient, test_user, test_favorite, test_document_type):
        """Should return True if item is favorited."""
        headers = make_auth_header(test_user.id)
        response = await client.get(
            f"/api/v1/favorites/check/document_type/{test_document_type.id}",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["is_favorite"] is True

    async def test_check_is_favorite_false(self, client: AsyncClient, test_user):
        """Should return False if item is not favorited."""
        headers = make_auth_header(test_user.id)
        response = await client.get(
            "/api/v1/favorites/check/document_type/99999", headers=headers
        )
        assert response.status_code == 200
        assert response.json()["is_favorite"] is False
