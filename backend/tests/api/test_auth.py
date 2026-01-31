import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_login_no_user(ac: AsyncClient):
    response = await ac.post(
        "/api/v1/auth/login", 
        data={"username": "wrong@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"

# Note: To test success, we would need to seed a user fixture first.
