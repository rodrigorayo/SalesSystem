from typing import Optional
from enum import Enum
from beanie import Document
from pydantic import Field
from datetime import datetime


from .base import SoftDeleteMixin


class TipoSucursal(str, Enum):
    FISICA = "FISICA"
    SUPERVISOR = "SUPERVISOR"
    VENDEDOR = "VENDEDOR"

class Sucursal(Document, SoftDeleteMixin):
    """
    Sucursal (branch) de una empresa / tenant.

    ciudad + direccion son obligatorias para soportar empresas nacionales
    con sucursales en distintas ciudades (Cochabamba, La Paz, etc.).
    """
    tenant_id: str
    nombre: str
    ciudad: str                          # e.g. "Cochabamba", "La Paz"
    direccion: str                       # full street address
    telefono: Optional[str] = None
    tipo: TipoSucursal = TipoSucursal.FISICA
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "sucursales"
