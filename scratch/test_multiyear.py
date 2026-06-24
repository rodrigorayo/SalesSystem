import asyncio
import sys
import os

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.append(backend_dir)

from app.services.hourly_multiyear_service import get_hourly_multiyear
from datetime import date

async def run():
    res = await get_hourly_multiyear(
        tenant_id="default",
        fecha_referencia=date(2026, 6, 9)
    )
    import json
    print(json.dumps(res, indent=2))

if __name__ == '__main__':
    asyncio.run(run())
