from enum import Enum
from typing import Optional
from beanie import Document
from pydantic import Field, BaseModel
from datetime import datetime
from pymongo import IndexModel

class TipoListaPrecio(str, Enum):
    FIJO                 = "FIJO"
    PORCENTAJE_DESCUENTO = "PORCENTAJE_DESCUENTO"

class ListaPrecio(Document):
    tenant_id: str
    nombre: str            # "Mayorista", "VIP", "Empleados"
    descripcion: Optional[str] = None
    tipo: TipoListaPrecio
    valor_descuento: Optional[float] = None # Solo si tipo = PORCENTAJE_DESCUENTO
    is_active: bool = True
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "listas_precios"

class ListaPrecioItem(Document):
    tenant_id: str
    lista_id: str
    producto_id: str
    precio_especial: float = Field(ge=0)
    cantidad_minima: int = Field(ge=1, default=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "lista_precios_items"
        indexes = [
            IndexModel(
                [("tenant_id", 1), ("lista_id", 1), ("producto_id", 1), ("cantidad_minima", 1)],
                unique=True
            ),
            [("tenant_id", 1), ("producto_id", 1)],
        ]
