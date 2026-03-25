"""
Pydantic schemas for the Sales domain.

Extracted from sales.py endpoint to allow independent development
of schemas vs endpoint logic.
"""

from typing import List, Optional, Literal
from pydantic import BaseModel


class SaleItemIn(BaseModel):
    """A single item line in a sale request."""
    producto_id: str
    cantidad: int
    precio_unitario: float = 0.0   # if 0, falls back to product.precio_venta
    descuento_unitario: float = 0.0


class PagoIn(BaseModel):
    """One payment segment (supports split payments)."""
    metodo: Literal["EFECTIVO", "QR", "TARJETA", "TRANSFERENCIA", "CREDITO"]
    monto: float

class AbonoCreate(BaseModel):
    """Request body to pay off portions of a credit sale."""
    metodo: Literal["EFECTIVO", "QR", "TARJETA", "TRANSFERENCIA"]
    monto: float


class ClienteIn(BaseModel):
    """Optional invoice / billing data provided at point of sale."""
    nit: Optional[str] = None
    razon_social: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    es_factura: bool = False


class SaleCreate(BaseModel):
    """Request body for creating a new sale."""
    sucursal_id: Optional[str] = None
    items: List[SaleItemIn]
    pagos: List[PagoIn] = []
    descuento: Optional[dict] = None   # DescuentoInfo from models/sale.py
    cliente_id: Optional[str] = None
    cliente: Optional[ClienteIn] = None


class SalesPaginated(BaseModel):
    """Paginated response for GET /sales."""
    items: list
    total: int
    page: int
    pages: int


class QRInfoUpdate(BaseModel):
    """Request body to confirm a QR payment."""
    banco: str
    referencia: str
    monto_transferido: float
