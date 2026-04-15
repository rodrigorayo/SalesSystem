from pydantic import BaseModel, root_validator
from typing import List, Optional, Literal

class PagoCreditoItemIn(BaseModel):
    metodo: Literal["EFECTIVO", "QR", "TARJETA", "TRANSFERENCIA"]
    monto: float
    banco: Optional[str] = None
    referencia: Optional[str] = None

class AbonoRequestIn(BaseModel):
    """
    Soporta pagos mixtos a una cuenta de crédito general, o si se manda deuda_id, a una deuda específica.
    """
    pagos: List[PagoCreditoItemIn]
    deuda_id: Optional[str] = None
    notas: Optional[str] = None

class DeudaResponse(BaseModel):
    id: str
    cuenta_id: str
    cliente_id: str
    sale_id: str
    monto_original: float
    saldo_pendiente: float
    fecha_emision: str
    estado: str
    # Info de cliente / Venta puede agregarse vía agregación o en frontend
    
class TransaccionCreditoResponse(BaseModel):
    id: str
    tipo: str
    monto: float
    pagos: List[dict]
    deudas_afectadas: List[str]
    cajero_nombre: str
    created_at: str
    notas: Optional[str] = None

class CuentaCreditoResponse(BaseModel):
    id: str
    cliente_id: str
    saldo_total: float
    estado_cuenta: str
    created_at: str
    cliente_nombre: Optional[str] = None
    cliente_nit: Optional[str] = None
    cliente_telefono: Optional[str] = None

class CuentasCreditoPaginated(BaseModel):
    items: List[CuentaCreditoResponse]
    total: int
    page: int
    pages: int
