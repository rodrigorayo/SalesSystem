import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_duplicates():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    users = db.users
    
    pipeline = [
        {"$group": {
            "_id": {"tenant_id": "$tenant_id", "email": "$email"},
            "count": {"$sum": 1},
            "docs": {"$push": "$_id"}
        }},
        {"$match": {"count": {"$gt": 1}}}
    ]
    
    dupes = await users.aggregate(pipeline).to_list(100)
    for d in dupes:
        print(f"Duplicate found: {d['_id']} x {d['count']}")
        # print(f"IDs: {d['docs']}")

if __name__ == "__main__":
    asyncio.run(check_duplicates())
