import asyncio
import pandas as pd
from datetime import date, datetime, timedelta
from app.infrastructure.db import init_db
from app.services.hourly_multiyear_service import get_hourly_multiyear

async def test():
    await init_db()
    res = await get_hourly_multiyear("default", date(2026, 6, 3), sucursal="Heroinas")
    print("Test result:")
    print(res["sum_real"])
    
if __name__ == "__main__":
    asyncio.run(test())
