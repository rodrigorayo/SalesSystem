"""
Pydantic schemas for the Caja (cash register) domain.
Extracted from caja.py endpoint.

Note: IngresoIn was defined twice in caja.py (duplicate class). Fixed here.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class AbrirCajaIn(BaseModel):
    """Request body to open a cash register session."""
    monto_inicial: float
    sucursal_id: Optional[str] = None


class CerrarCajaIn(BaseModel):
    """Request body to close a cash register session."""
    monto_fisico_contado: float
    notas: Optional[str] = None


class GastoIn(BaseModel):
    """Request body to register a manual expense."""
    monto: float
    descripcion: str
    categoria_id: Optional[str] = None


class IngresoIn(BaseModel):
    """Request body to register a manual income (non-sale)."""
    monto: float
    descripcion: str
    metodo: str   # "EFECTIVO" | "QR" | "TARJETA"


class CategoriaGastoIn(BaseModel):
    """Request body to create an expense category."""
    nombre: str
    descripcion: Optional[str] = None
    icono: Optional[str] = "receipt"


class ResumenCaja(BaseModel):
    """Response model for the cash session summary (arqueo)."""
    sesion_id: str
    cajero_name: str
    abierta_at: datetime
    monto_inicial: float
    # Cash drawer totals
    total_efectivo_ventas: float
    total_cambio: float
    total_gastos: float
    total_ajustes: float = 0.0
    saldo_calculado: float
    # Digital channels
    total_qr: float
    total_tarjeta: float
    total_ventas_general: float
    # Manual income
    total_ingresos_efectivo: float = 0.0
    total_ingresos_qr: float = 0.0
    total_ingresos_tarjeta: float = 0.0
    # Metadata
    num_transacciones: int
    movimientos: List[dict]
