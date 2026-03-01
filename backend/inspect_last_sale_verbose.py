import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    sale = await db.sales.find_one({}, sort=[("created_at", -1)])
    if sale:
        print(f"Sale ID: {sale['_id']}")
        print(f"tenant_id: {sale.get('tenant_id')}")
        print(f"sucursal_id: {sale.get('sucursal_id')}")
        print(f"cashier_id: {sale.get('cashier_id')}")
        print(f"cashier_name: {sale.get('cashier_name')}")
    else:
        print("No sales found.")

if __name__ == '__main__':
    asyncio.run(run())
