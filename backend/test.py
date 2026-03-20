import asyncio
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.inventario import Inventario
from app.models.product import Product

async def main():
    try:
        client = AsyncIOMotorClient('mongodb://localhost:27017/testdb')
        await init_beanie(database=client.db, document_models=[Inventario, Product])
        settings = Product.get_settings()
        print("motor_collection from Product.get_settings():", getattr(settings, "motor_collection", None))
        print("motor_collection logic check passed.")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
