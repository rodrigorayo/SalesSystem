import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.user import User, UserRole
from app.models.sale import Sale
from beanie import init_beanie
import json

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    await init_beanie(database=client.salessystem, document_models=[User, Sale])
    
    sale = await Sale.find_one({})
    if sale:
        # Simulate FastAPI Response serialization
        print("Sale JSON representation:")
        print(sale.model_dump_json(by_alias=True))
        print("Sale model dump:")
        print(sale.model_dump())
    else:
        print("No sale found.")

if __name__ == '__main__':
    asyncio.run(run())
