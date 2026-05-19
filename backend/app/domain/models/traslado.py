from typing import List, Optional
from enum import Enum
from beanie import Document
from pydantic import BaseModel, Field
from datetime import datetime
from .base import DecimalMoney

class EstadoTraslado(str, Enum):
    EN_TRANSITO = "EN_TRANSITO"
    COMPLETADO = "COMPLETADO"
    CANCELADO = "CANCELADO"

class DestinoTipo(str, Enum):
    SUCURSAL = "SUCURSAL"
    CLIENTE = "CLIENTE"

class TrasladoItem(BaseModel):
    producto_id: str
    descripcion: str
    cantidad_enviada: int = Field(gt=0)
    cantidad_recibida: Optional[int] = None
    costo_unitario: DecimalMoney
    valor_total: DecimalMoney

class TrasladoInventario(Document):
    tenant_id: str
    destino_tipo: DestinoTipo = DestinoTipo.SUCURSAL
    sucursal_origen_id: str
    sucursal_origen_nombre: str
    sucursal_destino_id: Optional[str] = None
    sucursal_destino_nombre: Optional[str] = None
    cliente_destino_id: Optional[str] = None
    cliente_destino_nombre: Optional[str] = None
    
    estado: EstadoTraslado = EstadoTraslado.EN_TRANSITO
    items: List[TrasladoItem]
    
    valor_total_enviado: DecimalMoney = DecimalMoney("0.0")
    valor_total_recibido: DecimalMoney = DecimalMoney("0.0")
    
    notas: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completado_at: Optional[datetime] = None
    cancelado_at: Optional[datetime] = None
    
    despachado_por_id: str
    despachado_por_nombre: str
    
    recibido_por_id: Optional[str] = None
    recibido_por_nombre: Optional[str] = None

    class Settings:
        name = "traslados_inventario"
        indexes = [
            "tenant_id",
            "sucursal_origen_id",
            "sucursal_destino_id",
            "estado",
            "created_at",
            [("tenant_id", 1), ("created_at", -1)]
        ]
