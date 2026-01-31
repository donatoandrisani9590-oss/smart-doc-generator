import pytest
from typing import AsyncGenerator
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.db import get_db, Base
from app.core.config import settings

# Use an in-memory SQLite for tests or override with a test Postgres URL
# For this example, we'll assume the user runs tests against the docker DB or we mock it.
# To be safe without a running DB, we often use SQLite, but we use Postgres specific types (JSONB).
# So we will stick to the real DB URL but maybe a different DB name in a real env.
# Here we will assume the environment is set up for testing (e.g. via docker-compose)

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture
async def ac() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c
