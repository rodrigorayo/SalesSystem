"""
Pydantic schemas for the Pedidos (Internal Orders) domain.

Following Clean Architecture: schemas live in domain/schemas and are
consumed by both the API layer and the application/services layer.
They must NOT import from application or infrastructure.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class PedidoItemCreate(BaseModel):
    """A single product line in an internal order request."""
    producto_id: str
    cantidad: int = Field(gt=0)


class PedidoCreate(BaseModel):
    """Request body for creating a new internal transfer/order."""
    sucursal_origen_id: str = "CENTRAL"
    sucursal_destino_id: str
    items: List[PedidoItemCreate]
    notas: Optional[str] = None
    transferencia_directa: bool = False  # If True, skips ACEPTADO/DESPACHADO and completes immediately


class PedidoRecepcionItem(BaseModel):
    """Override how many units were actually received for a given product."""
    producto_id: str
    cantidad_recibida: int = Field(ge=0)


class PedidoRecepcion(BaseModel):
    """
    Optional body for the receive endpoint.
    If omitted, all items are assumed received in full.
    """
    items: Optional[List[PedidoRecepcionItem]] = None
