"""
Diagnóstico rápido de índices y tamaño de colecciones.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

URI = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"

async def main():
    client = AsyncIOMotorClient(URI)
    db = client['salessystem']

    cols = ['ventas_historicas_crudas', 'sales']
    for col in cols:
        count = await db[col].count_documents({})
        print(f"\n=== {col} ({count:,} docs) ===")
        info = await db.command("collStats", col)
        print(f"  Size on disk: {info.get('storageSize', 0)/1024/1024:.1f} MB")
        idx = await db[col].index_information()
        print(f"  Indexes ({len(idx)}):")
        for name, spec in idx.items():
            print(f"    [{name}]: {spec['key']}")

asyncio.run(main())
