import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client.salessystem
    
    # Buscar las ultimas ventas de Ninoska que esten en PENDIENTE o PARCIAL
    cursor = db.sales.find({
        "estado_pago": {"$in": ["PENDIENTE", "PARCIAL"]},
        "cashier_name": {"$regex": "Ninoska", "$options": "i"}
    })
    ventas = await cursor.sort("created_at", -1).limit(5).to_list(length=5)
    
    for v in ventas:
        print(f"Venta ID: {str(v['_id'])[-6:].upper()} | {v['_id']}")
        print(f"  Cajero: {v.get('cashier_name')}")
        print(f"  Total: {v.get('total')}")
        print(f"  Cliente ID: {v.get('cliente_id')}")
        print(f"  Cliente snapshot: {v.get('cliente')}")
        
        # Check deuda
        deuda = await db.deudas.find_one({"sale_id": str(v['_id'])})
        if deuda:
            print(f"  -> TIENE DEUDA: {deuda['_id']} | Estado: {deuda.get('estado')}")
        else:
            print(f"  -> NO TIENE DEUDA!!! ERROR")
            
        print("-" * 30)

if __name__ == "__main__":
    asyncio.run(check())
