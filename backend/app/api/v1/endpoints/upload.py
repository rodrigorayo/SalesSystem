import os
import shutil
import tempfile
import traceback
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pymongo import UpdateOne
from app.db import get_raw_db

router = APIRouter()

@router.post("/importar-historico")
async def importar(
    file: UploadFile = File(...),
    sucursal_id: str = Form(...)  # Recibe sucursal_id directo del frontend
):
    try:
        print("\n" + "="*50)
        print(">>> INICIANDO ETL ROBUSTO MULTI-HOJA (TABLA PLANA A ANIDADA) <<<")
        print(f"Archivo: {file.filename} -> Sucursal Destino: {sucursal_id}")
        
        # 1. Manejo de Archivos Grandes (Guardar en Disco)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_path = temp_file.name
            
        print(f"[OK] Archivo guardado temporalmente en disco: {temp_path}")

        # 2. Lectura Multi-Hoja (Pandas)
        diccionario_hojas = pd.read_excel(temp_path, sheet_name=None)
        df_completo = pd.concat(diccionario_hojas.values(), ignore_index=True)
        total_original_filas = len(df_completo)
        print(f"[OK] Todas las hojas unidas. Filas planas crudas: {total_original_filas}")
        
        # Eliminar el archivo temporal del disco duro
        os.remove(temp_path)

        # 3. Limpieza de Nombres y Filas Basura
        df_completo.columns = df_completo.columns.str.strip()
        df_completo = df_completo.dropna(subset=['DESCRIPCION'])
        
        # 4. Transformación (Agrupación por Ticket usando la marca de tiempo)
        df_completo['FECHA'] = pd.to_datetime(df_completo['FECHA'], errors='coerce')
        # Si alguna fecha es NaT despues de la conversion, no podemos agruparla bien, la tiramos o ignoramos
        df_completo = df_completo.dropna(subset=['FECHA'])
        
        grupos = df_completo.groupby('FECHA')
        
        registros = []
        for fecha, grupo in grupos:
            numero_ticket = str(fecha)
            created_at = pd.to_datetime(fecha)
            
            # Forzar suma explícita
            total_ticket = round(grupo['TOTAL'].astype(float).sum(), 2)
            
            items = []
            for _, fila in grupo.iterrows():
                # En algunos casos los Excel vienen con valores nulos numéricos. Los convertimos.
                # También extraemos los nombres exactos de las columnas.
                items.append({
                    "producto_id": str(fila['S/N']) if pd.notnull(fila.get('S/N')) else "N/A",
                    "nombre": str(fila['DESCRIPCION']),
                    "cantidad": float(fila['CANTIDAD']) if pd.notnull(fila.get('CANTIDAD')) else 1.0,
                    "precio_unitario": float(fila['PRECIO UNITARIO']) if pd.notnull(fila.get('PRECIO UNITARIO')) else 0.0,
                    "subtotal": float(fila['TOTAL']) if pd.notnull(fila.get('TOTAL')) else 0.0
                })
                
            registro = {
                "numero_ticket": numero_ticket,
                "created_at": created_at,
                "sucursal_id": sucursal_id,
                "total": total_ticket,
                "anulada": False,
                "items": items
            }
            registros.append(registro)
            
        total_tickets_consolidados = len(registros)
        print(f"[OK] Transformación ETL completada. Tickets únicos (agrupados): {total_tickets_consolidados}")

        if total_tickets_consolidados == 0:
            return {"status": "success", "message": "Archivo vacío o sin datos válidos", "upserted": 0, "modified": 0, "ignored": 0, "total_procesado": 0}

        # 5. Inserción Blindada (Bulk Upsert en Chunks)
        db = await get_raw_db()
        coleccion = db.sales
        
        CHUNK_SIZE = 1000
        total_upserted = 0
        total_modified = 0
        total_matched = 0
        
        print(f"[INFO] Iniciando inserción por lotes (Chunks de {CHUNK_SIZE})")
        
        for i in range(0, len(registros), CHUNK_SIZE):
            lote = registros[i:i + CHUNK_SIZE]
            operaciones = []
            
            for reg in lote:
                # Regla innegociable: Match por numero_ticket y sucursal_id
                op = UpdateOne(
                    {"numero_ticket": reg["numero_ticket"], "sucursal_id": sucursal_id},
                    {"$set": reg},
                    upsert=True
                )
                operaciones.append(op)
                
            resultado = await coleccion.bulk_write(operaciones)
            total_upserted += resultado.upserted_count
            total_modified += resultado.modified_count
            total_matched += resultado.matched_count
            
            print(f"  -> Lote procesado ({i} al {i+len(lote)}): Upserted={resultado.upserted_count}, Modified={resultado.modified_count}")

        # 6. Respuesta JSON al Frontend
        resumen = {
            "status": "success",
            "upserted": total_upserted,
            "modified": total_modified,
            "ignored": total_matched - total_modified,
            "total_procesado": total_tickets_consolidados
        }
        
        print(">>> IMPORTACIÓN ETL EXITOSA <<<")
        print(resumen)
        print("="*50 + "\n")
        
        return resumen

    except Exception as e:
        print(f"Error interno: {e}")
        print(traceback.format_exc())
        
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
            
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    finally:
        import gc
        gc.collect()
