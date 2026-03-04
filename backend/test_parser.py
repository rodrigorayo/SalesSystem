import asyncio
import pandas as pd
import traceback
from bson import ObjectId

async def run_logic():
    # simulate the logic
    try:
        df = pd.read_excel('test1.xlsx')
        df.columns = df.columns.astype(str).str.strip().str.upper()
        df.columns = df.columns.str.replace(' ', '_')
        
        if "CATEGORIA" not in df.columns:
            print("Missing CATEGORIA")
            return
            
        nombres_categorias = df['CATEGORIA'].dropna().unique()
        print("Categorias found:", nombres_categorias)
        
        # sucursales 
        inv_columns = [col for col in df.columns if col.startswith("INV_")]
        print("Inv columns found:", inv_columns)
        
        for index, row in df.iterrows():
            codigo_corto = str(row.get("CODIGO_CORTO", row.get("CODIGOCORTO", ""))).strip()
            if codigo_corto == "nan" or not codigo_corto:
                 codigo_corto = str(row.get("CODIGO", "")).strip()
                 
            if not codigo_corto or codigo_corto == "nan":
                 print(f"Row {index+2} missing CODIGO_CORTO")
                 continue
                 
            descripcion = str(row.get("DESCRIPCION", "")).strip()
            
            def safe_float(val):
                try:
                    return float(val) if pd.notnull(val) else 0.0
                except: return 0.0
                
            precio_publico = safe_float(row.get("PRECIO_PUBLICO", 0))
            costo_unitario = safe_float(row.get("COSTO_UNITARIO", 0))
            codigo_largo = str(row.get("CODIGO", "")).strip()
            if codigo_largo == "nan": codigo_largo = ""
            
            for col in inv_columns:
                valor_celda = row.get(col, 0)
                try:
                    cantidad_fisica = float(valor_celda) if pd.notnull(valor_celda) else 0.0
                except:
                    cantidad_fisica = 0.0
            
        print("SUCCESSFULLY PARSED DATA")
            
    except Exception as e:
        print("EXC:")
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(run_logic())
