import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    today_start = datetime(2026, 2, 24, 0, 0, 0)
    sale = await db.sales.find_one({"created_at": {"$gte": today_start}})
    
    if sale:
        tid = str(sale.get('tenant_id'))
        print(f"Last 4 chars of tenant_id: '{tid[-4:]}'")
    else:
        print("No sale found for today.")

if __name__ == '__main__':
    asyncio.run(run())
