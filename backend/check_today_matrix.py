import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.user import User, UserRole
from app.models.sale import Sale
from beanie import init_beanie
from datetime import datetime

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    await init_beanie(database=client.salessystem, document_models=[User, Sale])
    
    current_user = await User.find_one(User.username == "taboada")
    today_start = datetime(2026, 2, 24, 0, 0, 0)
    
    sales = await Sale.find(Sale.tenant_id == current_user.tenant_id, Sale.created_at >= today_start).to_list()
    print(f"Today's sales found for Matrix Admin: {len(sales)}")
    for s in sales:
        print(f"ID: {s.id} | Cashier: {s.cashier_name}")

if __name__ == '__main__':
    asyncio.run(run())
