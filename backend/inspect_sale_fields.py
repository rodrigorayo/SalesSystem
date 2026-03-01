import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    sale = await db.sales.find_one({})
    if sale:
        print(f"Keys: {list(sale.keys())}")
        print(f"tenant_id: '{sale.get('tenant_id')}'")
        print(f"sucursal_id: '{sale.get('sucursal_id')}'")
    else:
        print("No sales found.")

if __name__ == '__main__':
    asyncio.run(run())
