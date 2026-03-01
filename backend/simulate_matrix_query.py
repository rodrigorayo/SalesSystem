import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.user import User, UserRole
from app.models.sale import Sale
from beanie import init_beanie

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    await init_beanie(database=client.salessystem, document_models=[User, Sale])
    
    # Simulating ADMIN_MATRIZ (taboada)
    current_user = await User.find_one(User.username == "taboada")
    print(f"User: {current_user.username} | Role: {current_user.role} | Tenant: {current_user.tenant_id}")
    
    tenant_id = current_user.tenant_id or ""
    filters = [Sale.tenant_id == tenant_id]
    
    # No sucursal_id filter passed
    sales = await Sale.find(*filters).sort(-Sale.created_at).limit(100).to_list()
    print(f"Sales found for Matrix Admin: {len(sales)}")
    for s in sales:
        print(f"Sale ID: {s.id} | Tenant: {s.tenant_id}")

if __name__ == '__main__':
    asyncio.run(run())
