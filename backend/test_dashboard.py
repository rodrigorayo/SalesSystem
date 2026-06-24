import asyncio
import sys
import json
import os
from dotenv import load_dotenv

sys.path.append('.')

from app.services.analytics_service import get_dashboard_metrics
from app.infrastructure.db import init_db

async def test():
    load_dotenv()
    await init_db()
    
    res = await get_dashboard_metrics(tenant_id='default', time_range='today', start_date='', end_date='')
    print(json.dumps(res, indent=2))

if __name__ == '__main__':
    asyncio.run(test())
