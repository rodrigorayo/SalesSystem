import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def main():
    mongo_uri = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_uri)
    # Extract db name
    db_name = mongo_uri.split('/')[-1].split('?')[0]
    if not db_name or db_name == 'localhost:27017':
         db_name = "test"
         
    db = client.get_database(db_name)
    
    users = await db["users"].find({"username": {"$regex": "taboada", "$options": "i"}}).to_list(10)
    for u in users:
        print(f"User: {u.get('username')}, Role: {u.get('role')}, Sucursal: {u.get('sucursal_id')}")

if __name__ == "__main__":
    asyncio.run(main())
