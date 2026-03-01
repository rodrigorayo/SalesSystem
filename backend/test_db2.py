import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    sales_count = await db.Sale.count_documents({})
    print(f"Total sales in DB (Collection Sale): {sales_count}")
    
    sales = await db.Sale.find({}).to_list(10)
    for s in sales:
        print(f"ID: {s['_id']}, anula: {s.get('anulada')}, tenant_id: {s.get('tenant_id')}, sucursal_id: {s.get('sucursal_id')}, cashier_name: {s.get('cashier_name')}")

if __name__ == '__main__':
    asyncio.run(run())
