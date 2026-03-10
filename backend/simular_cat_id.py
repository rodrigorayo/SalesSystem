import asyncio
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.category import Category

async def main():
    client = AsyncIOMotorClient("mongodb+srv://rodrigorayomartinez:eXk3B57J0N2A4Hl4@cluster0.1eih7.mongodb.net/testdb?retryWrites=true&w=majority")
    await init_beanie(database=client.testdb, document_models=[Category])
    
    c1 = Category(tenant_id="test", name="T1", is_active=True)
    c2 = Category(tenant_id="test", name="T2", is_active=True)
    
    print("Before insert_many: c1.id =", c1.id, "c2.id =", c2.id)
    await Category.insert_many([c1, c2])
    print("After insert_many: c1.id =", c1.id, "c2.id =", c2.id)

if __name__ == "__main__":
    asyncio.run(main())
