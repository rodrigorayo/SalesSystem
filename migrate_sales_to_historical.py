import pymongo
from bson import ObjectId
from datetime import datetime

uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/?appName=Cluster0"

def map_sucursal(sid, sucursal_map):
    # Obtener el nombre correspondiente al sucursal_id
    name = sucursal_map.get(str(sid), str(sid))
    name_lower = name.lower()
    
    if 'heroinas' in name_lower or 'heroína' in name_lower or 'hero' in name_lower:
        return 'Heroínas'
    if 'recoleta' in name_lower:
        return 'Recoleta'
    if 'calacoto' in name_lower:
        return 'Calacoto'
        
    return name

async def main():
    # Nota: Este script usa pymongo síncrono para facilitar su ejecución directa
    pass

if __name__ == "__main__":
    try:
        client = pymongo.MongoClient(uri)
        db = client.salessystem
        
        # 1. Cargar las sucursales para el mapeo
        sucursales = {str(s["_id"]): s["nombre"] for s in db.sucursales.find()}
        print(f"Cargadas {len(sucursales)} sucursales de la base de datos para mapeo.")

        # 2. Encontrar qué IDs de ventas ya están migrados
        migrated_ids = set()
        existing_migrated = db.ventas_historicas_crudas.find(
            {"original_sale_id": {"$exists": True}}, 
            {"original_sale_id": 1}
        )
        for doc in existing_migrated:
            migrated_ids.add(doc["original_sale_id"])
        print(f"Ventas ya migradas previamente: {len(migrated_ids)}")

        # 3. Consultar las ventas válidas (no anuladas) en la colección sales
        sales_cursor = db.sales.find({"anulada": {"$ne": True}})
        
        new_records = []
        sales_processed = 0
        
        for sale in sales_cursor:
            sale_id = sale["_id"]
            
            # Evitar duplicados
            if sale_id in migrated_ids:
                continue
                
            sucursal_id = sale.get("sucursal_id", "DESCONOCIDA")
            sucursal_name = map_sucursal(sucursal_id, sucursales)
            
            # Solo migrar las tres sucursales requeridas para analítica
            if sucursal_name not in ['Heroínas', 'Recoleta', 'Calacoto']:
                continue
                
            fecha = sale.get("created_at") or sale.get("fecha")
            if not fecha:
                continue
                
            # Cada ítem en la venta se convierte en una fila en ventas_historicas_crudas
            items = sale.get("items", [])
            for item in items:
                # Extraer subtotal asegurando que sea numérico
                subtotal = item.get("subtotal", 0.0)
                try:
                    subtotal = float(str(subtotal))
                except ValueError:
                    subtotal = 0.0
                    
                cantidad = item.get("cantidad", 1)
                try:
                    cantidad = float(str(cantidad))
                except ValueError:
                    cantidad = 1.0
                    
                record = {
                    "fecha_transaccion": fecha,
                    "nombre_producto": item.get("descripcion", "PRODUCTO DESCONOCIDO").upper().strip(),
                    "cantidad_vendida": cantidad,
                    "sucursal": sucursal_name,
                    "monto_total_bs": subtotal,
                    "tenant_id": sale.get("tenant_id"),
                    "original_sale_id": sale_id
                }
                new_records.append(record)
                
            sales_processed += 1

        print(f"Ventas nuevas listas para procesar: {sales_processed}")
        print(f"Total de registros de ítems a insertar: {len(new_records)}")

        # 4. Inserción masiva en ventas_historicas_crudas
        if new_records:
            result = db.ventas_historicas_crudas.insert_many(new_records)
            print(f"¡Éxito! Se insertaron {len(result.inserted_ids)} registros de ventas en ventas_historicas_crudas.")
        else:
            print("No hay nuevas ventas válidas para migrar.")
            
    except Exception as e:
        print(f"Error durante la migración: {e}")
