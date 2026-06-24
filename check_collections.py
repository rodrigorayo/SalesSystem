import asyncio
from pymongo import MongoClient

async def main():
    url = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = MongoClient(url)
    db = client["salessystem"]
    print("Collections:", db.list_collection_names())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
