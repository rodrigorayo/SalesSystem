import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    products = await db.products.find({}).to_list(100)
    print(f"Products found: {len(products)}")
    tenants = set()
    for p in products:
        tenants.add(p.get('tenant_id'))
    
    print(f"Distinct tenant IDs in products: {tenants}")
    if products:
        p = products[0]
        print(f"Sample Product: {p.get('descripcion')} | Tenant: {p.get('tenant_id')}")

if __name__ == '__main__':
    asyncio.run(run())
