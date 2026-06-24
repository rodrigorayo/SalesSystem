import asyncio
from pymongo import MongoClient
import json

async def main():
    url = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = MongoClient(url)
    db = client["salessystem"]
    col = db["sales"]
    doc = col.find_one({}, sort=[("created_at", -1)])
    if doc:
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc: doc["created_at"] = str(doc["created_at"])
        if "anulada_at" in doc: doc["anulada_at"] = str(doc["anulada_at"])
        print(json.dumps(doc, indent=2, default=str))

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
