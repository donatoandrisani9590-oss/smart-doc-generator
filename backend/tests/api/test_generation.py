import pytest
from httpx import AsyncClient
from unittest.mock import patch

@pytest.mark.asyncio
async def test_generate_document_unauthorized(ac: AsyncClient):
    response = await ac.post("/api/v1/documents/generate/test.docx", json={"context": {}})
    assert response.status_code == 401
