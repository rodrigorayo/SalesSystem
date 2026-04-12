from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
import re
from app.domain.models.tenant import Tenant, PlanType
from app.domain.models.plan import Plan
from app.domain.models.plan_feature import PlanFeature
from app.domain.models.user import User, UserRole
from app.domain.models.product import Product
from app.domain.models.sale import Sale
from app.infrastructure.auth import get_current_active_user, get_password_hash

router = APIRouter()

# ─── Todos los features disponibles (usado para ILIMITADO / sin plan) ──────────
ALL_FEATURES: List[str] = [f.value for f in PlanFeature]


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
@router.get("/tenants/my-features")
async def get_my_features(current_user: User = Depends(get_current_active_user)):
    """
    Returns the list of active feature flags for the current user's tenant.
    - SUPERADMIN: siempre tiene todos los módulos.
    - Tenant con plan ILIMITADO: todos los módulos.
    - Tenant sin plan_id asignado: todos los módulos (fallback seguro, no rompe legacy).
    - Tenant con plan específico: solo los módulos de ese plan.
    """
    # SUPERADMIN siempre ve todo
    if current_user.role == UserRole.SUPERADMIN:
        return {"features": ALL_FEATURES, "plan": "SUPERADMIN"}

    tenant_id = current_user.tenant_id
    if not tenant_id:
        return {"features": ALL_FEATURES, "plan": "NONE"}

    tenant = await Tenant.get(tenant_id)
    if not tenant:
        return {"features": ALL_FEATURES, "plan": "NONE"}

    # Plan ILIMITADO o plan no asignado → acceso total
    if not tenant.plan_id or tenant.plan == PlanType.ILIMITADO:
        return {"features": ALL_FEATURES, "plan": tenant.plan.value if tenant.plan else "NONE"}

    # Buscar el plan en la colección
    plan = await Plan.get(tenant.plan_id)
    if not plan:
        # Plan no encontrado → fallback seguro: acceso total
        return {"features": ALL_FEATURES, "plan": "UNKNOWN"}

    return {
        "features": [f.value for f in plan.features],
        "plan": plan.code,
        "plan_name": plan.name,
    }


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
    import re
    admin_username_lower = tenant_in.admin_username.lower()
    if await User.find_one({"username": re.compile(f"^{admin_username_lower}$", re.IGNORECASE)}):
        raise HTTPException(status_code=400, detail="Admin username already exists")

    # Create Tenant
    tenant = Tenant(name=tenant_in.name, plan=tenant_in.plan)
    await tenant.create()

    # Create Admin User for Tenant
    hashed_password = get_password_hash(tenant_in.admin_password)
    admin_user = User(
        username=admin_username_lower,
        email=admin_username_lower,
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
        
    # Hard delete the tenant for MVP cleanup
    await tenant.delete()
    
    # Cascade delete all related entities so credentials and codes are freed
    from app.domain.models.user import User
    from app.domain.models.product import Product
    from app.domain.models.category import Category
    from app.domain.models.sucursal import Sucursal
    from app.domain.models.inventario import Inventario, InventoryLog
    from app.domain.models.sale import Sale
    
    await User.find(User.tenant_id == tenant_id).delete()
    await Sucursal.find(Sucursal.tenant_id == tenant_id).delete()
    await Category.find(Category.tenant_id == tenant_id).delete()
    await Product.find(Product.tenant_id == tenant_id).delete()
    await Inventario.find(Inventario.tenant_id == tenant_id).delete()
    await InventoryLog.find(InventoryLog.tenant_id == tenant_id).delete()
    await Sale.find(Sale.tenant_id == tenant_id).delete()

    return {"message": "Tenant and all associated data deleted successfully"}
