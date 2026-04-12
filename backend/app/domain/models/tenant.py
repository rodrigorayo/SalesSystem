from typing import Optional, List
from enum import Enum
from beanie import Document
from pydantic import Field
from datetime import datetime

from .base import SoftDeleteMixin


class PlanType(str, Enum):
    BASICO     = "BASICO"
    PRO        = "PRO"
    ENTERPRISE = "ENTERPRISE"
    ILIMITADO  = "ILIMITADO"  # Plan interno, no se vende — clientes especiales
    # Legacy
    BASIC      = "BASICO"

class Tenant(Document, SoftDeleteMixin):
    name: str
    plan_id: Optional[str] = None          # Ref to plans collection
    plan: PlanType = PlanType.BASICO
    plan_expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "tenants"
        indexes = [
            "name",
            "plan_id"
        ]
