import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    tenants = await db.tenants.find({}).to_list(100)
    print(f"Tenants found: {len(tenants)}")
    for t in tenants:
        print(f"ID: {str(t['_id'])} | Name: {t.get('nombre')} | Code: {t.get('codigo')}")

if __name__ == '__main__':
    asyncio.run(run())
