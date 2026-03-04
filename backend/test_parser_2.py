import pandas as pd
import io

def test_parse():
    df = pd.read_excel('test1.xlsx')
    df.columns = df.columns.astype(str).str.strip().str.upper()
    df.columns = df.columns.str.replace(' ', '_')
    
    if "CATEGORIA" not in df.columns:
        print("Falta columna obligatoria: CATEGORIA")
        return
        
    nombres_categorias_excel = df['CATEGORIA'].dropna().unique()
    print("Categorias encontradas:", nombres_categorias_excel)
    
    inv_columns = [col for col in df.columns if col.startswith("INV_") or col.startswith("INVENTARIO_")]
    print("Columnas INV:", inv_columns)
    
    precio_cols = [col for col in df.columns if col.startswith("PRECIO_PUBLICO_") and col != "PRECIO_PUBLICO"]
    print("Columnas Precio:", precio_cols)

    from bson import ObjectId
    import uuid
    for index, row in df.iterrows():
        fila_num = index + 2
        codigo_corto = str(row.get("CODIGO_CORTO", row.get("CODIGOCORTO", ""))).strip()
        if codigo_corto == "nan" or not codigo_corto:
             codigo_corto = str(row.get("CODIGO", "")).strip()
             
        if not codigo_corto or codigo_corto == "nan":
            #print("Falta CODIGO", fila_num)
            pass

        descripcion = str(row.get("DESCRIPCION", "")).strip()

        def safe_float(val):
            try:
                return float(val) if pd.notnull(val) else 0.0
            except: return 0.0

        precio_publico = safe_float(row.get("PRECIO_PUBLICO", 0))
        costo_unitario = safe_float(row.get("COSTO_UNITARIO", 0))
        codigo_largo = str(row.get("CODIGO", "")).strip()
        if codigo_largo == "nan": codigo_largo = ""

    print("Parseo local exitoso sin explotar con 500!")

if __name__ == "__main__":
    test_parse()
