import asyncio
from datetime import datetime, timezone
from pymongo import MongoClient

async def main():
    url = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = MongoClient(url)
    db = client["salessystem"]
    
    sales_col = db["sales"]
    vh_col = db["ventas_historicas_crudas"]
    
    start = datetime(2026, 6, 9, 4, 0, 0, tzinfo=timezone.utc)
    sales_today = list(sales_col.find({"created_at": {"$gte": start}}))
    print(f"Sales today: {len(sales_today)}")
    
    inserted = 0
    for sale in sales_today:
        # Check if already in BI
        exists = vh_col.find_one({"original_sale_id": str(sale["_id"])})
        if not exists:
            # Insert it
            # Mapping logic from sales_service.py
            suc_name = sale.get("sucursal_name", "Heroínas") # fallback
            sid = str(sale.get("sucursal_id"))
            if sid == "69cd80098f3f6866d4cfbb64": suc_name = "Calacoto"
            elif sid == "6a1c1c1f7b8a1e2f3d4e5f6g": suc_name = "Recoleta"
            elif sid == "69cd80098f3f6866d4cfbb65": suc_name = "Heroínas"
            else: suc_name = "Heroínas" # Just a guess based on the ID if missing
            
            estado = "Anulado" if sale.get("anulada", False) else sale.get("estado_pago", "Pagado")
            
            new_records = []
            for item in sale.get("items", []):
                new_records.append({
                    "fecha_transaccion": sale["created_at"],
                    "nombre_producto": item.get("descripcion", "").upper().strip(),
                    "cantidad_vendida": float(item.get("cantidad", 1)),
                    "sucursal": suc_name,
                    "monto_total_bs": float(str(item.get("subtotal", 0))),
                    "tenant_id": sale.get("tenant_id"),
                    "original_sale_id": str(sale["_id"]),
                    "estado": estado
                })
            if new_records:
                vh_col.insert_many(new_records)
                inserted += 1
                
    print(f"Synced {inserted} missing tickets to BI table.")
    
    # Let's also update the 'estado' for all of today's records
    updated = 0
    for sale in sales_today:
        estado = "Anulado" if sale.get("anulada", False) else sale.get("estado_pago", "Pagado")
        res = vh_col.update_many(
            {"original_sale_id": str(sale["_id"])},
            {"$set": {"estado": estado}}
        )
        updated += res.modified_count
    print(f"Updated estado for {updated} items in BI table today.")

if __name__ == "__main__":
    asyncio.run(main())
