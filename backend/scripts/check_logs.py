import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_logs():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client.salessystem
    
    logs = await db.inventory_logs.find({}).sort("created_at", -1).limit(5).to_list(length=5)
    for log in logs:
        print(f"Log: desc={log.get('descripcion')}, stock={log.get('stock_resultante')}, costo={log.get('costo_unitario_momento')}, precio={log.get('precio_venta_momento')}")

if __name__ == "__main__":
    asyncio.run(check_logs())
