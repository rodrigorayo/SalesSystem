import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["sales_system"]
    sales = await db.sales.find({}).to_list(length=10)
    print(f"Sales count: {len(sales)}")
    for sale in sales:
        print(f"ID: {sale['_id']}, Tenant: {sale.get('tenant_id')}, Sucursal: {sale.get('sucursal_id')}, Anulada: {sale.get('anulada')}")

if __name__ == '__main__':
    asyncio.run(run())
