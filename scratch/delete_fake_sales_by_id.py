import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import datetime

async def run():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client.salessystem
    
    # We will delete ALL records from 2026-06-09
    docs = await db.ventas_historicas_crudas.find({}).to_list(length=None)
    ids_to_delete = []
    
    for d in docs:
        if isinstance(d.get('fecha_transaccion'), datetime.datetime):
            # MongoDB returns naive datetime in UTC if it was stored as ISODate
            # so we just check if it's 2026-06-09
            if d['fecha_transaccion'].year == 2026 and d['fecha_transaccion'].month == 6 and d['fecha_transaccion'].day == 9:
                ids_to_delete.append(d['_id'])
                
    if ids_to_delete:
        result = await db.ventas_historicas_crudas.delete_many({"_id": {"$in": ids_to_delete}})
        print(f"Deleted {result.deleted_count} fake sales from 2026-06-09.")
    else:
        print("No fake sales found for 2026-06-09.")

if __name__ == '__main__':
    asyncio.run(run())
