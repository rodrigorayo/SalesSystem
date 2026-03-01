import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    sucursales = await db.sucursales.find({}).to_list(100)
    print(f"Sucursales found: {len(sucursales)}")
    for s in sucursales:
        print(f"ID: {str(s['_id'])} | Name: {s.get('nombre')} | Tenant: {s.get('tenant_id')}")

if __name__ == '__main__':
    asyncio.run(run())
