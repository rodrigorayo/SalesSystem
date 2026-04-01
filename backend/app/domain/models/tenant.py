from typing import Optional
from enum import Enum
from beanie import Document
from pydantic import Field
from datetime import datetime

from .base import SoftDeleteMixin


class PlanType(str, Enum):
    BASIC = "BASIC"
    PRO = "PRO"

class Tenant(Document, SoftDeleteMixin):
    name: str
    plan_id: Optional[str] = None  # Ref to plans collection
    plan: PlanType = PlanType.BASIC  # Deprecated soon
    plan_expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "tenants"
        indexes = [
            "name",
            "plan_id"
        ]
