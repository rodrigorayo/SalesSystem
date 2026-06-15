from typing import Optional, List
from enum import Enum
from beanie import Document
from pydantic import Field
from datetime import datetime
from pydantic import Field, BaseModel

class WhatsAppSettings(BaseModel):
    enabled: bool = False
    provider: str = "GREENAPI"
    instance_id: Optional[str] = None
    api_token: Optional[str] = None
    default_message: str = "Hola {cliente}, adjuntamos el comprobante de tu compra por Bs. {total}. ¡Gracias por tu preferencia!"

class TenantSettings(BaseModel):
    whatsapp: WhatsAppSettings = Field(default_factory=WhatsAppSettings)
    ticket_footer: Optional[str] = "¡Gracias por su preferencia!"
    report_watermark: Optional[str] = "Sales System • Confidencial"
    logo_base64: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    brand_color: Optional[str] = "#4f46e5"
from .base import SoftDeleteMixin


class PlanType(str, Enum):
    BASICO     = "BASICO"
    PRO        = "PRO"
    ENTERPRISE = "ENTERPRISE"
    ILIMITADO  = "ILIMITADO"  # Plan interno, no se vende — clientes especiales
    PERSONALIZADO = "PERSONALIZADO" # Planes atómicos creados dinámicamente
    # Legacy
    BASIC      = "BASICO"

class RubroEmpresa(str, Enum):
    RETAIL = "RETAIL"
    DARK_KITCHEN = "DARK_KITCHEN"
    SERVICIOS = "SERVICIOS"

class Tenant(Document, SoftDeleteMixin):
    name: str
    plan_id: Optional[str] = None          # Ref to plans collection
    plan: PlanType = PlanType.BASICO
    plan_expires_at: Optional[datetime] = None
    settings: TenantSettings = Field(default_factory=TenantSettings)
    configuracion: dict = Field(default_factory=dict)
    rubro: RubroEmpresa = Field(default=RubroEmpresa.RETAIL)
    modulos_activos: List[str] = Field(default_factory=lambda: ["INVENTARIO", "POS", "KARDEX"])
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "tenants"
        indexes = [
            "name",
            "plan_id"
        ]
