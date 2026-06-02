import pymongo

uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/?appName=Cluster0"

try:
    client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=5000)
    databases = client.list_database_names()
    print("Bases de datos en el cluster:")
    
    for db_name in databases:
        if db_name in ["admin", "local", "config"]:
            continue
        print(f"\n--- Base de datos: {db_name} ---")
        db = client[db_name]
        colls = db.list_collection_names()
        for c in colls:
            count = db[c].count_documents({})
            print(f" - {c}: {count} documentos")

except Exception as e:
    print(f"Error: {e}")
