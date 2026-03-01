import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    user = await db.users.find_one({"full_name": "Admin Taboada"})
    if not user:
         user = await db.users.find_one({"username": "admin"})
         
    if user:
        print(f"User found: {user.get('username')}")
        print(f"Full Name: {user.get('full_name')}")
        print(f"Role: {user.get('role')}")
        print(f"Tenant: {user.get('tenant_id')}")
        print(f"Sucursal: {user.get('sucursal_id')}")
    else:
        print("User not found.")

if __name__ == '__main__':
    asyncio.run(run())
