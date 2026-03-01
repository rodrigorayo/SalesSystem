import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    user = await db.users.find_one({"username": "juan.mamani.recoletat"})
    if user:
        print(f"User: {user.get('username')}")
        print(f"Tenant: {user.get('tenant_id')}")
    else:
        print("User not found.")

if __name__ == '__main__':
    asyncio.run(run())
