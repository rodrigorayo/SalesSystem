import asyncio
import httpx
from datetime import datetime, timedelta
from app.infrastructure.auth import create_access_token
from app.infrastructure.db import init_db
from app.domain.models.user import User

async def run_test():
    await init_db()
    admin = await User.find_one({"role": "SUPERADMIN"})
    token = create_access_token(data={"sub": str(admin.username)})
    
    url = "http://localhost:8001/api/v1/analytics/dashboard"
    params = {
        "start_date": "2024-01-01T00:00:00.000Z",
        "end_date": "2026-12-31T23:59:59.000Z",
        "time_range": "today"
    }
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    print(f"Testing live API on 8001 with params: {params} ...")
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.get(url, params=params, headers=headers)
        print("STATUS:", res.status_code)
        if res.status_code == 200:
            data = res.json()
            print("RESPONSE OVERVIEW:", data.get("overview"))
        else:
            print("RESPONSE TEXT:", res.text)

if __name__ == "__main__":
    asyncio.run(run_test())
