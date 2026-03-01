from typing import List, Optional, Literal
from beanie import Document
from pydantic import BaseModel, Field
from datetime import datetime


class SaleItem(BaseModel):
    producto_id: str
    descripcion: str
    cantidad: int = Field(gt=0)
    precio_unitario: float = Field(ge=0)
    costo_unitario: float = Field(ge=0)
    descuento_unitario: float = Field(ge=0, default=0)
    subtotal: float = Field(ge=0)


class PagoItem(BaseModel):
    """One segment of a split payment."""
    metodo: Literal["EFECTIVO", "QR", "TARJETA", "TRANSFERENCIA"]
    monto: float = Field(gt=0)


class DescuentoInfo(BaseModel):
    nombre: Optional[str] = None
    tipo: Literal["MONTO", "PORCENTAJE"]
    valor: float


class ClienteInfo(BaseModel):
    """Optional invoice / billing data (Snapshot)."""
    nit: Optional[str] = None
    razon_social: Optional[str] = None
    email: Optional[str] = None
    es_factura: bool = False


class Sale(Document):
    tenant_id: str
    sucursal_id: str = "CENTRAL"
    items: List[SaleItem]
    total: float
    pagos: List[PagoItem] = []
    descuento: Optional[DescuentoInfo] = None
    cliente_id: Optional[str] = None  # Ref to Clientes collection
    cliente: Optional[ClienteInfo] = None
    cashier_id: str
    cashier_name: str
    anulada: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "sales"
        indexes = ["tenant_id", "created_at", "cliente_id", "cashier_id"]
