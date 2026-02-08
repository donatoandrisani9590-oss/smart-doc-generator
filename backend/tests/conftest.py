"""
Test Configuration & Fixtures

Uses SQLite in-memory database for fast, isolated tests.
No external services (PostgreSQL, Redis) required.
"""
import os
import sys
import json
import types
import pytest
import pytest_asyncio
from typing import AsyncGenerator
from datetime import timedelta
from unittest.mock import MagicMock

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Mock optional native dependencies that may not be available in test environment
if "magic" not in sys.modules:
    _magic_mock = MagicMock()
    _magic_mock.from_file = MagicMock(return_value="application/pdf")
    sys.modules["magic"] = _magic_mock

# Override settings BEFORE importing app
os.environ["DATABASE_URL"] = "sqlite+aiosqlite://"
os.environ["SECRET_KEY"] = "test_secret_key_for_testing_only_" + "x" * 30
os.environ["REFRESH_SECRET_KEY"] = "test_refresh_key_for_testing_only_" + "x" * 30
os.environ["DEBUG"] = "true"
os.environ["ALLOW_AUTH_BYPASS"] = "false"  # Tests should use real auth
os.environ["ENVIRONMENT"] = "development"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"

from app.db import Base, get_db
from app.core.security import (
    get_password_hash, create_access_token, create_password_reset_token,
    create_pre_auth_token,
)
from app.core.config import settings


# ══════════════════════════════════════════════════════════════════════════════
# DATABASE FIXTURES
# ══════════════════════════════════════════════════════════════════════════════

@pytest_asyncio.fixture
async def engine():
    """Create a fresh in-memory SQLite engine per test."""
    # Import all models so Base.metadata knows about all tables
    from app.models import core, documents, enterprise, collaboration  # noqa: F401

    _engine = create_async_engine(
        "sqlite+aiosqlite://",
        echo=False,
        connect_args={"check_same_thread": False},
    )
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield _engine
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional database session for each test."""
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session


# ══════════════════════════════════════════════════════════════════════════════
# USER FIXTURES
# ══════════════════════════════════════════════════════════════════════════════

@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession):
    """Create a regular test user and return the model instance."""
    from app.models.core import User
    user = User(
        email="testuser@example.com",
        password_hash=get_password_hash("TestPasswort1!"),
        role="user",
        country_code="DE",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_admin(db_session: AsyncSession):
    """Create an admin test user and return the model instance."""
    from app.models.core import User
    admin = User(
        email="admin@example.com",
        password_hash=get_password_hash("AdminPasswort1!"),
        role="admin",
        country_code="DE",
        is_active=True,
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    return admin


@pytest_asyncio.fixture
async def inactive_user(db_session: AsyncSession):
    """Create an inactive user for testing deactivated accounts."""
    from app.models.core import User
    user = User(
        email="inactive@example.com",
        password_hash=get_password_hash("TestPasswort1!"),
        role="user",
        country_code="DE",
        is_active=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


def make_auth_header(user_id: int) -> dict:
    """Create a valid JWT auth header with CSRF token for the given user ID."""
    token = create_access_token(
        subject=user_id,
        expires_delta=timedelta(hours=1),
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Requested-With": "XMLHttpRequest",
    }


# ══════════════════════════════════════════════════════════════════════════════
# TEST DATA FIXTURES
# ══════════════════════════════════════════════════════════════════════════════

@pytest_asyncio.fixture
async def test_document_type(db_session: AsyncSession):
    """Create a test document type."""
    from app.models.documents import DocumentType
    dt = DocumentType(
        name="Arbeitsvertrag Vollzeit",
        country_code="DE",
        category="Arbeitsvertrag",
        is_active=True,
    )
    db_session.add(dt)
    await db_session.commit()
    await db_session.refresh(dt)
    return dt


@pytest_asyncio.fixture
async def test_clause(db_session: AsyncSession):
    """Create a test clause (global, no user_id)."""
    from app.models.documents import Clause
    clause = Clause(
        title="Probezeit",
        content_html="<p>Die Probezeit betraegt {{ probezeit_monate }} Monate.</p>",
        country_code="DE",
        category="Arbeitsrecht",
        version=1,
        is_active=True,
        user_id=None,  # Global clause
    )
    db_session.add(clause)
    await db_session.commit()
    await db_session.refresh(clause)
    return clause


@pytest_asyncio.fixture
async def test_draft(db_session: AsyncSession, test_user, test_document_type):
    """Create a test draft for the test user."""
    from app.models.enterprise import DocumentDraft
    draft = DocumentDraft(
        document_type_id=test_document_type.id,
        country_code="DE",
        user_id=str(test_user.id),
        name="Test Entwurf",
        form_data=json.dumps({"vorname": "Max", "nachname": "Mustermann"}),
        version=1,
    )
    db_session.add(draft)
    await db_session.commit()
    await db_session.refresh(draft)
    return draft


# ══════════════════════════════════════════════════════════════════════════════
# HTTP CLIENT FIXTURE
# ══════════════════════════════════════════════════════════════════════════════

@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    AsyncClient with overridden DB dependency.
    All requests use the test database session.
    """
    from app.main import app

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ══════════════════════════════════════════════════════════════════════════════
# 2FA / TOTP FIXTURES
# ══════════════════════════════════════════════════════════════════════════════

@pytest_asyncio.fixture
async def totp_user(db_session: AsyncSession):
    """Create a user with 2FA enabled (has totp_secret and totp_enabled=True)."""
    import pyotp
    from app.models.core import User

    secret = pyotp.random_base32()
    user = User(
        email="totp@example.com",
        password_hash=get_password_hash("TotpPasswort1!"),
        role="user",
        country_code="DE",
        is_active=True,
        totp_secret=secret,
        totp_enabled=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    # Attach secret for test convenience
    user._test_secret = secret
    return user


# ══════════════════════════════════════════════════════════════════════════════
# NOTIFICATION FIXTURES
# ══════════════════════════════════════════════════════════════════════════════

@pytest_asyncio.fixture
async def test_notification(db_session: AsyncSession, test_user):
    """Create a test notification for the test user."""
    from app.models.enterprise import Notification
    notification = Notification(
        user_id=str(test_user.id),
        notification_type="document_created",
        title="Test Notification",
        message="Ein Testdokument wurde erstellt.",
        priority="normal",
        is_read=False,
        is_dismissed=False,
    )
    db_session.add(notification)
    await db_session.commit()
    await db_session.refresh(notification)
    return notification


# ══════════════════════════════════════════════════════════════════════════════
# FAVORITES FIXTURES
# ══════════════════════════════════════════════════════════════════════════════

@pytest_asyncio.fixture
async def test_favorite(db_session: AsyncSession, test_user, test_document_type):
    """Create a test favorite for the test user."""
    from app.models.enterprise import UserFavorite
    fav = UserFavorite(
        user_id=str(test_user.id),
        favorite_type="document_type",
        document_type_id=test_document_type.id,
        display_name="Mein Favorit",
        display_order=0,
    )
    db_session.add(fav)
    await db_session.commit()
    await db_session.refresh(fav)
    return fav
