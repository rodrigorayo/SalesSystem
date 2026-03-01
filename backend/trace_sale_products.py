import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    sale = await db.sales.find_one({"tenant_id": "69986f70407a131de554398b"})
    if sale:
        print(f"Sale ID: {sale['_id']}")
        items = sale.get('items', [])
        for it in items:
            pid = it.get('producto_id')
            p = await db.products.find_one({"_id": pid})
            # Try as ObjectId if string fails
            if not p:
                from bson import ObjectId
                try:
                    p = await db.products.find_one({"_id": ObjectId(pid)})
                except:
                    pass
            
            p_tenant = p.get('tenant_id') if p else "NOT FOUND"
            print(f"Product ID: {pid} | Name: {it.get('producto_nombre')} | Tenant in DB: {p_tenant}")
    else:
        print("No sales for tenant ...8b found.")

if __name__ == '__main__':
    asyncio.run(run())
