import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    # Check for "default" specifically
    count_default = await db.sales.count_documents({"tenant_id": "default"})
    print(f"Sales with tenant_id='default': {count_default}")
    
    # Check for null/None
    count_none = await db.sales.count_documents({"tenant_id": None})
    print(f"Sales with tenant_id=None: {count_none}")
    
    # Check for empty string
    count_empty = await db.sales.count_documents({"tenant_id": ""})
    print(f"Sales with tenant_id='': {count_empty}")

if __name__ == '__main__':
    asyncio.run(run())
