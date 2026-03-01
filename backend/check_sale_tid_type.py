import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    sale = await db.sales.find_one({"tenant_id": {"$exists": True}})
    if sale:
        tid = sale.get('tenant_id')
        print(f"tenant_id value: {tid}")
        print(f"tenant_id type: {type(tid)}")
    else:
        print("No sales with tenant_id found.")

if __name__ == '__main__':
    asyncio.run(run())
