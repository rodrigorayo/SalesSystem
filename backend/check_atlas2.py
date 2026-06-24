import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import datetime

async def main():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    db = AsyncIOMotorClient(uri)['salessystem']
    
    start = datetime.datetime(2026, 5, 1)
    end = datetime.datetime(2026, 5, 31, 23, 59, 59)
    
    # Prueba 1: Sin filtro de sucursal
    count_all = await db.ventas_historicas_crudas.count_documents({"fecha_transaccion": {"$gte": start, "$lte": end}})
    print(f'Total docs en Mayo: {count_all}')
    
    # Prueba 2: Con filtro regex para Heroínas
    match = {
        "fecha_transaccion": {"$gte": start, "$lte": end},
        "sucursal": {"$regex": "hero.*nas?", "$options": "i"}
    }
    count_hero = await db.ventas_historicas_crudas.count_documents(match)
    print(f'Docs de Heroínas (regex "hero.*nas?") en Mayo: {count_hero}')
    
    # Prueba 3: Con regex aún más abierta
    match_open = {
        "fecha_transaccion": {"$gte": start, "$lte": end},
        "sucursal": {"$regex": "hero", "$options": "i"}
    }
    count_hero_open = await db.ventas_historicas_crudas.count_documents(match_open)
    print(f'Docs de Heroínas (solo "hero") en Mayo: {count_hero_open}')

asyncio.run(main())
