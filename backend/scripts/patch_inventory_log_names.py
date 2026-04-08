import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.infrastructure.db import init_db
from app.domain.models.inventario import InventoryLog
from app.domain.models.product import Product

async def patch_inventory_logs():
    print("Iniciando conexión a base de datos...")
    await init_db()
    
    # Buscar registros que no tengan "descripcion" o esté vacío
    # En Beanie podemos usar raw mongos
    query = {"$or": [{"descripcion": {"$exists": False}}, {"descripcion": ""}, {"descripcion": None}]}
    logs_to_patch = await InventoryLog.find(query).to_list()
    
    print(f"Se encontraron {len(logs_to_patch)} registros en el kárdex sin descripcion oficial.")
    
    if not logs_to_patch:
        print("Kárdex ya se encuentra sincronizado al 100%. Saliendo...")
        return
        
    updated_count = 0
    product_names = {}
    
    for log in logs_to_patch:
        prod_id = log.producto_id
        if not prod_id:
            continue
            
        nombre_producto = product_names.get(prod_id)
        if not nombre_producto:
            producto = await Product.get(prod_id)
            nombre_producto = producto.descripcion if producto else "Producto Eliminado"
            product_names[prod_id] = nombre_producto
            
        log.descripcion = nombre_producto
        await log.save()
        updated_count += 1
        
        if updated_count % 100 == 0:
            print(f"Procesados {updated_count}/{len(logs_to_patch)} registros...")
            
    print(f"Éxito: Se han corregido {updated_count} registros de inventario en la base de datos.")

if __name__ == "__main__":
    asyncio.run(patch_inventory_logs())

