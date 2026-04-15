from typing import List, Optional, Literal
from datetime import datetime
from beanie import Document
from pydantic import BaseModel, Field
from .base import DecimalMoney
from enum import Enum

class EstadoCuenta(str, Enum):
    AL_DIA = "AL_DIA"
    MOROSO = "MOROSO"

class CuentaCredito(Document):
    tenant_id: str
    cliente_id: str  # ID referenciado a Clientes
    saldo_total: DecimalMoney = DecimalMoney("0")
    limite_credito: Optional[DecimalMoney] = None
    estado_cuenta: EstadoCuenta = EstadoCuenta.AL_DIA
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "cuentas_credito"
        indexes = ["tenant_id", "cliente_id"]

class EstadoDeuda(str, Enum):
    PENDIENTE = "PENDIENTE"
    PARCIAL = "PARCIAL"
    PAGADA = "PAGADA"
    ANULADA = "ANULADA"

class Deuda(Document):
    tenant_id: str
    sucursal_id: str
    cuenta_id: str
    cliente_id: str
    sale_id: str  # Referencia exacta a la Venta origen
    
    monto_original: DecimalMoney
    saldo_pendiente: DecimalMoney
    
    fecha_emision: datetime
    fecha_vencimiento: Optional[datetime] = None  # Opcional si hay plazos fijos futuro
    estado: EstadoDeuda = EstadoDeuda.PENDIENTE
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "deudas"
        indexes = ["tenant_id", "cuenta_id", "sale_id", "estado"]

class PagoCreditoItemInfo(BaseModel):
    """Refleja si se hizo abono mixto"""
    metodo: Literal["EFECTIVO", "QR", "TARJETA", "TRANSFERENCIA"]
    monto: DecimalMoney
    banco: Optional[str] = None
    referencia: Optional[str] = None

class TransaccionCredito(Document):
    """Historial cronológico de todos los movimientos (cargos o abonos) de una CuentaCredito"""
    tenant_id: str
    sucursal_id: str
    cuenta_id: str
    cliente_id: str
    
    tipo: Literal["CARGO", "ABONO"]  # CARGO = incremento de deuda, ABONO = pago
    monto: DecimalMoney
    
    # Si fue abono, detalles de cómo se pagó
    pagos: List[PagoCreditoItemInfo] = []
    
    # Deudas afectadas. Si fue un pago ciego asimétrico, puede afectar múltiples deudas.
    deudas_afectadas: List[str] = [] # lista de Deuda IDs
    
    sale_id: Optional[str] = None # Si es un cargo, qué venta lo originó
    
    cajero_id: str
    cajero_nombre: str
    sesion_caja_id: Optional[str] = None
    
    notas: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "transacciones_credito"
        indexes = ["tenant_id", "cuenta_id"]
