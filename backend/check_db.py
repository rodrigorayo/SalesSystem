import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()
async def main():
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db = AsyncIOMotorClient(uri)["salessystem"]
    s = await db.sales.find_one({}, sort=[("created_at", -1)])
    print("SALE:")
    for k, v in s.items():
        print(f"{k}: {v} ({type(v)})")

asyncio.run(main())
