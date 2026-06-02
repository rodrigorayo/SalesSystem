import pymongo
import sys

uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/SalesSystem_Staging?appName=Cluster0"

try:
    client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=5000)
    db = client.get_default_database()
    
    print(f"Conectado a la BD: {db.name}")
    collections = db.list_collection_names()
    print("Colecciones encontradas:")
    
    for coll in collections:
        count = db[coll].count_documents({})
        print(f" - {coll}: {count} documentos")
        
    if "ventas_historicas_crudas" in collections:
        sucursales = db["ventas_historicas_crudas"].distinct("sucursal")
        print(f"\nSucursales únicas en ventas_historicas_crudas: {sucursales}")
        
    if "sales" in collections:
        sucursales_sales = db["sales"].distinct("sucursal_id")
        print(f"\nSucursales únicas (IDs) en sales: {sucursales_sales}")

    if "sucursales" in collections:
        docs = db["sucursales"].find({}, {"nombre": 1})
        print(f"\nColección 'sucursales':")
        for d in docs:
            print(" - ", d.get("nombre"))

except Exception as e:
    print(f"Error conectando a MongoDB: {e}")
