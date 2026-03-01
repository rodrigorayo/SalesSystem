import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    users = await db.users.find({}).to_list(10)
    print("Users in DB:")
    for u in users:
        print(f"User: {u.get('username')}, FullName: {u.get('full_name')}, Tenant: {u.get('tenant_id')}, Sucursal: {u.get('sucursal_id')}, Role: {u.get('role')}")

if __name__ == '__main__':
    asyncio.run(run())
