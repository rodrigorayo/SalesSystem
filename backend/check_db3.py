import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['salessystem']
    recent = await db.sales.find().sort("created_at", -1).limit(5).to_list(5)
    print("ÚLTIMAS 5 VENTAS REGISTRADAS EN DB:")
    for r in recent:
        print(f"Fecha: {r.get('created_at')}, Total: {r.get('total')}, Sucursal: {r.get('sucursal_id')}")

asyncio.run(main())
