import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    cursor = db.users.find({"full_name": "Admin Recoleta"})
    users = await cursor.to_list(100)
    
    print(f"Users with name 'Admin Recoleta': {len(users)}")
    for u in users:
        u['_id'] = str(u['_id'])
        print(json.dumps(u, indent=2))

if __name__ == '__main__':
    asyncio.run(run())
