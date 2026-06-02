import pymongo

uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/?appName=Cluster0"

try:
    client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=5000)
    db = client.get_database("salessystem")
    
    print("Conectado a la BD: salessystem")
    
    sucursales = db["ventas_historicas_crudas"].distinct("sucursal")
    print(f"\nSucursales únicas en ventas_historicas_crudas: {sucursales}")
    
    sucursales_doc = db["sucursales"].find({}, {"nombre": 1})
    print("\nNombres en colección 'sucursales':")
    for s in sucursales_doc:
        print(s.get("nombre", "Sin nombre"))
        
except Exception as e:
    print(f"Error: {e}")
