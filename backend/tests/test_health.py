import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_health_check_endpoint():
    """
    Ensure the API health check endpoint is responding with 200 OK.
    This acts as a deployment readiness probe.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health")
    
    assert response.status_code == 200
    assert response.json().get("status") == "ok"
