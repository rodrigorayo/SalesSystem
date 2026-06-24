import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

async def main():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    db = AsyncIOMotorClient(uri)['salessystem']
    
    start = datetime(2026, 4, 1, tzinfo=timezone.utc)
    end = datetime(2026, 4, 30, 23, 59, 59, tzinfo=timezone.utc)
    
    match_hist = {
        "fecha_transaccion": {"$gte": start, "$lte": end},
        "sucursal": {"$regex": "hero.*nas?", "$options": "i"}
    }
    
    pipeline = [
        {"$match": match_hist},
        {
            "$group": {
                "_id": "$nombre_producto",
                "nombre": {"$first": "$nombre_producto"},
                "ingresos": {"$sum": "$monto_total_bs"}
            }
        }
    ]
    
    cursor_hist = await db.ventas_historicas_crudas.aggregate(pipeline).to_list(2000)
    print(f"Productos agrupados en historial (Heroinas/ABRIL): {len(cursor_hist)}")

asyncio.run(main())
