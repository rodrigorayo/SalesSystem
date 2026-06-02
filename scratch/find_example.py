import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.infrastructure.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient
from decimal import Decimal

async def run():
    print(f"Conectando a MongoDB...")
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    # The database name might be in the URL or default to 'salessystem'
    db = client.get_database("salessystem")
    
    # 1. Buscar la sucursal FEXCO
    sucursal = await db.sucursales.find_one({"nombre": "FEXCO"})
    if not sucursal:
        print("No se encontró la sucursal FEXCO")
        return
    sucursal_id = str(sucursal["_id"])
    tenant_id = sucursal["tenant_id"]

    print(f"Sucursal FEXCO ID: {sucursal_id}")

    # 2. Buscar productos en el Kárdex de FEXCO que tengan costos distintos en sus logs
    # O mejor, productos con historial de costos
    print("Buscando productos con cambios de costo en FEXCO...")
    
    pipeline = [
        {"$match": {"sucursal_id": sucursal_id}},
        {
            "$group": {
                "_id": "$producto_id",
                "nombre": {"$first": "$descripcion"},
                "costos": {"$addToSet": "$costo_unitario_momento"},
                "primer_log": {"$min": "$created_at"},
                "ultimo_log": {"$max": "$created_at"}
            }
        },
        # Filtrar los que tengan más de un costo registrado en sus movimientos
        {"$project": {
            "nombre": 1,
            "num_costos": {"$size": "$costos"},
            "costos": 1,
            "primer_log": 1,
            "ultimo_log": 1
        }},
        {"$match": {"num_costos": {"$gt": 1}}},
        {"$limit": 5}
    ]
    
    examples = await db.inventory_logs.aggregate(pipeline).to_list(5)
    
    if not examples:
        print("No se encontraron ejemplos automáticos en el Kárdex.")
        print("Buscando en la tabla de historial de costos general...")
        history = await db.product_cost_history.find({"tenant_id": tenant_id}).sort("created_at", -1).to_list(5)
        for h in history:
            print(f"Producto: {h['descripcion']}")
            print(f"  Costo anterior: {h['costo_anterior']} -> Nuevo: {h['costo_nuevo']}")
            print(f"  Fecha: {h['created_at']}")
    else:
        print("\n=== EJEMPLOS REALES DE REVALORIZACIÓN EN FEXCO ===")
        for ex in examples:
            print(f"Producto: {ex['nombre']}")
            print(f"  Costos registrados en Kárdex: {ex['costos']}")
            print(f"  Desde: {ex['primer_log']} Hasta: {ex['ultimo_log']}")
            print("-" * 30)

if __name__ == "__main__":
    asyncio.run(run())
