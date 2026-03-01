from typing import Optional
from enum import Enum
from beanie import Document, Indexed
from pydantic import Field, EmailStr
from datetime import datetime


from .base import SoftDeleteMixin
from pymongo import IndexModel


class UserRole(str, Enum):
    SUPERADMIN = "SUPERADMIN"       # SaaS Owner
    ADMIN_MATRIZ = "ADMIN_MATRIZ"   # Tenant Matrix Admin (owns the business)
    ADMIN_SUCURSAL = "ADMIN_SUCURSAL"  # Branch Admin
    CAJERO = "CAJERO"               # POS Cashier
    # Legacy aliases for backward compatibility
    ADMIN = "ADMIN_MATRIZ"
    USER = "CAJERO"


class User(Document, SoftDeleteMixin):
    username: str
    email: Optional[EmailStr] = None
    hashed_password: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.CAJERO
    tenant_id: Optional[str] = None    # Links to Tenant (Empresa)
    sucursal_id: Optional[str] = None  # Links to Sucursal, None = Matriz level
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
        indexes = [
            IndexModel([("tenant_id", 1), ("username", 1)], unique=True),
            IndexModel(
                [("tenant_id", 1), ("email", 1)], 
                unique=True, 
                partialFilterExpression={"email": {"$type": "string"}}
            ),
            IndexModel([("sucursal_id", 1)]),
        ]
