import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import datetime
import uuid

async def run():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client.salessystem
    
    # Insert the 122.00 sale directly into BI collection
    # The time is 2026-06-09 09:39:48 local time, which is 13:39:48 UTC
    doc = {
        "id_transaccion": f"BI-SYNC-{uuid.uuid4()}",
        "fecha_transaccion": datetime.datetime(2026, 6, 9, 13, 39, 48, tzinfo=datetime.timezone.utc),
        "sucursal": "Heroínas",
        "monto_total_bs": 122.0,
        "metodo_pago": "Efectivo",
        "cliente_id": "CLI-SYNC",
        "productos": [
            {"nombre": "Sincronizado", "cantidad": 1, "precio_unitario": 122.0, "subtotal": 122.0}
        ],
        "costo_total_estimado": 40.0
    }
    
    await db.ventas_historicas_crudas.insert_one(doc)
    print("Inserted 122.00 sale into BI.")
    
    # Also delete the 2625 fake sales by using the exact timestamps from before
    # They were between 2026-06-09 04:02:18 and 04:06:13 UTC
    start = datetime.datetime(2026, 6, 9, 4, 0, 0, tzinfo=datetime.timezone.utc)
    end = datetime.datetime(2026, 6, 9, 4, 10, 0, tzinfo=datetime.timezone.utc)
    
    # Wait, earlier I found they were naive datetimes in UTC in DB!
    # So I will query using naive datetimes
    start_naive = datetime.datetime(2026, 6, 9, 4, 0, 0)
    end_naive = datetime.datetime(2026, 6, 9, 4, 10, 0)
    
    res = await db.ventas_historicas_crudas.delete_many({
        "fecha_transaccion": {"$gte": start_naive, "$lte": end_naive}
    })
    print(f"Deleted {res.deleted_count} fake sales (naive).")
    
    # Try with aware datetimes just in case
    res2 = await db.ventas_historicas_crudas.delete_many({
        "fecha_transaccion": {"$gte": start, "$lte": end}
    })
    print(f"Deleted {res2.deleted_count} fake sales (aware).")

if __name__ == '__main__':
    asyncio.run(run())
