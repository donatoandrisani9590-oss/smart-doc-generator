"""
Tests for Document Locking (pessimistic locking) endpoints.

Tests: acquire, release, check, heartbeat, conflict, auto-expire, force-release.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient
from datetime import datetime, timedelta, timezone

from app.core.security import create_access_token
from app.models.enterprise import GeneratedDocument, DocumentLock


def make_auth_header(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "X-Requested-With": "XMLHttpRequest",
    }


@pytest_asyncio.fixture
async def test_document(db_session, test_user):
    """Create a test document for lock tests."""
    doc = GeneratedDocument(
        document_type_id=1,
        file_path="/test/lock_doc.pdf",
        created_by_id=test_user.id,
        created_by=test_user.email,
        title="Lock Test Document",
    )
    db_session.add(doc)
    await db_session.commit()
    await db_session.refresh(doc)
    return doc


@pytest_asyncio.fixture
async def locked_document(db_session, test_document, test_user):
    """Create a document with an active lock by test_user."""
    lock = DocumentLock(
        document_id=test_document.id,
        locked_by_id=test_user.id,
        locked_by_email=test_user.email,
        locked_by_name="Test User",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        lock_reason="correction",
    )
    db_session.add(lock)
    await db_session.commit()
    await db_session.refresh(lock)
    return {"document": test_document, "lock": lock}


@pytest_asyncio.fixture
async def admin_locked_document(db_session, test_admin):
    """Create a document locked by admin."""
    doc = GeneratedDocument(
        document_type_id=1,
        file_path="/test/admin_lock_doc.pdf",
        created_by_id=test_admin.id,
        created_by=test_admin.email,
        title="Admin Lock Document",
    )
    db_session.add(doc)
    await db_session.commit()
    await db_session.refresh(doc)

    lock = DocumentLock(
        document_id=doc.id,
        locked_by_id=test_admin.id,
        locked_by_email=test_admin.email,
        locked_by_name="Admin User",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        lock_reason="review",
    )
    db_session.add(lock)
    await db_session.commit()
    await db_session.refresh(lock)
    return {"document": doc, "lock": lock}


class TestAcquireLock:
    """Tests for POST /api/v1/locks/acquire"""

    @pytest.mark.anyio
    async def test_acquire_lock_success(self, client: AsyncClient, test_user, test_document):
        """Should acquire lock on an existing document."""
        token = create_access_token(subject=test_user.id)
        response = await client.post(
            "/api/v1/locks/acquire",
            json={"document_id": test_document.id, "lock_reason": "correction"},
            headers=make_auth_header(token),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["document_id"] == test_document.id
        assert data["lock_id"] > 0
        assert "expires_at" in data

    @pytest.mark.anyio
    async def test_acquire_lock_nonexistent_document(self, client: AsyncClient, test_user):
        """Should return 404 for nonexistent document."""
        token = create_access_token(subject=test_user.id)
        response = await client.post(
            "/api/v1/locks/acquire",
            json={"document_id": 99999},
            headers=make_auth_header(token),
        )
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_acquire_lock_conflict(self, client: AsyncClient, test_user, admin_locked_document):
        """Should return 409 when document is locked by another user."""
        token = create_access_token(subject=test_user.id)
        response = await client.post(
            "/api/v1/locks/acquire",
            json={"document_id": admin_locked_document["document"].id},
            headers=make_auth_header(token),
        )
        assert response.status_code == 409

    @pytest.mark.anyio
    async def test_acquire_lock_refresh_own(self, client: AsyncClient, test_user, locked_document):
        """Same user should be able to refresh their own lock."""
        token = create_access_token(subject=test_user.id)
        response = await client.post(
            "/api/v1/locks/acquire",
            json={"document_id": locked_document["document"].id},
            headers=make_auth_header(token),
        )
        assert response.status_code == 200
        assert "erneuert" in response.json()["message"]


class TestReleaseLock:
    """Tests for POST /api/v1/locks/release"""

    @pytest.mark.anyio
    async def test_release_own_lock(self, client: AsyncClient, test_user, locked_document):
        """Lock holder should be able to release their lock."""
        token = create_access_token(subject=test_user.id)
        response = await client.post(
            "/api/v1/locks/release",
            json={"document_id": locked_document["document"].id},
            headers=make_auth_header(token),
        )
        assert response.status_code == 200
        assert "aufgehoben" in response.json()["message"]

    @pytest.mark.anyio
    async def test_release_nonexistent_lock(self, client: AsyncClient, test_user):
        """Releasing a non-locked document should not error."""
        token = create_access_token(subject=test_user.id)
        response = await client.post(
            "/api/v1/locks/release",
            json={"document_id": 99999},
            headers=make_auth_header(token),
        )
        assert response.status_code == 200

    @pytest.mark.anyio
    async def test_release_other_user_lock_forbidden(self, client: AsyncClient, test_user, admin_locked_document):
        """Regular user should not be able to release another user's lock."""
        token = create_access_token(subject=test_user.id)
        response = await client.post(
            "/api/v1/locks/release",
            json={"document_id": admin_locked_document["document"].id},
            headers=make_auth_header(token),
        )
        assert response.status_code == 403


