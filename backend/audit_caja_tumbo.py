import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

async def main():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    db = AsyncIOMotorClient(uri)['salessystem']
    
    start = datetime(2026, 5, 1, tzinfo=timezone.utc)
    end = datetime(2026, 5, 31, 23, 59, 59, tzinfo=timezone.utc)
    
    # Buscar producto "CAJA TUMBO CON RELLENOS"
    match = {
        "fecha_transaccion": {"$gte": start, "$lte": end},
        "nombre_producto": {"$regex": "caja tumbo con rellenos", "$options": "i"}
    }
    
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$sucursal",
            "cantidad_vendida": {"$sum": "$cantidad_vendida"},
            "ingresos": {"$sum": "$monto_total_bs"}
        }}
    ]
    
    cursor = await db.ventas_historicas_crudas.aggregate(pipeline).to_list(100)
    print("Distribucion de CAJA TUMBO en Mayo 2026:")
    for doc in cursor:
        print(f"  Sucursal: {doc['_id']} | Cantidad: {doc['cantidad_vendida']} | Ingresos: {doc['ingresos']}")

asyncio.run(main())
