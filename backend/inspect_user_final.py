import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import json

def json_serial(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError ("Type %s not serializable" % type(obj))

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    cursor = db.users.find({"username": "recoletat"})
    users = await cursor.to_list(100)
    
    for u in users:
        u['_id'] = str(u['_id'])
        print(json.dumps(u, indent=2, default=json_serial))

if __name__ == '__main__':
    asyncio.run(run())
