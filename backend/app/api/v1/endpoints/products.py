from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.models.product import Product
from app.models.category import Category
from app.models.user import User, UserRole
from app.auth import get_current_active_user

router = APIRouter()


class ProductCreate(BaseModel):
    descripcion: str
    categoria_id: str
    precio_venta: float
    costo_producto: float = 0.0
    codigo_largo: Optional[str] = None
    codigo_corto: Optional[str] = None
    image_url: Optional[str] = None


class ProductUpdate(BaseModel):
    descripcion: Optional[str] = None
    categoria_id: Optional[str] = None
    precio_venta: Optional[float] = None
    costo_producto: Optional[float] = None
    codigo_largo: Optional[str] = None
    codigo_corto: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None


async def _enrich(product: Product) -> Product:
    """Resolve categoria_nombre for display."""
    if product.categoria_id:
        cat = await Category.get(product.categoria_id)
        if cat:
            product.categoria_nombre = cat.name
    return product


@router.get("/products", response_model=List[Product])
async def get_products(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role == UserRole.SUPERADMIN:
        products = await Product.find_all().skip(skip).limit(limit).to_list()
    else:
        products = await Product.find(Product.tenant_id == current_user.tenant_id).skip(skip).limit(limit).to_list()
    return [await _enrich(p) for p in products]


@router.post("/products", response_model=Product)
async def create_product(
    data: ProductCreate,
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    tenant_id = current_user.tenant_id or "default"

    # Validate category belongs to tenant
    cat = await Category.get(data.categoria_id)
    if not cat or (current_user.role != UserRole.SUPERADMIN and cat.tenant_id != tenant_id):
        raise HTTPException(status_code=400, detail="Categoría no encontrada o no pertenece a tu empresa")

    # Validate codigo_corto uniqueness within tenant
    if data.codigo_corto:
        existing = await Product.find_one(
            Product.tenant_id == tenant_id,
            Product.codigo_corto == data.codigo_corto,
        )
        if existing:
            raise HTTPException(status_code=400, detail=f"El código corto '{data.codigo_corto}' ya existe en tu catálogo")

    product = Product(
        tenant_id=tenant_id,
        **data.model_dump(),
    )
    await product.create()
    return await _enrich(product)


@router.put("/products/{product_id}", response_model=Product)
async def update_product(
    product_id: str,
    data: ProductUpdate,
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    product = await Product.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if current_user.role != UserRole.SUPERADMIN and product.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Product not found")

    # Audit log
    from app.models.audit import AuditLog
    from app.models.cost_history import ProductCostHistory
    old = product.model_dump()
    updates = data.model_dump(exclude_none=True)
    changes = {k: {"old": old.get(k), "new": v} for k, v in updates.items() if old.get(k) != v}
    
    if changes:
        # P-02: Cost History Trigger
        if "costo_producto" in changes:
            await ProductCostHistory(
                tenant_id=product.tenant_id,
                producto_id=str(product.id),
                descripcion=product.descripcion,
                costo_anterior=old.get("costo_producto"),
                costo_nuevo=updates.get("costo_producto"),
                diferencia=round(updates.get("costo_producto") - old.get("costo_producto"), 4),
                motivo=None, # Motivo from Request could be added in schema later
                cambiado_por=str(current_user.id),
                cambiado_por_nombre=current_user.full_name or current_user.username
            ).create()

        await AuditLog(
            tenant_id=current_user.tenant_id,
            user_id=str(current_user.id),
            username=current_user.username,
            action="UPDATE", entity="PRODUCT",
            entity_id=product_id, details=changes,
        ).create()

    for field, value in updates.items():
        setattr(product, field, value)
    await product.save()
    return await _enrich(product)


@router.delete("/products/{product_id}")
async def deactivate_product(
    product_id: str,
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    product = await Product.get(product_id)
    if not product or (current_user.role != UserRole.SUPERADMIN and product.tenant_id != current_user.tenant_id):
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    await product.save()
    return {"message": "Product deactivated"}
