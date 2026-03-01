import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    # Tenant ...8b
    tenant_id = "69986f70407a131de554398b"
    
    users = await db.users.find({"tenant_id": tenant_id}).to_list(100)
    print(f"Users in tenant ...8b: {len(users)}")
    for u in users:
        print(f"ID: {str(u['_id'])} | User: {u.get('username')} | Name: {u.get('full_name')} | Role: {u.get('role')}")

if __name__ == '__main__':
    asyncio.run(run())
