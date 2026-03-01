import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    # Get the most recent sale
    sale = await db.sales.find_one({}, sort=[("created_at", -1)])
    if sale:
        print("Raw sale data:")
        sale['_id'] = str(sale['_id'])
        if 'created_at' in sale:
            sale['created_at'] = str(sale['created_at'])
        # Print without truncation
        print(json.dumps(sale, indent=2))
    else:
        print("No sales found.")

if __name__ == '__main__':
    asyncio.run(run())
