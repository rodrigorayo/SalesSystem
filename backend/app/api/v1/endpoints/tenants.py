from typing import List, Optional
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
    plan: str
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
    plan: str | None = None
    is_active: bool | None = None

class PlanCreate(BaseModel):
    name: str
    features: List[PlanFeature]
    precio_mensual: float = 0.0

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

    # Determine the PlanType and plan_id
    plan_code = tenant_in.plan
    try:
        plan_enum = PlanType(plan_code)
    except ValueError:
        plan_enum = PlanType.PERSONALIZADO
        
    plan_doc = await Plan.find_one(Plan.code == plan_code)
    plan_id = str(plan_doc.id) if plan_doc else None

    # Create Tenant
    tenant = Tenant(name=tenant_in.name, plan=plan_enum, plan_id=plan_id)
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
        plan_code = tenant_in.plan
        try:
            plan_enum = PlanType(plan_code)
        except ValueError:
            plan_enum = PlanType.PERSONALIZADO
            
        plan_doc = await Plan.find_one(Plan.code == plan_code)
        tenant.plan_id = str(plan_doc.id) if plan_doc else None
        tenant.plan = plan_enum
        
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


class TenantSettingsUpdate(BaseModel):
    ticket_footer: Optional[str] = None
    report_watermark: Optional[str] = None
    logo_base64: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None

