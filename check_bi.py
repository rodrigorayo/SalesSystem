import asyncio
from datetime import datetime, timezone
from pymongo import MongoClient

async def main():
    url = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = MongoClient(url)
    db = client["salessystem"]
    vh_col = db["ventas_historicas_crudas"]
    
    start = datetime(2026, 6, 9, 4, 0, 0, tzinfo=timezone.utc)
    docs = list(vh_col.find({"fecha_transaccion": {"$gte": start}}))
    print(f"Docs in BI today: {len(docs)}")
    
    sum_monto = 0
    anulados = 0
    for d in docs:
        estado = str(d.get("estado", "")).lower()
        if "anul" in estado:
            anulados += 1
            continue
        m = d.get("monto_total_bs", 0)
        sum_monto += float(str(m))
        
    print(f"Total BI monto today (no anulados): {sum_monto}")

if __name__ == "__main__":
    asyncio.run(main())
