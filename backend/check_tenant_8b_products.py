import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    tenant_8b = "69986f70407a131de554398b"
    products = await db.products.find({"tenant_id": tenant_8b}).to_list(100)
    print(f"Products in tenant ...8b: {len(products)}")
    for p in products:
        print(f"Product: {p.get('descripcion')} | Price: {p.get('precio_venta')}")

if __name__ == '__main__':
    asyncio.run(run())
