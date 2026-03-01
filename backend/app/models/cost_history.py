from typing import Optional
from beanie import Document
from pydantic import Field
from datetime import datetime

class ProductCostHistory(Document):
    """
    History of cost changes for products.
    """
    tenant_id: str
    producto_id: str
    descripcion: str               # Snapshot of name
    costo_anterior: float
    costo_nuevo: float
    diferencia: float              # Calculated: nuevo - anterior
    motivo: Optional[str] = None
    cambiado_por: str              # user_id
    cambiado_por_nombre: str       # Snapshot of user name
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "product_cost_history"
        indexes = [
            [("tenant_id", 1), ("producto_id", 1), ("created_at", -1)],
            [("tenant_id", 1), ("created_at", -1)],
        ]
