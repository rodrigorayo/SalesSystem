import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['salessystem']
    doc = await db.ventas_historicas_crudas.find_one()
    print("Documento Histórico:")
    if doc:
        for k, v in doc.items():
            print(f"{k}: {type(v)}")
    else:
        print("No documents found in ventas_historicas_crudas!")

asyncio.run(main())
