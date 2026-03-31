import sys
import os
import asyncio
import logging
from bson.decimal128 import Decimal128

# Asegurar importe de configuraciones
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from app.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("Decimal128-Migration")

def safely_convert(val):
    """Convierte el valor a Decimal128 ignorando si ya lo es."""
    if val is None:
        return None
    if isinstance(val, Decimal128):
        return val
    try:
        return Decimal128(str(val))
    except Exception as e:
        logger.error(f"Fallo crítico al castear el valor {val}: {e}")
        return val

async def process_document(doc, coll_name):
    """
    Toma un documento nativo de Mongo y castea selectivamente los campos conocidos.
    Modifica el diccionario en memoria. Devuelve True si ocurrieron mutaciones.
    """
    mutated = False
    
    def mutate(obj, key):
        nonlocal mutated
        if key in obj and obj[key] is not None:
            old = obj[key]
            if not isinstance(old, Decimal128):
                obj[key] = safely_convert(old)
                mutated = True
                
    if coll_name == "sales":
        mutate(doc, "total")
        if "qr_info" in doc and hasattr(doc["qr_info"], "get"):
            mutate(doc["qr_info"], "monto_transferido")
        if "descuento" in doc and hasattr(doc["descuento"], "get"):
            mutate(doc["descuento"], "valor")
        for item in doc.get("items", []):
            mutate(item, "precio_unitario")
            mutate(item, "costo_unitario")
            mutate(item, "descuento_unitario")
            mutate(item, "subtotal")
        for pago in doc.get("pagos", []):
            mutate(pago, "monto")

    elif coll_name == "caja_sesiones":
        mutate(doc, "monto_inicial")
        mutate(doc, "monto_cierre_fisico")

    elif coll_name == "caja_movimientos":
        mutate(doc, "monto")
        
    elif coll_name == "inventario":
        mutate(doc, "precio_sucursal")
        
    elif coll_name == "inventory_logs":
        mutate(doc, "costo_unitario_momento")
        mutate(doc, "precio_venta_momento")
        
    elif coll_name == "pedidos_internos":
        mutate(doc, "total_mayorista")
        for item in doc.get("items", []):
            mutate(item, "precio_mayorista")
            mutate(item, "subtotal")

    elif coll_name == "products":
        mutate(doc, "costo_producto")
        mutate(doc, "precio_venta")
        # Dict de precios_sucursales
        if "precios_sucursales" in doc and isinstance(doc["precios_sucursales"], dict):
            for k, v in doc["precios_sucursales"].items():
                if not isinstance(v, Decimal128):
                    doc["precios_sucursales"][k] = safely_convert(v)
                    mutated = True

    elif coll_name == "sale_items":
        mutate(doc, "precio_unitario")
        mutate(doc, "costo_unitario")
        mutate(doc, "descuento_unitario")
        mutate(doc, "subtotal")

    elif coll_name == "clientes":
        mutate(doc, "total_compras")

    return mutated

async def migrate():
    logger.info("Verificando URI: %s", settings.MONGODB_URL.split("@")[-1]) # Masking password
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client.salessystem
    
    collections_to_migrate = [
        "sales",
        "caja_sesiones",
        "caja_movimientos",
        "inventario",
        "inventory_logs",
        "pedidos_internos",
        "products",
        "sale_items",
        "clientes"
    ]
    
    total_mutations = 0
    
    for coll_name in collections_to_migrate:
        coll = db[coll_name]
        logger.info(f"--- Escaneando Colección: {coll_name} ---")
        cursor = coll.find({})
        
        batch_size = 500
        batch_updates = []
        doc_count = 0
        coll_mutations = 0
        
        async for doc in cursor:
            doc_count += 1
            if await process_document(doc, coll_name):
                # We need an update
                from pymongo import ReplaceOne
                batch_updates.append(ReplaceOne({"_id": doc["_id"]}, doc))
                coll_mutations += 1
                total_mutations += 1
                
            if len(batch_updates) >= batch_size:
                await coll.bulk_write(batch_updates)
                logger.info(f"[{coll_name}] Procesados: {doc_count} - Modificados en este batch: {len(batch_updates)}")
                batch_updates.clear()
        
        if batch_updates:
            await coll.bulk_write(batch_updates)
            logger.info(f"[{coll_name}] Procesados: {doc_count} - Modificados en último batch: {len(batch_updates)}")
            
        logger.info(f"[{coll_name}] Finalizado. Total Registros Vistos: {doc_count}. Total Modificados: {coll_mutations}\n")
        
    logger.info(f"¡MIGRACIÓN COMPLETADA! Total global de documentos convertidos exitosamente a Decimal128: {total_mutations}")

if __name__ == "__main__":
    confirm = input("ADVERTENCIA CRÍTICA: ¿Hiciste el MONGODUMP de respaldo antes de correr este script? (Escribe 'SI' para continuar): ")
    if confirm.strip() == "SI":
        asyncio.run(migrate())
    else:
        print("Migración abortada por seguridad.")
