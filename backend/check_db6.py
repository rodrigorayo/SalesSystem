import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['salessystem']
    cols = await db.list_collection_names()
    print('Tablas en la BD:', cols)

asyncio.run(main())
