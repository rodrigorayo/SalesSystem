import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    today_start = datetime(2026, 2, 24, 0, 0, 0)
    sales = await db.sales.find({"created_at": {"$gte": today_start}}).to_list(100)
    
    print(f"Sales found today: {len(sales)}")
    for s in sales:
        t_id = s.get('tenant_id')
        s_id = s.get('sucursal_id')
        print(f"ID: {s['_id']} | Tenant: '{t_id}' | Sucursal: '{s_id}' | Cashier: {s.get('cashier_name')}")

if __name__ == '__main__':
    asyncio.run(run())
