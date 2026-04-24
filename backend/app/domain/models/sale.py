from typing import List, Optional, Literal
from enum import Enum
from beanie import Document
from pydantic import BaseModel, Field
from datetime import datetime
from .base import DecimalMoney

class EstadoPago(str, Enum):
    PAGADO = "PAGADO"
    PENDIENTE = "PENDIENTE"
    PARCIAL = "PARCIAL"


class SaleItem(BaseModel):
    producto_id: str
    descripcion: str
    cantidad: int = Field(gt=0)
    precio_unitario: DecimalMoney
    costo_unitario: DecimalMoney
    descuento_unitario: DecimalMoney = DecimalMoney("0")
    subtotal: DecimalMoney


class PagoItem(BaseModel):
    """One segment of a split payment or later amortization."""
    metodo: Literal["EFECTIVO", "QR", "TARJETA", "TRANSFERENCIA", "CREDITO"]
    monto: DecimalMoney
    fecha: datetime = Field(default_factory=datetime.utcnow)


class DescuentoInfo(BaseModel):
    nombre: Optional[str] = None
    tipo: Literal["MONTO", "PORCENTAJE"]
    valor: DecimalMoney


class ClienteInfo(BaseModel):
    """Optional invoice / billing data (Snapshot)."""
    nit: Optional[str] = None
    razon_social: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    es_factura: bool = False


class QRInfo(BaseModel):
    banco: Optional[str] = None
    referencia: Optional[str] = None
    monto_transferido: Optional[DecimalMoney] = None
    confirmado: bool = False
    confirmado_at: Optional[datetime] = None
    confirmado_por: Optional[str] = None


class Sale(Document):
    tenant_id: str
    sucursal_id: str = "CENTRAL"
    items: List[SaleItem]
    total: DecimalMoney
    pagos: List[PagoItem] = []
    descuento: Optional[DescuentoInfo] = None
    cliente_id: Optional[str] = None  # Ref to Clientes collection
    cliente: Optional[ClienteInfo] = None
    qr_info: Optional[QRInfo] = None
    cashier_id: str
    cashier_name: str
    vendedor_id: Optional[str] = None
    vendedor_name: Optional[str] = None
    anulada: bool = False
    estado_pago: EstadoPago = EstadoPago.PAGADO
    factura_emitida: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # ── Auditoría de anulación ────────────────────────────────────────────────
    motivo_anulacion: Optional[str] = None          # Categoría del motivo
    notas_anulacion: Optional[str] = None           # Descripción libre
    anulada_por_id: Optional[str] = None            # ID del usuario que anuló
    anulada_por_nombre: Optional[str] = None        # Nombre legible
    anulada_at: Optional[datetime] = None           # Timestamp de anulación

    class Settings:
        name = "sales"
        indexes = ["tenant_id", "created_at", "cliente_id", "cashier_id"]

