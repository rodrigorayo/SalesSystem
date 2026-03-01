from enum import Enum
from typing import Optional
from datetime import datetime
from beanie import Document
from pydantic import Field

class PlanFeature(str, Enum):
    MULTI_SUCURSAL       = "MULTI_SUCURSAL"
    REPORTES_AVANZADOS   = "REPORTES_AVANZADOS"
    API_ACCESO           = "API_ACCESO"
    PRICE_REQUESTS       = "PRICE_REQUESTS"
    PEDIDOS_INTERNOS     = "PEDIDOS_INTERNOS"
    DESCUENTOS_AVANZADOS = "DESCUENTOS_AVANZADOS"
    CLIENTES             = "CLIENTES"
    LISTAS_PRECIOS       = "LISTAS_PRECIOS"

class PlanFeatureDocument(Document):
    code: str
    name: str
    description: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "plan_features"
        indexes = ["code"]
