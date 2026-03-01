import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    # search for tenant_id ending in 8b with regex
    cursor = db.sales.find({"tenant_id": {"$regex": "8b$"}})
    sales = await cursor.to_list(100)
    print(f"Sales found with regex '8b$': {len(sales)}")
    for s in sales:
        t_id = s.get('tenant_id')
        print(f"ID: {s['_id']} | Tenant: '{t_id}' | len: {len(str(t_id))}")

if __name__ == '__main__':
    asyncio.run(run())
