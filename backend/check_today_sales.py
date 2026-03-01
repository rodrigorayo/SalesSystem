import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    # Today's date (2026-02-24)
    today_start = datetime(2026, 2, 24, 0, 0, 0)
    
    sales = await db.sales.find({"created_at": {"$gte": today_start}}).to_list(10)
    print(f"Found {len(sales)} sales made today.")
    for s in sales:
        print(f"ID: {s['_id']}, Tenant: '{s.get('tenant_id')}', Sucursal: '{s.get('sucursal_id')}', Created: {s.get('created_at')}")

if __name__ == '__main__':
    asyncio.run(run())
