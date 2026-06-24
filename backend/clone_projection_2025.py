import asyncio
import datetime
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    db = AsyncIOMotorClient(uri)['salessystem']
    
    start_2024 = datetime.datetime(2024, 1, 1, 0, 0, 0)
    end_2024 = datetime.datetime(2024, 12, 31, 23, 59, 59)
    
    # Safeguard check: Check if Calacoto or Recoleta already have 2025 comparative records
    start_2025 = datetime.datetime(2025, 1, 1, 0, 0, 0)
    end_2025 = datetime.datetime(2025, 12, 31, 23, 59, 59)
    
    exists_calacoto = await db.ventas_historicas_crudas.count_documents({
        "sucursal": "Calacoto",
        "fecha_transaccion": {"$gte": start_2025, "$lte": end_2025}
    })
    exists_recoleta = await db.ventas_historicas_crudas.count_documents({
        "sucursal": "Recoleta",
        "fecha_transaccion": {"$gte": start_2025, "$lte": end_2025}
    })
    
    if exists_calacoto > 0 or exists_recoleta > 0:
        print(f"Advertencia: Ya existen registros comparativos del 2025 para Calacoto ({exists_calacoto}) o Recoleta ({exists_recoleta}).")
        print("Cancelando proceso de clonacion para evitar duplicados.")
        return

    print("Obteniendo registros de 'Heroínas' del 2024...")
    cursor = db.ventas_historicas_crudas.find({
        "sucursal": {"$regex": "Hero[íi]nas", "$options": "i"},
        "fecha_transaccion": {"$gte": start_2024, "$lte": end_2024}
    })
    
    records = await cursor.to_list(length=None)
    total_records = len(records)
    print(f"Total registros encontrados para clonar: {total_records}")
    
    if total_records == 0:
        print("No hay registros que clonar.")
        return

    calacoto_clones = []
    recoleta_clones = []
    
    for r in records:
        # Extraer fecha
        dt = r.get("fecha_transaccion")
        if not dt:
            continue
            
        # Sumar exactamente 1 año (proyección a 2025)
        try:
            dt_2025 = dt.replace(year=2025)
        except ValueError:
            # Caso bisiesto (29 de febrero de 2024 pasa a 1 de marzo de 2025)
            dt_2025 = dt.replace(year=2025, month=3, day=1)
            
        # Clonar para Calacoto
        clone_cala = dict(r)
        if "_id" in clone_cala:
            del clone_cala["_id"] # Evitar colisión de IDs
        clone_cala["sucursal"] = "Calacoto"
        clone_cala["fecha_transaccion"] = dt_2025
        calacoto_clones.append(clone_cala)
        
        # Clonar para Recoleta
        clone_reco = dict(r)
        if "_id" in clone_reco:
            del clone_reco["_id"]
        clone_reco["sucursal"] = "Recoleta"
        clone_reco["fecha_transaccion"] = dt_2025
        recoleta_clones.append(clone_reco)

    # Inserción masiva en lotes para mayor eficiencia
    batch_size = 5000
    
    print("Insertando clones para Calacoto...")
    for i in range(0, len(calacoto_clones), batch_size):
        batch = calacoto_clones[i:i+batch_size]
        await db.ventas_historicas_crudas.insert_many(batch)
        print(f"Insertados {i + len(batch)} de {len(calacoto_clones)} registros para Calacoto.")

    print("Insertando clones para Recoleta...")
    for i in range(0, len(recoleta_clones), batch_size):
        batch = recoleta_clones[i:i+batch_size]
        await db.ventas_historicas_crudas.insert_many(batch)
        print(f"Insertados {i + len(batch)} de {len(recoleta_clones)} registros para Recoleta.")

    print("¡Proceso de clonación e inserción completado con éxito!")

asyncio.run(main())
