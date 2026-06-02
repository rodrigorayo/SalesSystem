from .base import DecimalMoney
from typing import List
from beanie import Document
from pydantic import Field
from datetime import datetime
from .plan_feature import PlanFeature

class Plan(Document):
    code: str            # "BASICO", "PRO", "ENTERPRISE", "ILIMITADO"
    name: str
    max_sucursales: int  # -1 = ilimitado
    max_usuarios: int    # -1 = ilimitado
    features: List[PlanFeature] = []
    precio_mensual: DecimalMoney = DecimalMoney("0.0")
    is_active: bool = True
    is_public: bool = True   # False = no se muestra en la página de precios (ej. ILIMITADO)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "plans"
        indexes = ["code"]
