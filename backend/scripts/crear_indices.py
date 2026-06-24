import asyncio
import os
import sys

# Añadir el root del proyecto al sys.path para importar app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import get_raw_db
from app.infrastructure.db import init_db

async def create_indexes():
    print("Iniciando creación de índices de rendimiento...")
    await init_db()
    db = await get_raw_db()
    
    # Índice 1: Filtrado general por fecha y estado (Para Overview)
    print("Creando índice 1: tenant_id + created_at + anulada...")
    await db.sales.create_index(
        [("tenant_id", 1), ("created_at", -1), ("anulada", 1)],
        background=True
    )
    
    # Índice 2: Filtrado geográfico y temporal (Para Regional y Mix)
    print("Creando índice 2: tenant_id + sucursal_id + created_at...")
    await db.sales.create_index(
        [("tenant_id", 1), ("sucursal_id", 1), ("created_at", -1)],
        background=True
    )
    
    # Para la tabla histórica, si la estamos usando:
    # Índice 1: Filtrado general histórico
    print("Creando índice 3: histórico (fecha_transaccion)...")
    await db.ventas_historicas_crudas.create_index(
        [("tenant_id", 1), ("fecha_transaccion", -1)],
        background=True
    )
    
    # Índice 2: Filtrado histórico por sucursal
    print("Creando índice 4: histórico (sucursal + fecha_transaccion)...")
    await db.ventas_historicas_crudas.create_index(
        [("tenant_id", 1), ("sucursal", 1), ("fecha_transaccion", -1)],
        background=True
    )

    print("¡Índices compuestos creados exitosamente en background!")

if __name__ == "__main__":
    asyncio.run(create_indexes())