@router.get("/tenants/me", response_model=Tenant)
async def get_my_tenant(current_user: User = Depends(get_current_active_user)):
    tenant_id = current_user.tenant_id
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    from beanie import PydanticObjectId
    tenant = await Tenant.get(PydanticObjectId(tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant

@router.put("/tenants/me/settings", response_model=Tenant)
async def update_my_tenant_settings(
    settings_in: TenantSettingsUpdate, 
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMIN_MATRIZ]:
        raise HTTPException(status_code=403, detail="Not authorized to change settings")
        
    tenant_id = current_user.tenant_id
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
        
    from beanie import PydanticObjectId
    tenant = await Tenant.get(PydanticObjectId(tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    if settings_in.ticket_footer is not None:
        tenant.settings.ticket_footer = settings_in.ticket_footer
    if settings_in.report_watermark is not None:
        tenant.settings.report_watermark = settings_in.report_watermark
    if settings_in.logo_base64 is not None:
        tenant.settings.logo_base64 = settings_in.logo_base64
    if settings_in.direccion is not None:
        tenant.settings.direccion = settings_in.direccion
    if settings_in.telefono is not None:
        tenant.settings.telefono = settings_in.telefono
        
    await tenant.save()
    return tenant

# ─── Admin: Seed Plans ───────────────────────────────────────────────────────

_PLAN_DEFINITIONS = [
    {
        "code": "BASICO",
        "name": "Plan Básico",
        "max_sucursales": 1,
        "max_usuarios": 5,
        "precio_mensual": "150.00",
        "is_public": True,
        "features": [
            PlanFeature.VENTAS, PlanFeature.INVENTARIO, PlanFeature.CAJA,
            PlanFeature.CLIENTES, PlanFeature.CREDITOS,
        ],
    },
    {
        "code": "PRO",
        "name": "Plan Profesional",
        "max_sucursales": 3,
        "max_usuarios": 20,
        "precio_mensual": "350.00",
        "is_public": True,
        "features": [
            PlanFeature.VENTAS, PlanFeature.INVENTARIO, PlanFeature.CAJA,
            PlanFeature.CAJA_AVANZADA, PlanFeature.CLIENTES, PlanFeature.CREDITOS,
            PlanFeature.DESCUENTOS_AVANZADOS, PlanFeature.LISTAS_PRECIOS,
            PlanFeature.PRICE_REQUESTS, PlanFeature.REPORTES_AVANZADOS, PlanFeature.AUDITORIA,
        ],
    },
    {
        "code": "ENTERPRISE",
        "name": "Plan Enterprise",
        "max_sucursales": -1,
        "max_usuarios": -1,
        "precio_mensual": "800.00",
        "is_public": True,
        "features": [
            PlanFeature.VENTAS, PlanFeature.INVENTARIO, PlanFeature.CAJA,
            PlanFeature.CAJA_AVANZADA, PlanFeature.CLIENTES, PlanFeature.CREDITOS,
            PlanFeature.DESCUENTOS_AVANZADOS, PlanFeature.LISTAS_PRECIOS,
            PlanFeature.PRICE_REQUESTS, PlanFeature.REPORTES_AVANZADOS, PlanFeature.AUDITORIA,
            PlanFeature.MULTI_SUCURSAL, PlanFeature.PEDIDOS_INTERNOS,
            PlanFeature.CONTROL_QR, PlanFeature.API_ACCESO,
        ],
    },
    {
        "code": "ILIMITADO",
        "name": "Plan Ilimitado (Interno)",
        "max_sucursales": -1,
        "max_usuarios": -1,
        "precio_mensual": "0.00",
        "is_public": False,
        "features": list(PlanFeature),
    },
]


@router.post("/tenants/admin/seed-plans")
async def seed_plans(current_user: User = Depends(get_current_active_user)):
    """
    [SUPERADMIN] Siembra los 4 planes base en MongoDB.
    Es idempotente: si el plan ya existe, lo actualiza; si no, lo crea.
    """
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    from decimal import Decimal
    results = []
    for plan_data in _PLAN_DEFINITIONS:
        existing = await Plan.find_one({"code": plan_data["code"]})
        if existing:
            existing.name           = plan_data["name"]
            existing.max_sucursales = plan_data["max_sucursales"]
            existing.max_usuarios   = plan_data["max_usuarios"]
            existing.precio_mensual = Decimal(plan_data["precio_mensual"])
            existing.is_public      = plan_data["is_public"]
            existing.features       = plan_data["features"]
            await existing.save()
            results.append({"code": plan_data["code"], "action": "updated"})
        else:
            plan = Plan(
                code            = plan_data["code"],
                name            = plan_data["name"],
                max_sucursales  = plan_data["max_sucursales"],
                max_usuarios    = plan_data["max_usuarios"],
                precio_mensual  = Decimal(plan_data["precio_mensual"]),
                is_public       = plan_data["is_public"],
                features        = plan_data["features"],
            )
            await plan.create()
            results.append({"code": plan_data["code"], "action": "created"})

    return {"ok": True, "results": results}


@router.post("/tenants/admin/assign-ilimitado")
async def assign_ilimitado_to_matriz(current_user: User = Depends(get_current_active_user)):
    """
    [SUPERADMIN] Busca el primer tenant (Matriz) y le asigna el plan ILIMITADO.
    """
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Buscar el plan ILIMITADO
    plan_ilimitado = await Plan.find_one({"code": "ILIMITADO"})
    if not plan_ilimitado:
        raise HTTPException(status_code=404, detail="Plan ILIMITADO no encontrado. Ejecuta seed-plans primero.")

    # Buscar el primer tenant
    matriz = await Tenant.find_one()
    if not matriz:
        raise HTTPException(status_code=404, detail="No hay tenants registrados en el sistema.")

    matriz.plan_id = str(plan_ilimitado.id)
    matriz.plan    = PlanType.ILIMITADO
    await matriz.save()

    return {
        "ok": True,
        "tenant": matriz.name,
        "plan_asignado": "ILIMITADO",
        "plan_id": str(plan_ilimitado.id),
    }


@router.get("/tenants/admin/list-plans")
async def list_plans(current_user: User = Depends(get_current_active_user)):
    """[SUPERADMIN] Lista todos los planes con sus features."""
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    plans = await Plan.find_all().to_list()
    return [{"id": str(p.id), "code": p.code, "name": p.name, "is_public": p.is_public, "precio_mensual": float(p.precio_mensual), "features": [f.value for f in p.features]} for p in plans]

@router.post("/tenants/admin/plans")
async def create_custom_plan(plan_data: PlanCreate, current_user: User = Depends(get_current_active_user)):
    """[SUPERADMIN] Crea un plan personalizado atómico."""
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    code = f"CUSTOM_{plan_data.name.upper().replace(' ', '_')}"
    new_plan = Plan(
        code=code,
        name=plan_data.name,
        max_sucursales=-1,
        max_usuarios=-1,
        features=plan_data.features,
        precio_mensual=plan_data.precio_mensual,
        is_active=True,
        is_public=True
    )
    await new_plan.save()
    return {"message": "Plan creado con éxito", "plan_id": str(new_plan.id)}

@router.delete("/tenants/admin/plans/{plan_id}")
async def delete_custom_plan(plan_id: str, current_user: User = Depends(get_current_active_user)):
    """[SUPERADMIN] Elimina un plan personalizado."""
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    plan = await Plan.get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
        
    if not plan.code.startswith("CUSTOM_"):
        raise HTTPException(status_code=400, detail="No puedes eliminar los planes del sistema")
        
    # Validar que ningún tenant lo esté usando
    in_use = await Tenant.find({"plan_id": plan_id}).count()
    if in_use > 0:
        raise HTTPException(status_code=400, detail="El plan está en uso por uno o más tenants")
        
    await plan.delete()
    return {"message": "Plan eliminado correctamente"}

