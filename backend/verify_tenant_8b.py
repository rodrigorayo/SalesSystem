import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    # Check for tenant ...8b
    tenant_id = "69986f70407a131de554398b"
    tenant = await db.tenants.find_one({"_id": ObjectId(tenant_id)})
    if tenant:
        print(f"Tenant Found: {tenant_id}")
        print(f"Name: {tenant.get('nombre')}")
    else:
        print(f"Tenant {tenant_id} NOT found in collection 'tenants'.")

if __name__ == '__main__':
    asyncio.run(run())
