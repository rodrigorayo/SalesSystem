from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.models.inventario import Inventario
from app.models.product import Product
from app.models.user import User, UserRole
from app.auth import get_current_active_user

router = APIRouter()


class InventarioItem(BaseModel):
    """Inventory entry enriched with product details for display."""
    inventario_id: str
    producto_id: str
    producto_nombre: str
    precio: float
    precio_sucursal: Optional[float] = None
    image_url: Optional[str] = None
    sucursal_id: str
    cantidad: int


class AjusteInventario(BaseModel):
    producto_id: str
    tipo: str      # 'ENTRADA', 'SALIDA', 'AJUSTE'
    cantidad: int  # Must be positive (absolute value of change)
    notas: str = ""


@router.get("/inventario", response_model=List[InventarioItem])
async def get_inventario(
    sucursal_id: str = "CENTRAL",
    current_user: User = Depends(get_current_active_user)
):
    """
    Get inventory for a specific sucursal (or CENTRAL).
    Automatically scoped to the user's tenant.
    """
    tenant_id = current_user.tenant_id or ""
    entries = await Inventario.find(
        Inventario.tenant_id == tenant_id,
        Inventario.sucursal_id == sucursal_id,
    ).to_list()

    result = []
    for entry in entries:
        product = await Product.get(entry.producto_id)
        if product:
            result.append(InventarioItem(
                inventario_id=str(entry.id),
                producto_id=str(product.id),
                producto_nombre=product.descripcion,
                precio=product.precio_venta,
                precio_sucursal=entry.precio_sucursal,
                image_url=product.image_url,
                sucursal_id=entry.sucursal_id,
                cantidad=entry.cantidad,
            ))
    return result



@router.post("/inventario/ajuste")
async def ajustar_inventario(
    ajuste: AjusteInventario,
    sucursal_id: str = "CENTRAL",
    current_user: User = Depends(get_current_active_user)
):
    """
    Manually adjust inventory (add/remove/set stock).
    ADMIN_MATRIZ for CENTRAL, ADMIN_SUCURSAL for their branch.
    """
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if ajuste.cantidad < 0:
        raise HTTPException(status_code=400, detail="La cantidad del ajuste debe ser un valor absoluto (positivo o cero).")

    tenant_id = current_user.tenant_id or ""

    # Verify product belongs to tenant
    product = await Product.get(ajuste.producto_id)
    if not product or (current_user.role != UserRole.SUPERADMIN and product.tenant_id != tenant_id):
        raise HTTPException(status_code=404, detail="Product not found")

    entry = await Inventario.find_one(
        Inventario.tenant_id == tenant_id,
        Inventario.sucursal_id == sucursal_id,
        Inventario.producto_id == ajuste.producto_id,
    )

    stock_anterior = entry.cantidad if entry else 0
    cantidad_cambio = 0
    
    from app.models.inventario import TipoMovimiento, InventoryLog

    if ajuste.tipo == "ENTRADA":
        nuevo_stock = stock_anterior + ajuste.cantidad
        cantidad_cambio = ajuste.cantidad
        tipo_mov = TipoMovimiento.ENTRADA_MANUAL
    elif ajuste.tipo == "SALIDA":
        nuevo_stock = max(0, stock_anterior - ajuste.cantidad)
        cantidad_cambio = nuevo_stock - stock_anterior  # will be negative
        tipo_mov = TipoMovimiento.SALIDA_MANUAL
    elif ajuste.tipo == "AJUSTE":
        nuevo_stock = ajuste.cantidad
        cantidad_cambio = nuevo_stock - stock_anterior
        tipo_mov = TipoMovimiento.AJUSTE_FISICO
    else:
        raise HTTPException(status_code=400, detail="Tipo de ajuste inválido (ENTRADA, SALIDA, AJUSTE)")

    if entry:
        entry.cantidad = nuevo_stock
        await entry.save()
    else:
        entry = Inventario(
            tenant_id=tenant_id,
            sucursal_id=sucursal_id,
            producto_id=ajuste.producto_id,
            cantidad=nuevo_stock,
        )
        await entry.create()

    # Guardar en Kárdex (Log Inmutable)
    if cantidad_cambio != 0:
        log = InventoryLog(
            tenant_id=tenant_id,
            sucursal_id=sucursal_id,
            producto_id=ajuste.producto_id,
            tipo_movimiento=tipo_mov,
            cantidad_movida=cantidad_cambio,
            stock_resultante=nuevo_stock,
            usuario_id=str(current_user.id),
            usuario_nombre=current_user.username,
            notas=ajuste.notas
        )
        await log.create()

    return {"sucursal_id": sucursal_id, "producto_id": ajuste.producto_id, "cantidad": entry.cantidad, "movimiento": cantidad_cambio}


@router.get("/inventario/movimientos")
async def get_movimientos(
    producto_id: str = None,
    sucursal_id: str = "CENTRAL",
    limit: int = 50,
    current_user: User = Depends(get_current_active_user)
):
    """
    Get the movement history (Kárdex) for a specific branch and optionally filtered by product.
    """
    tenant_id = current_user.tenant_id or ""
    
    query = {"tenant_id": tenant_id, "sucursal_id": sucursal_id}
    if producto_id:
        query["producto_id"] = producto_id
        
    from app.models.inventario import InventoryLog
    
    movimientos = await InventoryLog.find(query).sort("-created_at").limit(limit).to_list()
    
    # Enrich with product names for UI
    result = []
    for mov in movimientos:
        prod = await Product.get(mov.producto_id)
        data = mov.model_dump()
        data["producto_nombre"] = prod.descripcion if prod else "Producto Desconocido"
        result.append(data)
        
    return result
