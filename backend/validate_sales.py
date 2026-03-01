import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.user import User, UserRole
from app.models.sale import Sale
from beanie import init_beanie
from pydantic import ValidationError

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    await init_beanie(database=client.salessystem, document_models=[User, Sale])
    
    sales = await db.sales.find({}).to_list(1000)
    print(f"Validating {len(sales)} sales...")
    
    errors = 0
    for s_doc in sales:
        try:
            Sale.model_validate(s_doc)
        except ValidationError as e:
            print(f"Validation Error for Sale {s_doc.get('_id')}:")
            print(e)
            errors += 1
            
    print(f"Validation complete. Errors found: {errors}")

if __name__ == '__main__':
    # Need to get 'db' reference from client
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    asyncio.run(run())
