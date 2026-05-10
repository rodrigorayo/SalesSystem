import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from decimal import Decimal

async def run():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.taboada_db
    
    # 1. Get all logs for FEXCO
    # We don't have the exact sucursal_id, but we can find it
    sucursal = await db.sucursales.find_one({"nombre": "FEXCO"})
    if not sucursal:
        print("Sucursal FEXCO not found")
        return
        
    sucursal_id = str(sucursal["_id"])
    
    # Check total incomes and outcomes
    pipeline_movs = [
        {"$match": {"sucursal_id": sucursal_id}},
        {
            "$group": {
                "_id": None,
                "total_incomes": {
                    "$sum": {
                        "$cond": [{"$gt": ["$cantidad_movida", 0]}, {"$multiply": ["$cantidad_movida", {"$toDouble": "$costo_unitario_momento"}]}, 0]
                    }
                },
                "total_outcomes": {
                    "$sum": {
                        "$cond": [{"$lt": ["$cantidad_movida", 0]}, {"$multiply": ["$cantidad_movida", {"$toDouble": "$costo_unitario_momento"}]}, 0]
                    }
                }
            }
        }
    ]
    movs = await db.inventory_logs.aggregate(pipeline_movs).to_list(1)
    
    pipeline_final = [
        {"$match": {"sucursal_id": sucursal_id}},
        {"$sort": {"created_at": -1}},
        {
            "$group": {
                "_id": "$producto_id",
                "last_log": {"$first": "$$ROOT"}
            }
        },
        {"$match": {"last_log.stock_resultante": {"$gt": 0}}},
        {
            "$group": {
                "_id": None,
                "inventario_final": {
                    "$sum": {"$multiply": ["$last_log.stock_resultante", {"$toDouble": "$last_log.costo_unitario_momento"}]}
                }
            }
        }
    ]
    final = await db.inventory_logs.aggregate(pipeline_final).to_list(1)
    
    print("Movimientos:", movs)
    print("Final:", final)
    if movs and final:
        neto_movimientos = movs[0]["total_incomes"] + movs[0]["total_outcomes"]
        inventario_final = final[0]["inventario_final"]
        print(f"Neto Movimientos (Flujo Histórico): {neto_movimientos}")
        print(f"Inventario Final (Stock x Último Costo): {inventario_final}")
        print(f"Diferencia (Revaluación): {inventario_final - neto_movimientos}")
        
    # Check if there are any logs BEFORE 2026-03-23
    import datetime
    dt = datetime.datetime(2026, 3, 23)
    old_logs = await db.inventory_logs.count_documents({"sucursal_id": sucursal_id, "created_at": {"$lt": dt}})
    print(f"Logs before 2026-03-23: {old_logs}")

if __name__ == "__main__":
    asyncio.run(run())
