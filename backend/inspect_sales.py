import asyncio
import time
import pandas as pd
from datetime import datetime, timezone, timedelta
from app.infrastructure.db import init_db
from app.db import get_raw_db

async def main():
    print("Initializing DB...")
    await init_db()
    
    db = await get_raw_db()
    
    # Let's count documents in 'sales'
    count_all = await db.sales.count_documents({})
    print(f"Total documents in sales collection: {count_all}")
    
    # Let's print the most recent 10 sales from POS
    cursor = db.sales.find({"anulada": {"$ne": True}}).sort("created_at", -1).limit(20)
    sales = await cursor.to_list(length=None)
    
    print("\nRecent 20 POS Sales:")
    for s in sales:
        created_at = s.get("created_at")
        sucursal_id = s.get("sucursal_id")
        total = s.get("total")
        # Resolve sucursal name
        suc = await db.sucursales.find_one({"_id": sucursal_id}) if isinstance(sucursal_id, str) else None
        if not suc and sucursal_id:
            from bson.objectid import ObjectId
            try:
                suc = await db.sucursales.find_one({"_id": ObjectId(sucursal_id)})
            except:
                pass
        suc_name = suc.get("nombre") if suc else sucursal_id
        
        print(f"  ID: {s['_id']} | Date: {created_at} | Sucursal: {suc_name} ({sucursal_id}) | Total: {total} | Anulada: {s.get('anulada')}")

    # Let's group all non-cancelled sales by date (day) and sucursal
    print("\nPOS Sales Grouped by Date & Sucursal:")
    pipeline = [
        {"$match": {"anulada": {"$ne": True}}},
        {"$group": {
            "_id": {
                "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "sucursal_id": "$sucursal_id"
            },
            "count": {"$sum": 1},
            "total_sales": {"$sum": {"$toDouble": "$total"}}
        }},
        {"$sort": {"_id.date": -1, "_id.sucursal_id": 1}}
    ]
    grouped = await db.sales.aggregate(pipeline).to_list(length=100)
    for g in grouped:
        date = g["_id"]["date"]
        sid = g["_id"]["sucursal_id"]
        # Resolve sucursal name
        suc = None
        if sid:
            from bson.objectid import ObjectId
            try:
                suc = await db.sucursales.find_one({"_id": ObjectId(sid)})
            except:
                pass
            if not suc:
                suc = await db.sucursales.find_one({"_id": sid})
        sname = suc.get("nombre") if suc else sid
        print(f"  Date: {date} | Sucursal: {sname} ({sid}) | Count: {g['count']} | Total: Bs. {g['total_sales']:.2f}")

if __name__ == "__main__":
    asyncio.run(main())