class TestCheckLockStatus:
    """Tests for GET /api/v1/locks/{document_id}"""

    @pytest.mark.anyio
    async def test_check_unlocked_document(self, client: AsyncClient, test_user, test_document):
        """Unlocked document should return is_locked=False."""
        token = create_access_token(subject=test_user.id)
        response = await client.get(
            f"/api/v1/locks/{test_document.id}",
            headers=make_auth_header(token),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_locked"] is False

    @pytest.mark.anyio
    async def test_check_locked_document(self, client: AsyncClient, test_user, test_document):
        """Locked document should return lock details after acquiring via API."""
        token = create_access_token(subject=test_user.id)

        # Acquire lock via API first
        acquire_resp = await client.post(
            "/api/v1/locks/acquire",
            json={"document_id": test_document.id, "lock_reason": "correction"},
            headers=make_auth_header(token),
        )
        assert acquire_resp.status_code == 200

        # Now check status
        response = await client.get(
            f"/api/v1/locks/{test_document.id}",
            headers=make_auth_header(token),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_locked"] is True
        assert data["locked_by_email"] == test_user.email
        assert data["is_own_lock"] is True
        assert data["lock_reason"] == "correction"


class TestHeartbeat:
    """Tests for POST /api/v1/locks/heartbeat"""

    @pytest.mark.anyio
    async def test_heartbeat_extends_lock(self, client: AsyncClient, test_user, locked_document):
        """Heartbeat should extend lock expiration."""
        token = create_access_token(subject=test_user.id)
        response = await client.post(
            "/api/v1/locks/heartbeat",
            json={"document_id": locked_document["document"].id},
            headers=make_auth_header(token),
        )
        assert response.status_code == 200
        data = response.json()
        assert "expires_at" in data

    @pytest.mark.anyio
    async def test_heartbeat_wrong_user(self, client: AsyncClient, test_user, admin_locked_document):
        """Non-lock-holder should not be able to send heartbeat."""
        token = create_access_token(subject=test_user.id)
        response = await client.post(
            "/api/v1/locks/heartbeat",
            json={"document_id": admin_locked_document["document"].id},
            headers=make_auth_header(token),
        )
        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_heartbeat_no_lock(self, client: AsyncClient, test_user, test_document):
        """Heartbeat on unlocked document should return 404."""
        token = create_access_token(subject=test_user.id)
        response = await client.post(
            "/api/v1/locks/heartbeat",
            json={"document_id": test_document.id},
            headers=make_auth_header(token),
        )
        assert response.status_code == 404


class TestForceRelease:
    """Tests for POST /api/v1/locks/force-release"""

    @pytest.mark.anyio
    async def test_admin_force_release(self, client: AsyncClient, test_admin, locked_document):
        """Admin should be able to force-release any lock."""
        admin_token = create_access_token(subject=test_admin.id)
        response = await client.post(
            "/api/v1/locks/force-release",
            json={"document_id": locked_document["document"].id},
            headers=make_auth_header(admin_token),
        )
        assert response.status_code == 200
        assert "erzwungen" in response.json()["message"]

    @pytest.mark.anyio
    async def test_regular_user_force_release_forbidden(self, client: AsyncClient, test_user):
        """Regular user should not be able to force-release."""
        token = create_access_token(subject=test_user.id)
        response = await client.post(
            "/api/v1/locks/force-release",
            json={"document_id": 1},
            headers=make_auth_header(token),
        )
        assert response.status_code == 403


class TestExpiredLockCleanup:
    """Tests for automatic expired lock cleanup."""

    @pytest.mark.anyio
    async def test_expired_lock_auto_cleaned(self, client: AsyncClient, test_user, db_session, test_document):
        """Expired locks should be automatically cleaned on status check."""
        # Create an already-expired lock
        lock = DocumentLock(
            document_id=test_document.id,
            locked_by_id=test_user.id,
            locked_by_email=test_user.email,
            locked_by_name=test_user.email,
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        )
        db_session.add(lock)
        await db_session.commit()

        token = create_access_token(subject=test_user.id)
        response = await client.get(
            f"/api/v1/locks/{test_document.id}",
            headers=make_auth_header(token),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_locked"] is False  # Expired lock should be cleaned up
