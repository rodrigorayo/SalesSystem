import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import datetime
from bson import ObjectId

async def run():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client.salessystem
    
    # Encontramos los registros de hoy generados a las 00:02 AM y los eliminamos
    # June 9, 2026, 04:00:00 UTC is midnight local La Paz
    start = datetime.datetime(2026, 6, 9, 4, 0, 0, tzinfo=datetime.timezone.utc)
    end = datetime.datetime(2026, 6, 9, 5, 0, 0, tzinfo=datetime.timezone.utc)
    
    result = await db.ventas_historicas_crudas.delete_many({
        "fecha_transaccion": {"$gte": start, "$lte": end}
    })
    
    print(f"Deleted {result.deleted_count} fake sales from midnight.")

if __name__ == '__main__':
    asyncio.run(run())
