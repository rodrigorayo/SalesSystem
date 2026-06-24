import asyncio
from datetime import datetime
from pymongo import MongoClient

async def main():
    url = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = MongoClient(url)
    db = client["salessystem"]

    print(f"Using DB: {db.name}")
    col = db["ventas_historicas_crudas"]
    print(f"Total docs: {col.count_documents({})}")
    
    # Check fields of the latest document
    latest = col.find_one({}, sort=[("fecha_transaccion", -1)])
    if latest:
        print(f"Latest doc keys: {latest.keys()}")
        for k in latest.keys():
            if "estado" in k.lower():
                print(f"{k}: {latest[k]}")
        
        print("\nSample of statuses in DB for the last 100 tickets:")
        statuses = set()
        for d in col.find({}, sort=[("fecha_transaccion", -1)]).limit(100):
            for k in d.keys():
                if "estado" in k.lower():
                    statuses.add(f"{k} = {d[k]}")
        print(statuses)
        
    start = datetime(2026, 6, 9, 4, 0, 0)
    end = datetime(2026, 6, 10, 4, 0, 0)
    docs = list(col.find({"fecha_transaccion": {"$gte": start, "$lt": end}}))
    print(f"\nDocs for June 9 (04:00 UTC - next day 04:00 UTC): {len(docs)}")
    
    sum_monto = 0
    anulados = 0
    for d in docs:
        is_anulado = False
        for k in d.keys():
            if "estado" in k.lower() and "anul" in str(d[k]).lower():
                is_anulado = True
        
        if is_anulado:
            anulados += 1
            continue
            
        m = d.get("monto_total_bs", 0)
        try:
            sum_monto += float(m)
        except:
            pass
    print(f"Sum of monto_total_bs (excluding 'anul'): {sum_monto}")
    print(f"Anulados skipped: {anulados}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
