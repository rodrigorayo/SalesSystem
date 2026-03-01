import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    # Check users with username like recoleta
    cursor = db.users.find({"username": {"$regex": "recoleta", "$options": "i"}})
    users = await cursor.to_list(100)
    
    print(f"Users found: {len(users)}")
    for u in users:
        tid = u.get('tenant_id')
        print(f"User: {u.get('username')} | tenant_id: '{tid}' | type: {type(tid)}")

if __name__ == '__main__':
    asyncio.run(run())
