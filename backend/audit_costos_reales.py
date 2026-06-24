import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    db = AsyncIOMotorClient(uri)['salessystem']
    
    # 1. Ver una venta real con items para inspeccionar campos
    sale = await db.sales.find_one({"anulada": {"$ne": True}}, sort=[("created_at", -1)])
    if sale:
        print("=== VENTA RECIENTE ===")
        print(f"  sucursal_id: {sale.get('sucursal_id')}")
        print(f"  total: {sale.get('total')}")
        print(f"  created_at: {sale.get('created_at')}")
        items = sale.get("items", [])
        print(f"  N° items: {len(items)}")
        for i, item in enumerate(items[:3]):
            print(f"  Item {i+1}:")
            for k, v in item.items():
                print(f"    {k}: {v}")
    
    # 2. Cuántas ventas tienen costo_unitario > 0
    count_con_costo = await db.sales.count_documents({
        "anulada": {"$ne": True},
        "items.costo_unitario": {"$gt": 0}
    })
    count_total = await db.sales.count_documents({"anulada": {"$ne": True}})
    print(f"\n=== COSTOS ===")
    print(f"  Ventas con costo_unitario > 0: {count_con_costo} / {count_total}")
    
    # 3. Ver productos con su costo actual
    print("\n=== PRODUCTOS (muestra) ===")
    async for p in db.products.find({}, {"descripcion": 1, "costo_producto": 1, "precio_venta": 1}).limit(5):
        print(f"  {p.get('descripcion')} | costo: {p.get('costo_producto')} | pventa: {p.get('precio_venta')}")
    
    # 4. Ver inventario muestra
    print("\n=== INVENTARIO (muestra) ===")
    async for inv in db.inventario.find({}, {"producto_id": 1, "sucursal_id": 1, "cantidad": 1, "precio_sucursal": 1}).limit(5):
        print(f"  prod: {inv.get('producto_id')} | suc: {inv.get('sucursal_id')} | stock: {inv.get('cantidad')} | precio_suc: {inv.get('precio_sucursal')}")

asyncio.run(main())
