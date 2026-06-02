import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_ninoska():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client.salessystem
    
    ninoska = await db.users.find_one({"username": "ninoska.cori.amaru"})
    if ninoska:
        print(f"Ninoska found: role={ninoska.get('role')}, sucursal_id={ninoska.get('sucursal_id')}")
        sucursal = await db.sucursales.find_one({"_id": ninoska.get('sucursal_id')})
        if sucursal:
            print(f"Sucursal: {sucursal.get('nombre')} (tipo: {sucursal.get('tipo')})")

if __name__ == "__main__":
    asyncio.run(check_ninoska())
