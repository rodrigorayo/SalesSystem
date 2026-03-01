from typing import Optional
from beanie import Document
from pydantic import Field
from datetime import datetime

class Cliente(Document):
    tenant_id: str
    nombre: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    nit_ci: Optional[str] = None
    direccion: Optional[str] = None
    notas: Optional[str] = None
    lista_precio_id: Optional[str] = None
    total_compras: float = 0.0
    cantidad_compras: int = 0
    ultima_compra_at: Optional[datetime] = None
    is_active: bool = True
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "clientes"
        indexes = [
            [("tenant_id", 1), ("telefono", 1)],
            [("tenant_id", 1), ("nit_ci", 1)],
            [("tenant_id", 1), ("is_active", 1)],
        ]
