import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.user import User, UserRole
from app.models.sale import Sale
from beanie import init_beanie

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    await init_beanie(database=client.salessystem, document_models=[User, Sale])
    
    # Simulating SUPERADMIN (admin)
    current_user = await User.find_one(User.username == "admin")
    print(f"User: {current_user.username} | Role: {current_user.role} | Tenant: {current_user.tenant_id}")
    
    # NEW LOGIC: if SUPERADMIN, skip tenant filter
    filters = []
    if current_user.role != UserRole.SUPERADMIN:
        tenant_id = current_user.tenant_id or ""
        filters.append(Sale.tenant_id == tenant_id)
    
    sales = await Sale.find(*filters).sort(-Sale.created_at).limit(100).to_list()
    print(f"Sales found for SUPERADMIN: {len(sales)}")

if __name__ == '__main__':
    asyncio.run(run())
