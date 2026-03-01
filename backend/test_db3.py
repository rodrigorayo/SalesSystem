import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    # Check collections
    cols = await db.list_collection_names()
    print(f"Collections in 'salessystem': {cols}")
    
    # Check 'sales' collection
    sales_count = await db.sales.count_documents({})
    print(f"Total sales in DB (Collection 'sales'): {sales_count}")
    
    sales = await db.sales.find({}).sort("created_at", -1).to_list(10)
    for s in sales:
        print(f"ID: {s['_id']}, Created: {s.get('created_at')}, Anula: {s.get('anulada')}, Tenant: {s.get('tenant_id')}, Suc: {s.get('sucursal_id')}, Cashier: {s.get('cashier_name')}")

if __name__ == '__main__':
    asyncio.run(run())
