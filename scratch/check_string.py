import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client.salessystem
    
    docs = await db.ventas_historicas_crudas.find({"monto_total_bs": 118.0}).to_list(length=5)
    for d in docs:
        print(d['fecha_transaccion'], type(d['fecha_transaccion']))

if __name__ == '__main__':
    asyncio.run(run())
