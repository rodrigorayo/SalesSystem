import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import pandas as pd
from datetime import datetime

async def run():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client.salessystem
    
    docs = await db.ventas_historicas_crudas.find({}, {"fecha_transaccion":1, "monto_total_bs":1, "sucursal": 1}).to_list(length=None)
    df = pd.DataFrame(docs)
        
    df['fecha_transaccion'] = pd.to_datetime(df['fecha_transaccion'], errors='coerce', utc=True)
    df['fecha_local'] = df['fecha_transaccion'].dt.tz_convert('America/La_Paz')
    df['fecha_solo_local'] = df['fecha_local'].dt.date
    
    hoy_local_date = pd.Timestamp.now(tz='America/La_Paz').date()
    df_hoy = df[df['fecha_solo_local'] == hoy_local_date]
    
    print("Registros de HOY (los primeros 10):")
    for _, row in df_hoy.head(10).iterrows():
        print(f"{row['fecha_local']} | Sucursal: {row['sucursal']} | Monto: {row['monto_total_bs']}")
        
    print(f"\nTotal exacto en BD hoy: {df_hoy['monto_total_bs'].sum()}")

if __name__ == '__main__':
    asyncio.run(run())
