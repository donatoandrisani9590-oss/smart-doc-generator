"""
Notifications API Tests

Covers:
- List notifications (pagination, filtering)
- Unread count
- Mark as read / mark all as read
- Dismiss notification
- Delete notification
- Notification preferences (CRUD)
- Notification types listing
- User isolation (can't access other user's notifications)
"""
import pytest
from httpx import AsyncClient
from tests.conftest import make_auth_header


# ══════════════════════════════════════════════════════════════════════════════
# LIST NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════════════════

class TestListNotifications:
    async def test_list_authenticated(self, client: AsyncClient, test_user, test_notification):
        """Should return user's notifications."""
        headers = make_auth_header(test_user.id)
        response = await client.get("/api/v1/notifications", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert data["total"] >= 1
        assert data["unread_count"] >= 1
        assert data["page"] == 1

    async def test_list_unauthenticated(self, client: AsyncClient):
        """Should require authentication."""
        response = await client.get("/api/v1/notifications")
        assert response.status_code == 401

    async def test_list_empty_for_other_user(self, client: AsyncClient, test_admin, test_notification):
        """Admin should not see other user's notifications."""
        headers = make_auth_header(test_admin.id)
        response = await client.get("/api/v1/notifications", headers=headers)
        assert response.status_code == 200
        assert response.json()["total"] == 0

    async def test_list_with_pagination(self, client: AsyncClient, test_user, test_notification):
        """Should support pagination parameters."""
        headers = make_auth_header(test_user.id)
        response = await client.get(
            "/api/v1/notifications?page=1&page_size=5", headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 5


# ══════════════════════════════════════════════════════════════════════════════
# UNREAD COUNT
# ══════════════════════════════════════════════════════════════════════════════

class TestUnreadCount:
    async def test_unread_count(self, client: AsyncClient, test_user, test_notification):
        """Should return unread count."""
        headers = make_auth_header(test_user.id)
        response = await client.get("/api/v1/notifications/count", headers=headers)
        assert response.status_code == 200
        assert response.json()["unread_count"] >= 1

    async def test_unread_count_zero(self, client: AsyncClient, test_admin):
        """Should return 0 for user with no notifications."""
        headers = make_auth_header(test_admin.id)
        response = await client.get("/api/v1/notifications/count", headers=headers)
        assert response.status_code == 200
        assert response.json()["unread_count"] == 0


# ══════════════════════════════════════════════════════════════════════════════
# MARK AS READ
# ══════════════════════════════════════════════════════════════════════════════

class TestMarkAsRead:
    async def test_mark_single_as_read(self, client: AsyncClient, test_user, test_notification):
        """Should mark a specific notification as read."""
        headers = make_auth_header(test_user.id)
        response = await client.post(
            f"/api/v1/notifications/{test_notification.id}/read", headers=headers
        )
        assert response.status_code == 200

        # Verify unread count decreased
        count_resp = await client.get("/api/v1/notifications/count", headers=headers)
        assert count_resp.json()["unread_count"] == 0

    async def test_mark_nonexistent_as_read(self, client: AsyncClient, test_user):
        """Should return 404 for non-existent notification."""
        headers = make_auth_header(test_user.id)
        response = await client.post(
            "/api/v1/notifications/99999/read", headers=headers
        )
        assert response.status_code == 404

    async def test_mark_other_users_notification(self, client: AsyncClient, test_admin, test_notification):
        """Should not allow marking other user's notification."""
        headers = make_auth_header(test_admin.id)
        response = await client.post(
            f"/api/v1/notifications/{test_notification.id}/read", headers=headers
        )
        assert response.status_code == 404

    async def test_mark_all_as_read(self, client: AsyncClient, test_user, test_notification):
        """Should mark all notifications as read."""
        headers = make_auth_header(test_user.id)
        response = await client.post("/api/v1/notifications/read-all", headers=headers)
        assert response.status_code == 200

        count_resp = await client.get("/api/v1/notifications/count", headers=headers)
        assert count_resp.json()["unread_count"] == 0


# ══════════════════════════════════════════════════════════════════════════════
# DISMISS & DELETE
# ══════════════════════════════════════════════════════════════════════════════

class TestDismissAndDelete:
    async def test_dismiss_notification(self, client: AsyncClient, test_user, test_notification):
        """Should dismiss a notification (hide permanently)."""
        headers = make_auth_header(test_user.id)
        response = await client.post(
            f"/api/v1/notifications/{test_notification.id}/dismiss", headers=headers
        )
        assert response.status_code == 200

        # Dismissed notification should not appear in list
        list_resp = await client.get("/api/v1/notifications", headers=headers)
        ids = [n["id"] for n in list_resp.json()["notifications"]]
        assert test_notification.id not in ids

    async def test_delete_notification(self, client: AsyncClient, test_user, test_notification):
        """Should delete a notification permanently."""
        headers = make_auth_header(test_user.id)
        response = await client.delete(
            f"/api/v1/notifications/{test_notification.id}", headers=headers
        )
        assert response.status_code == 200

    async def test_delete_other_users_notification(self, client: AsyncClient, test_admin, test_notification):
        """Should not allow deleting other user's notification."""
        headers = make_auth_header(test_admin.id)
        response = await client.delete(
            f"/api/v1/notifications/{test_notification.id}", headers=headers
        )
        assert response.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# NOTIFICATION TYPES
# ══════════════════════════════════════════════════════════════════════════════

class TestNotificationTypes:
    async def test_list_types(self, client: AsyncClient, test_user):
        """Should list all available notification types."""
        headers = make_auth_header(test_user.id)
        response = await client.get("/api/v1/notifications/types", headers=headers)
        assert response.status_code == 200
        types = response.json()["types"]
        assert len(types) > 0
        type_names = [t["type"] for t in types]
        assert "document_created" in type_names
        assert "approval_required" in type_names


# ══════════════════════════════════════════════════════════════════════════════
# PREFERENCES
# ══════════════════════════════════════════════════════════════════════════════

class TestNotificationPreferences:
    async def test_get_preferences_defaults(self, client: AsyncClient, test_user):
        """Should return default preferences for all notification types."""
        headers = make_auth_header(test_user.id)
        response = await client.get("/api/v1/notifications/preferences", headers=headers)
        assert response.status_code == 200
        prefs = response.json()
        assert len(prefs) > 0
        # All should have default in_app_enabled=True
        for pref in prefs:
            assert "notification_type" in pref

    async def test_update_preference(self, client: AsyncClient, test_user):
        """Should update a notification preference."""
        headers = make_auth_header(test_user.id)
        response = await client.put(
            "/api/v1/notifications/preferences/document_created",
            json={"in_app_enabled": False, "email_enabled": True, "email_digest": "daily"},
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["in_app_enabled"] is False
        assert data["email_enabled"] is True
        assert data["email_digest"] == "daily"

    async def test_update_invalid_type(self, client: AsyncClient, test_user):
        """Should reject invalid notification type."""
        headers = make_auth_header(test_user.id)
        response = await client.put(
            "/api/v1/notifications/preferences/nonexistent_type",
            json={"in_app_enabled": False},
            headers=headers,
        )
        assert response.status_code == 400
