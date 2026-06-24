import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['salessystem']
    
    # Check all records from June 2026
    start_date = datetime(2026, 6, 1)
    count = await db.sales.count_documents({"created_at": {"$gte": start_date}})
    print(f"Total ventas en Junio: {count}")
    
    # Fetch recent sales
    recent = await db.sales.find({"created_at": {"$gte": start_date}}).to_list(10)
    for r in recent:
        print(r['created_at'], r.get('total'), r.get('sucursal_id'))
        
    print("Total ventas en ventas_historicas_crudas para hoy:")
    h_count = await db.ventas_historicas_crudas.count_documents({"fecha_transaccion": {"$gte": start_date}})
    print(h_count)

asyncio.run(main())
