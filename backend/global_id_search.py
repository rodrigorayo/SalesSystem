import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    rogue_id = "69986f70407a131de554398b"
    collections = await db.list_collection_names()
    
    print(f"Searching for {rogue_id} in all collections...")
    for coll_name in collections:
        coll = db[coll_name]
        # This is a bit slow but thorough
        cursor = coll.find()
        async for doc in cursor:
            doc_str = str(doc)
            if rogue_id in doc_str:
                print(f"MATCH FOUND in collection '{coll_name}'!")
                print(f"Document ID: {doc.get('_id')}")
                for k, v in doc.items():
                    if str(v) == rogue_id:
                        print(f"  Field '{k}' has the rogue ID.")
    print("Search complete.")

if __name__ == '__main__':
    asyncio.run(run())
