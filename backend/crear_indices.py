"""
Crea índices optimizados en ventas_historicas_crudas para acelerar
los queries de analytics de 4-5 minutos a menos de 5 segundos.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, TEXT

URI = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"

async def main():
    client = AsyncIOMotorClient(URI)
    db = client['salessystem']
    col = db.ventas_historicas_crudas

    print("Creando índices optimizados en ventas_historicas_crudas...")

    # 1. Índice compuesto principal: fecha + sucursal (cubre 90% de los queries)
    try:
        r = await col.create_index(
            [("fecha_transaccion", DESCENDING), ("sucursal", ASCENDING)],
            name="fecha_sucursal_opt",
            background=True
        )
        print(f"  ✅ fecha_sucursal_opt: {r}")
    except Exception as e:
        print(f"  ⚠️  fecha_sucursal_opt: {e}")

    # 2. Índice solo de fecha descendente para queries sin filtro de sucursal
    try:
        r = await col.create_index(
            [("fecha_transaccion", ASCENDING)],
            name="fecha_asc_opt",
            background=True
        )
        print(f"  ✅ fecha_asc_opt: {r}")
    except Exception as e:
        print(f"  ⚠️  fecha_asc_opt: {e}")

    # 3. Índice de texto en sucursal para regex queries
    try:
        # Primero verificamos si existe un text index
        existing = await col.index_information()
        has_text = any('text' in str(v.get('key')) for v in existing.values())
        if not has_text:
            r = await col.create_index(
                [("sucursal", TEXT)],
                name="sucursal_text",
                background=True
            )
            print(f"  ✅ sucursal_text: {r}")
        else:
            print(f"  ℹ️  sucursal_text: ya existe un text index")
    except Exception as e:
        print(f"  ⚠️  sucursal_text: {e}")

    # 4. Índice en nombre_producto para queries de rentabilidad
    try:
        r = await col.create_index(
            [("nombre_producto", ASCENDING), ("fecha_transaccion", DESCENDING)],
            name="producto_fecha_opt",
            background=True
        )
        print(f"  ✅ producto_fecha_opt: {r}")
    except Exception as e:
        print(f"  ⚠️  producto_fecha_opt: {e}")

    print("\nVerificando índices finales:")
    idx = await col.index_information()
    for name, spec in idx.items():
        print(f"  [{name}]: {spec['key']}")

asyncio.run(main())
