import asyncio
from datetime import datetime, timezone
from pymongo import MongoClient

async def main():
    url = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = MongoClient(url)
    db = client["salessystem"]
    vh_col = db["ventas_historicas_crudas"]
    sales_col = db["sales"]
    
    start = datetime(2026, 6, 9, 4, 0, 0, tzinfo=timezone.utc)
    
    # 1. Delete all BI records from today
    res = vh_col.delete_many({"fecha_transaccion": {"$gte": start}})
    print(f"Deleted {res.deleted_count} records from BI table for today.")
    
    # 2. Fetch all sales from today
    sales_today = list(sales_col.find({"created_at": {"$gte": start}}))
    print(f"Found {len(sales_today)} sales for today.")
    
    # 3. Re-insert them cleanly
    inserted = 0
    new_records = []
    for sale in sales_today:
        suc_name = sale.get("sucursal_name", "Heroínas") # fallback
        sid = str(sale.get("sucursal_id"))
        if sid == "69cd80098f3f6866d4cfbb64": suc_name = "Calacoto"
        elif sid == "6a1c1c1f7b8a1e2f3d4e5f6g": suc_name = "Recoleta"
        elif sid == "69cd80098f3f6866d4cfbb65": suc_name = "Heroínas"
        
        estado = "Anulado" if sale.get("anulada", False) else sale.get("estado_pago", "Pagado")
        
        for item in sale.get("items", []):
            new_records.append({
                "fecha_transaccion": sale["created_at"],
                "nombre_producto": item.get("descripcion", "").upper().strip(),
                "cantidad_vendida": float(item.get("cantidad", 1)),
                "sucursal": suc_name,
                "monto_total_bs": float(str(item.get("subtotal", 0))),
                "tenant_id": sale.get("tenant_id"),
                "original_sale_id": sale["_id"],
                "estado": estado
            })
            
    if new_records:
        vh_col.insert_many(new_records)
        print(f"Inserted {len(new_records)} fresh BI items for today.")

if __name__ == "__main__":
    asyncio.run(main())
