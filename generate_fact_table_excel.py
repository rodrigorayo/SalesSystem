import pymongo
import pandas as pd
from datetime import datetime
import os

def main():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/?appName=Cluster0"
    
    print("Conectando a la base de datos...")
    client = pymongo.MongoClient(uri)
    db = client.salessystem
    
    # Extraer los datos
    print("Extrayendo datos de ventas_historicas_crudas...")
    cursor = db.ventas_historicas_crudas.find({}, {"_id": 0})
    data = list(cursor)
    
    if not data:
        print("No se encontraron datos en la colección.")
        return
        
    df_data = pd.DataFrame(data)
    
    # Reordenar y limpiar columnas si existen
    column_order = [
        "fecha_transaccion", 
        "sucursal", 
        "nombre_producto", 
        "cantidad_vendida", 
        "monto_total_bs", 
        "tenant_id", 
        "original_sale_id"
    ]
    # Filtrar solo las columnas que realmente existan en el df para evitar errores
    column_order = [c for c in column_order if c in df_data.columns]
    df_data = df_data[column_order]
    
    # Formatear la fecha para quitar el timezone si es necesario, así Excel no da errores
    if "fecha_transaccion" in df_data.columns:
        df_data["fecha_transaccion"] = pd.to_datetime(df_data["fecha_transaccion"]).dt.tz_localize(None)
    
    if "original_sale_id" in df_data.columns:
        df_data["original_sale_id"] = df_data["original_sale_id"].astype(str)
        
    # Diccionario de Datos
    diccionario = [
        {"Columna": "fecha_transaccion", "Tipo": "Dimensión (Tiempo)", "Descripción": "Fecha y hora exacta de la transacción."},
        {"Columna": "sucursal", "Tipo": "Dimensión (Geográfica)", "Descripción": "Nombre de la sucursal donde ocurrió la venta."},
        {"Columna": "nombre_producto", "Tipo": "Dimensión (Producto)", "Descripción": "Nombre del artículo vendido en mayúsculas."},
        {"Columna": "cantidad_vendida", "Tipo": "Medida (Hecho)", "Descripción": "Unidades físicas vendidas del artículo."},
        {"Columna": "monto_total_bs", "Tipo": "Medida (Hecho)", "Descripción": "Subtotal monetario en Bolivianos de esa línea."},
        {"Columna": "tenant_id", "Tipo": "Dimensión (Contexto)", "Descripción": "Identificador de la empresa o inquilino."},
        {"Columna": "original_sale_id", "Tipo": "Dimensión Degenerada", "Descripción": "Referencia al ID del ticket original para agrupar."},
    ]
    df_dict = pd.DataFrame(diccionario)
    
    # Exportar a Excel
    output_file = os.path.join(os.getcwd(), "Tabla_de_Hechos_BI.xlsx")
    print(f"Generando archivo Excel en: {output_file}")
    
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        df_dict.to_excel(writer, sheet_name='Diccionario_de_Datos', index=False)
        df_data.to_excel(writer, sheet_name='Datos_Crudos', index=False)
        
        # Ajustar ancho de columnas para que se vea bien
        worksheet_dict = writer.sheets['Diccionario_de_Datos']
        for col in worksheet_dict.columns:
            max_length = 0
            column = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = (max_length + 2)
            worksheet_dict.column_dimensions[column].width = adjusted_width
            
    print(f"¡Excel generado exitosamente en {output_file}!")

if __name__ == "__main__":
    main()
