import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    mongo_url = os.environ.get("MONGODB_URI", "mongodb+srv://rodrigo:oioioioi@cluster0.o5hck.mongodb.net/?retryWrites=true&w=majority")
    client = AsyncIOMotorClient(mongo_url)
    db = client.get_database("test")  # the actual db is likely in the URL or default
    
    tenant = await db["tenants"].find_one()
    print("Tenant Sample:")
    print(tenant)

    sale_item = await db["sale_items"].find_one()
    print("\nSaleItem Sample:")
    print(sale_item)

if __name__ == "__main__":
    asyncio.run(main())
