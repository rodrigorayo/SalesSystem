import os
import sys
import pandas as pd
from pymongo import MongoClient, UpdateOne
from pymongo.errors import BulkWriteError, ConnectionFailure
import argparse

# Configuración de Conexión a MongoDB (Ajusta la URI según tu entorno)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = "sales_system"
COLLECTION_NAME = "sales"

def importar_ventas(ruta_archivo: str, col_fecha: str = "fecha", col_id: str = "ID_VENTA_O_TICKET"):
    """
    Script robusto para importar ventas desde Excel o CSV hacia MongoDB
    garantizando cero duplicados mediante Pandas y bulk_write (upsert).
    """
    print(f"\n[1] Iniciando procesamiento del archivo: {ruta_archivo}")
    
    # -------------------------------------------------------------------------
    # 1. Limpieza en Memoria (Pandas)
    # -------------------------------------------------------------------------
    try:
        # Detectar el tipo de archivo
        ext = os.path.splitext(ruta_archivo)[1].lower()
        if ext == '.csv':
            df = pd.read_csv(ruta_archivo)
        elif ext in ['.xls', '.xlsx']:
            df = pd.read_excel(ruta_archivo)
        else:
            raise ValueError(f"Formato no soportado: {ext}. Solo .csv, .xls, .xlsx")
            
        total_original = len(df)
        print(f"    -> Archivo cargado exitosamente. Filas originales: {total_original}")
        
        # Validar columnas requeridas
        if col_id not in df.columns:
            raise ValueError(f"La columna identificadora '{col_id}' no existe en el archivo.")
        if col_fecha not in df.columns:
            raise ValueError(f"La columna de fecha '{col_fecha}' no existe en el archivo.")
            
        # Convertir la columna de fecha a objetos datetime nativos de Pandas/Python
        # Esto asegura que MongoDB los guarde como ISODate y no como simples strings
        df[col_fecha] = pd.to_datetime(df[col_fecha], errors='coerce')
        
        # Ordenar cronológicamente
        df = df.sort_values(by=col_fecha)
        
        # Eliminar duplicados internos EXACTOS basados en el ID único,
        # conservando el último registro (el más reciente o actualizado en la cola)
        df = df.drop_duplicates(subset=[col_id], keep='last')
        
        total_limpio = len(df)
        print(f"    -> Limpieza Pandas completada. Duplicados internos eliminados: {total_original - total_limpio}")
        print(f"    -> Total de registros a procesar hacia BD: {total_limpio}")
        
        if total_limpio == 0:
            print("    -> No hay datos válidos para procesar. Abortando.")
            return

    except Exception as e:
        print(f"\n[ERROR CRÍTICO PANDAS] Fallo al leer o limpiar el archivo: {e}")
        return

    # -------------------------------------------------------------------------
    # 2. Inserción Segura y Masiva (PyMongo bulk_write)
    # -------------------------------------------------------------------------
    try:
        print("\n[2] Conectando a la base de datos MongoDB...")
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Forzar chequeo de conexión
        client.admin.command('ping')
        db = client[DATABASE_NAME]
        coleccion = db[COLLECTION_NAME]
        
        # Convertir DataFrame a lista de diccionarios (registros)
        # Se reemplazan los valores NaN/NaT nativos de Pandas por None para compatibilidad con MongoDB
        df = df.where(pd.notnull(df), None)
        registros = df.to_dict('records')
        
        # Construir la lista de operaciones UpdateOne
        operaciones = []
        for reg in registros:
            id_ticket = reg[col_id]
            
            # Regla Innegociable: Buscar por identificador único y aplicar $set con upsert=True
            op = UpdateOne(
                {col_id: id_ticket},  # Filtro de búsqueda
                {"$set": reg},        # Si existe actualiza, si no existe inserta los datos
                upsert=True           # Garantiza cero duplicados inter-ejecuciones
            )
            operaciones.append(op)
            
        print(f"    -> Ejecutando bulk_write de {len(operaciones)} operaciones en db.{COLLECTION_NAME}...")
        
        # Ejecutar en bloque
        resultado = coleccion.bulk_write(operaciones)
        
        # -------------------------------------------------------------------------
        # 3. Consola y Control de Auditoría
        # -------------------------------------------------------------------------
        print("\n[ÉXITO] Sincronización masiva finalizada con la base de datos.")
        print(f"    => Insertados Nuevos: {resultado.upserted_count}")
        print(f"    => Modificados / Actualizados: {resultado.modified_count}")
        print(f"    => Coincidentes (Sin cambios): {resultado.matched_count - resultado.modified_count}")
        
    except ConnectionFailure:
        print(f"\n[ERROR DE CONEXIÓN] No se pudo conectar a MongoDB en {MONGO_URI}")
    except BulkWriteError as bwe:
        print("\n[ERROR DE ESCRITURA BULK] Hubo un problema al escribir en la base de datos.")
        print(bwe.details)
    except Exception as e:
        print(f"\n[ERROR INESPERADO MONGODB] {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Importador y Limpiador Robusto de Ventas hacia MongoDB")
    parser.add_argument("archivo", help="Ruta al archivo Excel o CSV a importar")
    parser.add_argument("--fecha", default="fecha", help="Nombre de la columna de fecha (default: fecha)")
    parser.add_argument("--id", default="ID_VENTA_O_TICKET", help="Nombre de la columna identificadora única (default: ID_VENTA_O_TICKET)")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.archivo):
        print(f"Error: El archivo '{args.archivo}' no existe.")
        sys.exit(1)
        
    importar_ventas(args.archivo, col_fecha=args.fecha, col_id=args.id)
