from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import os
import uuid

router = APIRouter()

UPLOAD_DIR = "static/images"
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
            
        # Return URL (Relative path for frontend to prepend backend URL)
        # Or absolute URL if we knew the domain. Let's return relative.
        return {"url": f"http://localhost:8000/static/images/{filename}"} 
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
