import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client.salessystem
    
    # We will just find all docs containing "2026-06-09T04:0"
    # and delete them
    regex = "^2026-06-09T04:0"
    result = await db.ventas_historicas_crudas.delete_many({
        "fecha_transaccion": {"$regex": regex}
    })
    
    print(f"Deleted {result.deleted_count} fake sales from midnight (using string regex).")

if __name__ == '__main__':
    asyncio.run(run())
