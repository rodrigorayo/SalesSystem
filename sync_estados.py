import asyncio
from pymongo import MongoClient

async def main():
    url = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = MongoClient(url)
    db = client["salessystem"]
    
    # 1. Update ventas_historicas_crudas to have the 'estado' field synced from 'sales'
    sales_col = db["sales"]
    vh_col = db["ventas_historicas_crudas"]
    
    sales_docs = list(sales_col.find({}))
    print(f"Total sales to sync status: {len(sales_docs)}")
    
    updates = 0
    for s in sales_docs:
        estado = "Anulado" if s.get("anulada", False) else s.get("estado_pago", "Pagado")
        res = vh_col.update_many(
            {"original_sale_id": str(s["_id"])},
            {"$set": {"estado": estado}}
        )
        updates += res.modified_count
        
    print(f"Updated {updates} records in ventas_historicas_crudas with 'estado'.")

if __name__ == "__main__":
    asyncio.run(main())
