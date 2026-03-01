import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    user = await db.users.find_one({"username": "recoletat"})
    if user:
        print(f"username: {user.get('username')}")
        print(f"tenant_id:  {user.get('tenant_id')}")
        print(f"sucursal_id: {user.get('sucursal_id')}")
    else:
        print("User not found.")

if __name__ == '__main__':
    asyncio.run(run())
