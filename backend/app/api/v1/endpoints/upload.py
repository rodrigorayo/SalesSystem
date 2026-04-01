from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import os
import uuid

from app.infrastructure.core.config import settings

router = APIRouter()

STATIC_DIR = "/tmp/static" if settings.ENVIRONMENT == "production" else "static"
UPLOAD_DIR = os.path.join(STATIC_DIR, "images")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        # Generate unique filename
        file_extension = file.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, filename)

        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        base_url = "https://sales-system-kappa.vercel.app" if settings.ENVIRONMENT == "production" else "http://localhost:8000"
        return {"url": f"{base_url}/static/images/{filename}"} 
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
