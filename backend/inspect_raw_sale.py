import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    sale = await db.sales.find_one({})
    if sale:
        print("Raw sale data:")
        # Convert ObjectId to string for printing
        sale['_id'] = str(sale['_id'])
        if 'created_at' in sale:
            sale['created_at'] = str(sale['created_at'])
        print(json.dumps(sale, indent=2))
    else:
        print("No sales found in 'sales' collection.")

if __name__ == '__main__':
    asyncio.run(run())
