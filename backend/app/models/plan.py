from typing import List
from beanie import Document
from pydantic import Field
from datetime import datetime
from .plan_feature import PlanFeature

class Plan(Document):
    code: str            # "BASIC", "PRO", "ENTERPRISE"
    name: str
    max_sucursales: int  # -1 = ilimitado
    max_usuarios: int
    features: List[PlanFeature] = []
    precio_mensual: float = 0.0
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "plans"
        indexes = ["code"]
