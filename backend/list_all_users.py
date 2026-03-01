import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    users = await db.users.find({}).to_list(100)
    print(f"Users found: {len(users)}")
    for u in users:
        print(f"ID: {str(u['_id'])} | User: {u.get('username')} | Name: {u.get('full_name')} | Tenant: {u.get('tenant_id')} | Suc: {u.get('sucursal_id')}")

if __name__ == '__main__':
    asyncio.run(run())
