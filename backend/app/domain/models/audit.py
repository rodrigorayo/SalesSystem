from typing import Optional, Dict, Any
from beanie import Document
from pydantic import Field
from datetime import datetime

from pymongo import IndexModel


class AuditLog(Document):
    tenant_id: str
    user_id: str
    username: str
    action: str  # CREATE, UPDATE, DELETE
    entity: str  # PRODUCT, USER, TENANT
    entity_id: str
    details: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "audit_logs"
        indexes = [
            "tenant_id",
            "entity",
            IndexModel([("created_at", 1)], expireAfterSeconds=7776000), # 90 days
            IndexModel([("tenant_id", 1), ("created_at", -1)]),
        ]
