from datetime import datetime
from enum import Enum
from typing import Optional, Any
from beanie import Document
from pydantic import Field, model_validator
from .base import SoftDeleteMixin, DecimalMoney


# ─── Enums ────────────────────────────────────────────────────────────────────

class EstadoSesion(str, Enum):
    ABIERTA  = "ABIERTA"
    CERRADA  = "CERRADA"

class SubtipoMovimiento(str, Enum):
    APERTURA        = "APERTURA"        # monto inicial
    VENTA_EFECTIVO  = "VENTA_EFECTIVO"  # efectivo recibido por venta POS
    VENTA_QR        = "VENTA_QR"        # cobro por QR (no ingresa al cajón)
    VENTA_TARJETA   = "VENTA_TARJETA"   # cobro por tarjeta (no ingresa al cajón)
    INGRESO_EFECTIVO= "INGRESO_EFECTIVO"# ingreso manual de efectivo (fondo, venta externa)
    INGRESO_QR      = "INGRESO_QR"      # ingreso manual por QR
    INGRESO_TARJETA = "INGRESO_TARJETA" # ingreso manual por Tarjeta
    CAMBIO          = "CAMBIO"          # cambio devuelto al cliente (egreso)
    GASTO           = "GASTO"           # gasto manual del cajero
    AJUSTE          = "AJUSTE"          # corrección manual



# ─── CajaSesion ───────────────────────────────────────────────────────────────

class CajaSesion(Document):
    """One cash-drawer session: from apertura to cierre."""
    tenant_id:           str
    sucursal_id:         str
    cajero_id:           str
    cajero_name:         str
    monto_inicial:       DecimalMoney = DecimalMoney("0.0")
    estado:              EstadoSesion = EstadoSesion.ABIERTA
    abierta_at:          datetime = Field(default_factory=datetime.utcnow)
    cerrada_at:          Optional[datetime] = None
    monto_cierre_fisico: Optional[DecimalMoney] = None
    monto_diferencia:    Optional[DecimalMoney] = None

    # Campos de Auditoria Estricta (Rate/Device Tracking)
    ip_apertura:         Optional[str] = None
    user_agent_apertura: Optional[str] = None

    notas_cierre:        Optional[str] = None
    created_at:          datetime = Field(default_factory=datetime.utcnow)

    # Handled by DecimalMoney annotation now.

    class Settings:
        name = "caja_sesiones"
        indexes = ["tenant_id", "sucursal_id", "estado"]


# ─── CajaGastoCategoria ───────────────────────────────────────────────────────

class CajaGastoCategoria(Document, SoftDeleteMixin):
    """User-defined expense categories (e.g. 'Pasajes', 'Limpieza')."""
    tenant_id:   str
    nombre:      str
    descripcion: Optional[str] = None
    icono:       Optional[str] = "receipt"   # lucide icon name
    created_at:  datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "caja_gasto_categorias"
        indexes = ["tenant_id", "is_active"]


# ─── CajaMovimiento ───────────────────────────────────────────────────────────

class CajaMovimiento(Document):
    """Single cash movement within a session."""
    tenant_id:    str
    sucursal_id:  str
    sesion_id:    str                           # FK → CajaSesion
    cajero_id:    str
    cajero_name:  str
    subtipo:      SubtipoMovimiento
    # INGRESO = cash coming IN;  EGRESO = cash going OUT
    tipo:         str                           # "INGRESO" | "EGRESO"
    monto:        DecimalMoney
    descripcion:  str
    categoria_id: Optional[str] = None         # for GASTO
    sale_id:      Optional[str] = None         # for VENTA_EFECTIVO / CAMBIO
    fecha:        datetime = Field(default_factory=datetime.utcnow)
    created_at:   datetime = Field(default_factory=datetime.utcnow)

    # Handled by DecimalMoney annotation now.

    class Settings:
        name = "caja_movimientos"
        indexes = ["tenant_id", "sesion_id", "fecha", "sale_id"]
