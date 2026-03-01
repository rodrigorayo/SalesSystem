import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    today_start = datetime(2026, 2, 24, 0, 0, 0)
    sale = await db.sales.find_one({"created_at": {"$gte": today_start}})
    
    if sale:
        tid = sale.get('tenant_id')
        print(f"tenant_id: '{tid}'")
        print(f"chars: {[ord(c) for c in str(tid)]}")
    else:
        print("No sale found for today.")

if __name__ == '__main__':
    asyncio.run(run())
