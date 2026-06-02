from enum import Enum
from datetime import datetime
from beanie import Document
from pydantic import Field

class PlanFeature(str, Enum):
    # ── Módulos core (disponibles desde el plan Básico) ──────────────────────
    VENTAS               = "VENTAS"               # POS + Historial de ventas
    INVENTARIO           = "INVENTARIO"           # Inventario + Catálogo
    CAJA                 = "CAJA"                 # Módulo de caja básico
    CLIENTES             = "CLIENTES"             # CRM de clientes
    CREDITOS             = "CREDITOS"             # Módulo de créditos

    # ── Módulos Pro ───────────────────────────────────────────────────────────
    CAJA_AVANZADA        = "CAJA_AVANZADA"        # Arqueo guiado, insights
    DESCUENTOS_AVANZADOS = "DESCUENTOS_AVANZADOS" # Descuentos y promociones
    LISTAS_PRECIOS       = "LISTAS_PRECIOS"       # Listas de precios y solicitudes
    REPORTES_AVANZADOS   = "REPORTES_AVANZADOS"   # Dashboard y reportes
    AUDITORIA            = "AUDITORIA"            # Log de anulaciones, auditoría

    # ── Módulos Enterprise ────────────────────────────────────────────────────
    MULTI_SUCURSAL       = "MULTI_SUCURSAL"       # Gestión de sucursales
    PEDIDOS_INTERNOS     = "PEDIDOS_INTERNOS"     # Pedidos matriz → sucursal
    CONTROL_QR           = "CONTROL_QR"           # Control de pagos QR
    API_ACCESO           = "API_ACCESO"           # Acceso a API externa
    PRICE_REQUESTS       = "PRICE_REQUESTS"       # Solicitudes de precio


class PlanFeatureDocument(Document):
    code: str
    name: str
    description: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "plan_features"
        indexes = ["code"]
