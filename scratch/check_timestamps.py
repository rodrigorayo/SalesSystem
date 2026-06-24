import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import pandas as pd

async def run():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client.salessystem
    
    docs = await db.ventas_historicas_crudas.find({}, {"fecha_transaccion":1, "monto_total_bs":1}).to_list(length=None)
    df = pd.DataFrame(docs)
    df['fecha_transaccion'] = pd.to_datetime(df['fecha_transaccion'], errors='coerce', utc=True)
    df['fecha_local'] = df['fecha_transaccion'].dt.tz_convert('America/La_Paz')
    
    # Let's find the sum for June 8 and June 9
    df_june8 = df[df['fecha_local'].dt.date == pd.to_datetime('2026-06-08').date()]
    df_june9 = df[df['fecha_local'].dt.date == pd.to_datetime('2026-06-09').date()]
    
    print(f"Total June 8: {df_june8['monto_total_bs'].sum()}")
    print(f"Total June 9: {df_june9['monto_total_bs'].sum()}")
    
    if not df_june9.empty:
        print("\nFirst 5 records of June 9:")
        print(df_june9[['fecha_local', 'monto_total_bs']].head())
        print("\nLast 5 records of June 9:")
        print(df_june9[['fecha_local', 'monto_total_bs']].tail())
        
    pos_sales = await db.sales.find({}).to_list(length=None)
    df_pos = pd.DataFrame(pos_sales)
    if not df_pos.empty:
        df_pos['created_at'] = pd.to_datetime(df_pos['created_at'], errors='coerce', utc=True)
        df_pos['fecha_local'] = df_pos['created_at'].dt.tz_convert('America/La_Paz')
        df_pos_june9 = df_pos[df_pos['fecha_local'].dt.date == pd.to_datetime('2026-06-09').date()]
        print(f"\nPOS Sales June 9: {df_pos_june9['total'].sum()}")
        print(df_pos_june9[['fecha_local', 'total']])

if __name__ == '__main__':
    asyncio.run(run())
