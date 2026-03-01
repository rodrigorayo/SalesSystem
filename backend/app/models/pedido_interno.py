from typing import List, Optional
from enum import Enum
from beanie import Document
from pydantic import BaseModel, Field
from datetime import datetime


class EstadoPedido(str, Enum):
    CREADO = "CREADO"
    ACEPTADO = "ACEPTADO"
    DESPACHADO = "DESPACHADO"
    RECIBIDO = "RECIBIDO"
    CANCELADO = "CANCELADO"


class PedidoItem(BaseModel):
    producto_id: str
    descripcion: str
    cantidad: int = Field(gt=0)
    precio_mayorista: float = Field(ge=0)
    subtotal: float = Field(ge=0)


class PedidoInterno(Document):
    """
    Internal B2B order from a Sucursal to the Empresa's central warehouse.

    State machine: CREADO → DESPACHADO → RECIBIDO

    DESPACHADO: Matrix deducts from central inventory.
    RECIBIDO:   Branch adds to its own inventory, CuentaPorPagar is recorded.
    """
    tenant_id: str
    sucursal_id: str                    # sucursal_destino_id (legacy)
    sucursal_origen_id: Optional[str] = "CENTRAL"
    sucursal_destino_id: Optional[str] = None
    tipo_pedido: str = "MATRIZ_A_SUCURSAL" # "SUCURSAL_A_SUCURSAL" | "MATRIZ_A_SUCURSAL"
    estado: EstadoPedido = EstadoPedido.CREADO
    items: List[PedidoItem]
    notas: Optional[str] = None
    total_mayorista: float = 0.0        # calculated on despacho

    created_at: datetime = Field(default_factory=datetime.utcnow)
    aceptado_at: Optional[datetime] = None
    despachado_at: Optional[datetime] = None
    recibido_at: Optional[datetime] = None
    cancelado_at: Optional[datetime] = None

    aceptado_por: Optional[str] = None
    despachado_por: Optional[str] = None   # user_id of matrix admin
    recibido_por: Optional[str] = None     # user_id of branch admin
    cancelado_por: Optional[str] = None

    class Settings:
        name = "pedidos_internos"
        indexes = [
            "tenant_id",
            "sucursal_id",
            "sucursal_origen_id",
            "sucursal_destino_id",
            "estado",
        ]
