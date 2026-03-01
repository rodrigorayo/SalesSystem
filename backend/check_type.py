import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    user = await db.users.find_one({"username": "taboada"})
    if user:
        tid = user.get('tenant_id')
        print(f"User: {user.get('username')}")
        print(f"tenant_id: {tid}")
        print(f"type(tenant_id): {type(tid)}")
    else:
        print("User not found.")

if __name__ == '__main__':
    asyncio.run(run())
