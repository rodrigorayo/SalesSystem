import asyncio
from datetime import datetime, timezone
from app.infrastructure.db import init_db
from app.services.analytics_service import get_dashboard_metrics

async def test():
    await init_db()
    start = datetime.strptime("2024-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    end = datetime.strptime("2026-12-31T23:59:59", "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    
    try:
        print("=== PROBANDO 7 DIAS ===")
        res = await get_dashboard_metrics(
            tenant_id="default",
            start_date=start,
            end_date=end,
            sucursal_id=None,
            time_range="7days",
            clima_evento=None
        )
        print("7 DIAS Overview:", res.get("overview"))
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
