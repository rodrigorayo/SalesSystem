import asyncio
from datetime import datetime, timezone
from pymongo import MongoClient

async def main():
    url = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = MongoClient(url)
    db = client["salessystem"]
    col = db["sales"]
    
    start = datetime(2026, 6, 9, 4, 0, 0, tzinfo=timezone.utc)
    end = datetime(2026, 6, 10, 4, 0, 0, tzinfo=timezone.utc)
    docs = list(col.find({"created_at": {"$gte": start, "$lt": end}}))
    print(f"Docs in sales for June 9: {len(docs)}")
    
    sum_monto = 0
    anulados = 0
    for d in docs:
        st = str(d.get("estado_pago", "")).lower()
        if d.get("anulada", False) or "anul" in st:
            anulados += 1
            continue
            
        m = d.get("total", 0)
        try:
            sum_monto += float(str(m))
        except Exception as e:
            print("Error parsing:", m)
    print(f"Sum of total: {sum_monto}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
