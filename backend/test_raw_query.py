import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    # Raw motor query
    sales_raw = await db.sales.find({"tenant_id": "default"}).to_list(10)
    print(f"Direct Motor query (tenant_id='default'): Found {len(sales_raw)} sales.")
    
    # Try with None/Null just in case
    sales_null = await db.sales.find({"tenant_id": None}).to_list(10)
    print(f"Direct Motor query (tenant_id=None): Found {len(sales_null)} sales.")

if __name__ == '__main__':
    asyncio.run(run())
