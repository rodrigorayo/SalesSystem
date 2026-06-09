from typing import Optional
from enum import Enum
from beanie import Document
from pydantic import Field
from datetime import datetime
from .base import SoftDeleteMixin

class TipoAlmacen(str, Enum):
    MATERIA_PRIMA = "MATERIA_PRIMA"
    PROCESADOS = "PROCESADOS"
    VENTAS = "VENTAS"
    GENERAL = "GENERAL"

class Almacen(Document, SoftDeleteMixin):
    """
    Representa un inventario físico o virtual (bodega) dentro de una sucursal.
    Ej. 'Cuarto Frío', 'Barra Principal', 'Bodega Seca'.
    """
    tenant_id: str
    sucursal_id: str
    nombre: str
    tipo: TipoAlmacen = TipoAlmacen.GENERAL
    is_default: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "almacenes"
        indexes = [
            "tenant_id",
            "sucursal_id",
            [("tenant_id", 1), ("sucursal_id", 1)]
        ]
