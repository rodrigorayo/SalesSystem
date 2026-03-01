from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
import re
from app.models.tenant import Tenant, PlanType
from app.models.user import User, UserRole
from app.models.product import Product
from app.models.sale import Sale
from app.auth import get_current_active_user, get_password_hash

router = APIRouter()

# Schemas
class TenantCreate(BaseModel):
    name: str
    plan: PlanType
    admin_username: EmailStr
    admin_password: str = Field(
        ...,
        min_length=8,
        description="Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character."
    )

    @field_validator("admin_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r"[@$!%*?&#]", v):
            raise ValueError("Password must contain at least one special character (@$!%*?&#)")
        return v

class TenantUpdate(BaseModel):
    name: str | None = None
    plan: PlanType | None = None
    is_active: bool | None = None

# Endpoints
@router.get("/tenants", response_model=List[Tenant])
async def get_tenants(current_user: User = Depends(get_current_active_user)):
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    return await Tenant.find_all().to_list()

@router.post("/tenants", response_model=Tenant)
async def create_tenant(tenant_in: TenantCreate, current_user: User = Depends(get_current_active_user)):
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if tenant exists
    if await Tenant.find_one(Tenant.name == tenant_in.name):
        raise HTTPException(status_code=400, detail="Tenant name already exists")
    
    # Check if admin user exists
    if await User.find_one(User.username == tenant_in.admin_username):
        raise HTTPException(status_code=400, detail="Admin username already exists")

    # Create Tenant
    tenant = Tenant(name=tenant_in.name, plan=tenant_in.plan)
    await tenant.create()

    # Create Admin User for Tenant
    hashed_password = get_password_hash(tenant_in.admin_password)
    admin_user = User(
        username=tenant_in.admin_username,
        email=tenant_in.admin_username,
        hashed_password=hashed_password,
        role=UserRole.ADMIN,
        tenant_id=str(tenant.id),
        full_name=f"Admin {tenant.name}"
    )
    await admin_user.create()

    return tenant

@router.get("/tenants/stats")
async def get_tenant_stats(current_user: User = Depends(get_current_active_user)):
    """Returns key metrics for the current tenant's dashboard."""
    tenant_id = current_user.tenant_id or ""

    active_products = await Product.find(Product.tenant_id == tenant_id).count()
    active_employees = await User.find(
        User.tenant_id == tenant_id,
        User.role == UserRole.USER
    ).count()

    # Sum all sales totals for this tenant
    sales = await Sale.find(Sale.tenant_id == tenant_id).to_list()
    total_sales = sum(s.total for s in sales)

    return {
        "total_sales": total_sales,
        "active_products": active_products,
        "active_employees": active_employees,
    }

@router.put("/tenants/{tenant_id}", response_model=Tenant)
async def update_tenant(tenant_id: str, tenant_in: TenantUpdate, current_user: User = Depends(get_current_active_user)):
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    from beanie import PydanticObjectId
    tenant = await Tenant.get(PydanticObjectId(tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    if tenant_in.name is not None:
        # Check if another tenant has this name
        existing = await Tenant.find_one(Tenant.name == tenant_in.name)
        if existing and str(existing.id) != tenant_id:
            raise HTTPException(status_code=400, detail="Tenant name already exists")
        tenant.name = tenant_in.name
        
    if tenant_in.plan is not None:
        tenant.plan = tenant_in.plan
        
    if tenant_in.is_active is not None:
        tenant.is_active = tenant_in.is_active
        
    await tenant.save()
    return tenant

@router.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str, current_user: User = Depends(get_current_active_user)):
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    from beanie import PydanticObjectId
    tenant = await Tenant.get(PydanticObjectId(tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    # Hard delete the tenant for MVP cleanup (deletes only the tenant document, 
    # to be safe cascading can be implemented later)
    await tenant.delete()
    return {"message": "Tenant deleted successfully"}
