import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.tenant import Tenant
from app.models.user import User
from beanie import init_beanie

async def cleanup_orphans():
    print("Conectando a MongoDB para purgar credenciales huérfanas...")
    url = os.environ.get("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db_name = url.split('/')[-1].split('?')[0]
    if not db_name:
        db_name = "test"
    db = client[db_name]
    
    await init_beanie(database=db, document_models=[Tenant, User])
    
    # Encontrar todos los tenants activos
    tenants = await Tenant.find_all().to_list()
    valid_tenant_ids = [str(t.id) for t in tenants]
    
    # Encontrar usuarios cuyo tenant_id no está en la lista de tenants válidos (o sea, empresas eliminadas)
    users = await User.find_all().to_list()
    orphaned_users = 0
    for u in users:
        # Los usuarios sin tenant_id o que su tenant_id ya no existe
        if u.tenant_id and u.tenant_id not in valid_tenant_ids and u.role != "SUPERADMIN":
            print(f"Borrando usuario huérfano: {u.email} de empresa borrada {u.tenant_id}")
            await u.delete()
            orphaned_users += 1
            
    print(f"Limpieza completada. {orphaned_users} cuentas liberadas.")

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    asyncio.run(cleanup_orphans())
