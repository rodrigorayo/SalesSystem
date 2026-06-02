from .base import DecimalMoney
from typing import Optional
from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum


class PriceRequestStatus(str, Enum):
    PENDIENTE = "PENDIENTE"
    APROBADO  = "APROBADO"
    RECHAZADO = "RECHAZADO"


class PriceChangeRequest(Document):
    tenant_id: str
    sucursal_id: str
    producto_id: str
    
    # Snapshots — context without joins
    producto_nombre: str
    sucursal_nombre: str
    precio_actual: DecimalMoney
    precio_propuesto: DecimalMoney
    
    motivo_solicitud: str
    estado: PriceRequestStatus = PriceRequestStatus.PENDIENTE
    motivo_rechazo: Optional[str] = None
    
    respondido_por: Optional[str] = None  # user_id
    responded_at: Optional[datetime] = None
    
    solicitado_por: str  # user_id
    solicitado_nombre: str
    
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "price_change_requests"
        indexes = [
            [("tenant_id", 1), ("estado", 1), ("created_at", -1)],
            [("tenant_id", 1), ("sucursal_id", 1), ("estado", 1)],
            [("tenant_id", 1), ("producto_id", 1)],
            "respondido_por",
            "solicitado_por"
        ]
