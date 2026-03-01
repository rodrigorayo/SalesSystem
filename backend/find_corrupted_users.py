import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    # Check users with tenant_id ending in 8b
    tenant_8b = "69986f70407a131de554398b"
    users = await db.users.find({"tenant_id": tenant_8b}).to_list(100)
    print(f"Users with tenant_id={tenant_8b}: {len(users)}")
    for u in users:
        print(f"User: {u.get('username')} | Name: {u.get('full_name')} | Role: {u.get('role')}")

if __name__ == '__main__':
    asyncio.run(run())
