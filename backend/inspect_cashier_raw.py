import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json

def json_serial(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError ("Type %s not serializable" % type(obj))

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    # Check the user who made the sale: 69986fcb407a131de554398c
    from bson import ObjectId
    user = await db.users.find_one({"_id": ObjectId("69986fcb407a131de554398c")})
    
    if user:
        print("User who made the sale (Raw):")
        user['_id'] = str(user['_id'])
        print(json.dumps(user, indent=2, default=json_serial))
    else:
        print("User not found by ID.")

if __name__ == '__main__':
    asyncio.run(run())
