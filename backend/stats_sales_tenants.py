import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    tenants = await db.sales.distinct("tenant_id")
    print(f"Unique tenant IDs in sales: {tenants}")
    
    for tid in tenants:
        count = await db.sales.count_documents({"tenant_id": tid})
        print(f"Tenant: {tid} | Sales Count: {count}")

if __name__ == '__main__':
    asyncio.run(run())
