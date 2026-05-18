from typing import List, Optional
from pydantic import BaseModel, Field

class TrasladoItemCreate(BaseModel):
    producto_id: str
    cantidad: int = Field(gt=0)

class TrasladoCreate(BaseModel):
    sucursal_destino_id: str
    notas: Optional[str] = None
    items: List[TrasladoItemCreate] = Field(..., min_length=1)

class TrasladoItemReceive(BaseModel):
    producto_id: str
    cantidad_recibida: int = Field(ge=0)

class TrasladoReceive(BaseModel):
    notas: Optional[str] = None
    items: List[TrasladoItemReceive]
