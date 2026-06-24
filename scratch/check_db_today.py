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
    
    if df.empty:
        print("DB VACIA")
        return
        
    df['fecha_transaccion'] = pd.to_datetime(df['fecha_transaccion'], errors='coerce', utc=True)
    df['fecha_local'] = df['fecha_transaccion'].dt.tz_convert('America/La_Paz')
    df['fecha_solo_local'] = df['fecha_local'].dt.date
    
    hoy_local_date = pd.Timestamp.now(tz='America/La_Paz').date()
    ayer_local_date = (pd.Timestamp.now(tz='America/La_Paz') - pd.DateOffset(days=1)).date()
    
    df_hoy = df[df['fecha_solo_local'] == hoy_local_date]
    df_ayer = df[df['fecha_solo_local'] == ayer_local_date]
    
    print(f"Hoy local: {hoy_local_date}")
    print(f"Ayer local: {ayer_local_date}")
    
    print(f"Registros totales en BD: {len(df)}")
    print(f"Registros de hoy local: {len(df_hoy)}")
    print(f"Registros de ayer local: {len(df_ayer)}")
    
    if not df_hoy.empty:
        df_hoy['monto_total_bs'] = pd.to_numeric(df_hoy['monto_total_bs'], errors='coerce').fillna(0)
        print(f"Ventas hoy: {df_hoy['monto_total_bs'].sum()}")
    else:
        print("Ventas hoy: 0.0")
        
    if not df_ayer.empty:
        df_ayer['monto_total_bs'] = pd.to_numeric(df_ayer['monto_total_bs'], errors='coerce').fillna(0)
        print(f"Ventas ayer: {df_ayer['monto_total_bs'].sum()}")

if __name__ == '__main__':
    asyncio.run(run())
