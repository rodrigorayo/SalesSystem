import pymongo
from datetime import datetime, timedelta

uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/?appName=Cluster0"

def main():
    try:
        client = pymongo.MongoClient(uri)
        db = client.salessystem
        collection = db.ventas_historicas_crudas

        # 1. Limpieza de corridas anteriores de este script
        print("Eliminando clonaciones anteriores para evitar duplicados...")
        delete_result = collection.delete_many({"cloned_from": "Heroínas_2024"})
        print(f"Registros clonados anteriores eliminados: {delete_result.deleted_count}")

        # 2. Consultar registros de Heroínas del 2024
        start_2024 = datetime(2024, 1, 1, 0, 0, 0)
        end_2024 = datetime(2024, 12, 31, 23, 59, 59)
        
        query = {
            "sucursal": "Heroínas",
            "fecha_transaccion": {"$gte": start_2024, "$lte": end_2024}
        }
        
        print("Consultando registros de Heroínas del 2024...")
        cursor = collection.find(query)
        
        calacoto_batch = []
        recoleta_batch = []
        
        for doc in cursor:
            # 3. Clonar y procesar para Calacoto
            calacoto_doc = doc.copy()
            calacoto_doc.pop("_id", None)
            calacoto_doc["sucursal"] = "Calacoto"
            calacoto_doc["fecha_transaccion"] = doc["fecha_transaccion"] + timedelta(days=364)
            calacoto_doc["is_cloned"] = True
            calacoto_doc["cloned_from"] = "Heroínas_2024"
            calacoto_batch.append(calacoto_doc)
            
            # 4. Clonar y procesar para Recoleta
            recoleta_doc = doc.copy()
            recoleta_doc.pop("_id", None)
            recoleta_doc["sucursal"] = "Recoleta"
            recoleta_doc["fecha_transaccion"] = doc["fecha_transaccion"] + timedelta(days=364)
            recoleta_doc["is_cloned"] = True
            recoleta_doc["cloned_from"] = "Heroínas_2024"
            recoleta_batch.append(recoleta_doc)

        print(f"Total registros listos para insertar en Calacoto (2025): {len(calacoto_batch)}")
        print(f"Total registros listos para insertar en Recoleta (2025): {len(recoleta_batch)}")

        # 5. Inserción masiva en lotes
        batch_size = 5000
        
        if calacoto_batch:
            print("Insertando registros de Calacoto en lotes...")
            for i in range(0, len(calacoto_batch), batch_size):
                chunk = calacoto_batch[i:i + batch_size]
                collection.insert_many(chunk)
            print("¡Calacoto completado!")
            
        if recoleta_batch:
            print("Insertando registros de Recoleta en lotes...")
            for i in range(0, len(recoleta_batch), batch_size):
                chunk = recoleta_batch[i:i + batch_size]
                collection.insert_many(chunk)
            print("¡Recoleta completado!")

        print("\n--- RESUMEN DE EJECUCIÓN ---")
        print(f" - Registros insertados para Calacoto: {len(calacoto_batch)}")
        print(f" - Registros insertados para Recoleta: {len(recoleta_batch)}")
        print(f" - Total general insertado: {len(calacoto_batch) + len(recoleta_batch)}")
        
    except Exception as e:
        print(f"Error durante el proceso: {e}")

if __name__ == "__main__":
    main()
