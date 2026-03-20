import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.tenant import Tenant
from app.models.user import User
from beanie import init_beanie

async def check():
    url = os.environ.get("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db = client.salessystem  # THIS EXPLICIT THE CORRECT DB!
    await init_beanie(database=db, document_models=[Tenant, User])
    
    tenants = await Tenant.find_all().to_list()
    valid_ts = [str(t.id) for t in tenants]
    
    users = await User.find_all().to_list()
    orphans = []
    
    for u in users:
        if u.role != "SUPERADMIN":
            if not u.tenant_id or u.tenant_id not in valid_ts:
                orphans.append(u)
                
    print(f"Tenants hallados vivos: {len(valid_ts)}")
    print(f"Borrando {len(orphans)} usuarios huérfanos...")
    
    for u in orphans:
        print(f"Borrando huerfano: {u.email}")
        await u.delete()
        
    print("Mantenimiento finalizado con éxito.")

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    asyncio.run(check())
