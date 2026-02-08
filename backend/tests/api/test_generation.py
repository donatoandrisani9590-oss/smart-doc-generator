"""
Document Generation API Tests

Covers:
- Authorization (unauthenticated requests rejected)
"""
import pytest
from httpx import AsyncClient


class TestGeneration:
    async def test_generate_document_unauthorized(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/documents/generate/test.docx",
            json={"context": {}},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert response.status_code in (401, 404, 405)
