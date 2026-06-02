from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from beanie import Document
from enum import Enum
from .base import DecimalMoney

class ItemMovimientoB2B(BaseModel):
    producto_id: str
    producto_nombre: str
    codigo_corto: Optional[str] = None
    cantidad: int
    costo_unitario: DecimalMoney  # Costo Base de Fábrica
    precio_venta: DecimalMoney    # Precio final instituido para el supermercado

class EstadoReclamo(str, Enum):
    PENDIENTE = "PENDIENTE"
    COMPENSADO = "COMPENSADO"
    RECHAZADO = "RECHAZADO"

class NotaDevolucionMerma(Document):
    """
    Rastrea productos vencidos retornados por un Supermercado a la Sucursal.
    Automáticamente representa una Deuda a Favor contra Fábrica Taboada Central.
    """
    tenant_id: str
    sucursal_id: str
    supermercado_id: str  # Referencia FK a Clientes
    supermercado_nombre: str
    
    fecha_recuperacion: datetime = Field(default_factory=datetime.utcnow)
    items: List[ItemMovimientoB2B]
    
    # El monto total de pérdida que Taboada nos debe compensar basado en costo_unitario:
    costo_total_merma: DecimalMoney = DecimalMoney("0") 
    
    # Estado Contable del Reclamo a Fábrica:
    estado_reclamo: EstadoReclamo = EstadoReclamo.PENDIENTE
    fecha_compensacion: Optional[datetime] = None
    notas_agente: Optional[str] = None
    
    # Auditoría Interna
    registrado_por_user_id: str
    registrado_por_nombre: str
    
    class Settings:
        name = "b2b_notas_devolucion_merma"
        indexes = ["tenant_id", "sucursal_id", "estado_reclamo", "supermercado_id", "fecha_recuperacion"]

class EstadoTraspaso(str, Enum):
    PREPARADO = "PREPARADO"
    EN_RUTA = "EN_RUTA"
    ENTREGADO = "ENTREGADO"
    ANULADO = "ANULADO"

class NotaTraspaso(Document):
    """
    Rastrea el movimiento logístico: Sucursal -> Vehículo (Fuerza de Ventas) -> Supermercado.
    """
    tenant_id: str
    origen_sucursal_id: str
    destino_cliente_id: Optional[str] = None # Supermercado final.
    
    estado: EstadoTraspaso = EstadoTraspaso.PREPARADO
    
    responsable_id: str      # Quien lo maneja físicamente en calle (Agente)
    responsable_nombre: str
    
    items_despachados: List[ItemMovimientoB2B]
    monto_total_publico: DecimalMoney = DecimalMoney("0") # Suma para ventas
    
    fecha_despacho: datetime = Field(default_factory=datetime.utcnow)
    fecha_entrega: Optional[datetime] = None
    notas: Optional[str] = None
    
    class Settings:
        name = "b2b_notas_traspaso"
        indexes = ["tenant_id", "responsable_id", "estado", "destino_cliente_id"]

class InventarioMovilItem(BaseModel):
    producto_id: str
    producto_nombre: str
    codigo_corto: Optional[str] = None
    cantidad: int
    costo_unitario: DecimalMoney
    
class InventarioMovil(Document):
    """
    Mini-almacén temporal atado a un vendedor en calle. 
    Lleva el seguimiento estricto de sobrantes.
    """
    tenant_id: str
    responsable_id: str
    sucursal_origen_id: str
    items: List[InventarioMovilItem] = []
    
    class Settings:
        name = "b2b_almacenes_moviles"
        indexes = ["tenant_id", "responsable_id"]
