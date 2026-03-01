from typing import Optional
from beanie import Document
from pydantic import Field
from datetime import datetime


from .base import SoftDeleteMixin


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
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "sucursales"
