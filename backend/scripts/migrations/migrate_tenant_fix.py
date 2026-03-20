import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    rogue_tenant = "69986f70407a131de554398b"
    correct_tenant = "69986f70407a131de5543989"
    
    # 1. Update Sales
    res_sales = await db.sales.update_many(
        {"tenant_id": rogue_tenant},
        {"$set": {"tenant_id": correct_tenant}}
    )
    print(f"Updated {res_sales.modified_count} sales.")
    
    # 2. Update Users (just in case)
    res_users = await db.users.update_many(
        {"tenant_id": rogue_tenant},
        {"$set": {"tenant_id": correct_tenant}}
    )
    print(f"Updated {res_users.modified_count} users.")
    
    # 3. Update Inventory Logs
    res_inv = await db.inventory_logs.update_many(
        {"tenant_id": rogue_tenant},
        {"$set": {"tenant_id": correct_tenant}}
    )
    print(f"Updated {res_inv.modified_count} inventory logs.")
    
    # 4. Update Caja Movements
    res_caja = await db.caja_movimientos.update_many(
        {"tenant_id": rogue_tenant},
        {"$set": {"tenant_id": correct_tenant}}
    )
    print(f"Updated {res_caja.modified_count} caja movements.")

if __name__ == '__main__':
    asyncio.run(run())
