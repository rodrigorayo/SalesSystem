import asyncio
from pymongo import MongoClient

async def main():
    url = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = MongoClient(url)
    db = client["salessystem"]
    
    print("Collections:", db.list_collection_names())
    
    prod = db.products.find_one({})
    if prod:
        print("\nProduct sample:")
        for k, v in prod.items():
            print(f"  {k}: {v}")
            
    sale = db.sales.find_one({"items": {"$exists": True, "$ne": []}})
    if sale:
        print("\nSale item sample:")
        for k, v in sale["items"][0].items():
            print(f"  {k}: {v}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
