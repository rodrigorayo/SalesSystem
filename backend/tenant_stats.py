import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    tenants = await db.sales.distinct("tenant_id")
    print(f"Unique tenant IDs in sales: {tenants}")
    
    for t in tenants:
        count = await db.sales.count_documents({"tenant_id": t})
        print(f"Tenant: {t} | Count: {count}")
    
    # Also check users
    user_tenants = await db.users.distinct("tenant_id")
    print(f"Unique tenant IDs in users: {user_tenants}")
    for ut in user_tenants:
        u_count = await db.users.count_documents({"tenant_id": ut})
        print(f"Tenant in Users: {ut} | User Count: {u_count}")

if __name__ == '__main__':
    asyncio.run(run())
