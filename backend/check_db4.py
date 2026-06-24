import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['salessystem']
    res = await db.ventas_historicas_crudas.distinct('sucursal')
    print('Sucursales en historial:', res)
    res2 = await db.sales.distinct('sucursal_id')
    print('Sucursales en POS:', res2)

asyncio.run(main())
