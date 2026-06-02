import traceback
import shutil
import os
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.infrastructure.core.config import settings
from app.services.import_service import procesar_archivo

router = APIRouter()

@router.post("/importar-historico")
async def importar(
    file: UploadFile = File(...),
    sucursal: str = Form(...)
):
    try:
        print("\n" + "="*50)
        print(">>> DISPARADOR ETL BACKEND ACTIVADO <<<")
        print(f"[{file.filename}] -> Destino: {sucursal}")
        
        # Leemos en RAM como dictó la misión
        file_bytes = await file.read()
        print(f"[OK] Archivo en RAM: {len(file_bytes)} bytes.")
        
        # Enviar al motor Pandas "Modo Dios"
        resultado = await procesar_archivo(file_bytes, sucursal)
        
        print(">>> IMPORTACIÓN EXITOSA <<<")
        print("="*50 + "\n")
        return resultado

    except Exception as e:
        print("\n" + "X"*50)
        print(f"!!! ERROR CRITICO 500 !!!")
        print(f"Motivo: {str(e)}")
        print(traceback.format_exc())
        print("X"*50 + "\n")
        raise HTTPException(
            status_code=500,
            detail=f"Fallo interno en motor ETL: {str(e)}"
        )
    finally:
        # Flush de Memoria: Forzamos liberación de datos en memoria (vital si el excel era muy grande)
        file_bytes = None
        import gc
        gc.collect()
