import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    tenant_8b = "69986f70407a131de554398b"
    collections = await db.list_collection_names()
    
    print(f"Scanning collections for tenant_id: {tenant_8b}")
    for coll_name in collections:
        count = await db[coll_name].count_documents({"tenant_id": tenant_8b})
        if count > 0:
            print(f"Collection: {coll_name} | Count: {count}")

if __name__ == '__main__':
    asyncio.run(run())
