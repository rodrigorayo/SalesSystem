import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

async def main():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    db = AsyncIOMotorClient(uri)['salessystem']
    
    start = datetime(2026, 5, 1, tzinfo=timezone.utc)
    end = datetime(2026, 5, 31, 23, 59, 59, tzinfo=timezone.utc)
    
    # Simular la lógica de bcg_service.py para Heroinas
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
    print(f"Productos agrupados en historial (Heroinas/Mayo): {len(cursor_hist)}")
    
    match_pos = {
        "anulada": {"$ne": True},
        "created_at": {"$gte": start, "$lte": end},
        "sucursal_id": {"$regex": "hero.*nas?", "$options": "i"}
    }
    
    pipeline_pos = [
        {"$match": match_pos},
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": "$items.descripcion",
                "nombre": {"$first": "$items.descripcion"},
                "ingresos": {"$sum": {"$toDouble": "$items.subtotal"}}
            }
        }
    ]
    
    try:
        cursor_pos = await db.sales.aggregate(pipeline_pos).to_list(2000)
        print(f"Productos agrupados en POS (Heroinas/Mayo): {len(cursor_pos)}")
    except Exception as e:
        print(f"ERROR EN POS: {e}")

asyncio.run(main())
