import asyncio
from app.infrastructure.db import init_db
from app.domain.models.tenant import Tenant
from app.domain.models.comunidad import ComunidadUser, VisitaRegistro

async def main():
    await init_db()
    tenant = await Tenant.find_one()
    if not tenant:
        print("No tenant found.")
        return
        
    t_id = str(tenant.id)
    print(f"Tenant ID: {t_id}")
    
    # Update all ComunidadUser with "default" to t_id
    users = await ComunidadUser.find(ComunidadUser.tenant_id == "default").to_list()
    for u in users:
        u.tenant_id = t_id
        await u.save()
    print(f"Updated {len(users)} users.")
    
    visitas = await VisitaRegistro.find(VisitaRegistro.tenant_id == "default").to_list()
    for v in visitas:
        v.tenant_id = t_id
        await v.save()
    print(f"Updated {len(visitas)} visitas.")

if __name__ == "__main__":
    asyncio.run(main())
