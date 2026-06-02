from .base import DecimalMoney
from datetime import datetime
from beanie import Document
from pydantic import Field, BaseModel

class PedidoItem(BaseModel):
    producto_id: str
    descripcion: str
    cantidad: int = Field(gt=0)
    precio_mayorista: DecimalMoney = Field(ge=0)
    subtotal: DecimalMoney = Field(ge=0)

class PedidoItemDocument(Document):
    tenant_id: str
    pedido_id: str
    sucursal_origen_id: str
    sucursal_destino_id: str
    pedido_fecha: datetime
    producto_id: str
    descripcion: str
    cantidad: int
    precio_mayorista: DecimalMoney
    subtotal: DecimalMoney
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "pedido_items"
        indexes = [
            [("tenant_id", 1), ("producto_id", 1), ("pedido_fecha", -1)],
            [("tenant_id", 1), ("sucursal_origen_id", 1), ("pedido_fecha", -1)],
            [("tenant_id", 1), ("sucursal_destino_id", 1), ("pedido_fecha", -1)],
            [("pedido_id", 1)],
        ]
