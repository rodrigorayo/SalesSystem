import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_null_tenant():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client.salessystem
    
    null_count = await db.sales.count_documents({"tenant_id": None})
    print(f"Sales with null tenant_id: {null_count}")
    
    # Check if there is a 'default' tenant or similar
    t = await db.tenants.find_one({})
    if t:
        print(f"Sample tenant found: {t.get('_id')} - {t.get('name')}")

if __name__ == "__main__":
    asyncio.run(check_null_tenant())
