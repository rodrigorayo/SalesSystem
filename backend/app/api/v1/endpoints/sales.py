from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from app.models.sale import Sale, ClienteInfo, PagoItem, SaleItem, DescuentoInfo
from app.models.sale_item import SaleItem as SaleItemAnalytics
from app.models.product import Product
from app.models.inventario import Inventario, InventoryLog, TipoMovimiento
from app.models.caja import CajaMovimiento, CajaSesion, EstadoSesion, SubtipoMovimiento
from app.models.user import User, UserRole
from app.auth import get_current_active_user
from pymongo import ReturnDocument

router = APIRouter()


# ─── Request schemas ──────────────────────────────────────────────────────────

class SaleItemIn(BaseModel):
    producto_id: str
    cantidad: int
    precio_unitario: float = 0.0  # if 0, falls back to product.precio_venta
    descuento_unitario: float = 0.0


class PagoIn(BaseModel):
    metodo: str                 # 'EFECTIVO' | 'QR' | 'TARJETA'
    monto: float


class ClienteIn(BaseModel):
    nit: Optional[str] = None
    razon_social: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    es_factura: bool = False


class SaleCreate(BaseModel):
    sucursal_id: Optional[str] = None
    items: List[SaleItemIn]
    pagos: List[PagoIn] = []        # split payments
    descuento: Optional[DescuentoInfo] = None
    cliente_id: Optional[str] = None
    cliente: Optional[ClienteIn] = None


# ─── POST /ventas ─────────────────────────────────────────────────────────────

@router.post("/ventas", response_model=Sale)
@router.post("/sales", response_model=Sale)   # legacy alias
async def create_sale_endpoint(
    sale_in: SaleCreate,
    current_user: User = Depends(get_current_active_user)
):
    try:
        return await _create_sale_internal(sale_in, current_user)
    except Exception as e:
        import traceback
        with open("c:/Users/rodri/Desktop/SalesSystem/backend/last_sale_error.txt", "w", encoding="utf-8") as f:
            f.write(traceback.format_exc())
            f.write(f"\nPayload entrante: {sale_in.model_dump()}\n")
        raise e

async def _create_sale_internal(sale_in: SaleCreate, current_user: User):
    """
    POS creates a sale:
    - Validates & deducts stock from the branch's Inventario.
    - Supports split payments (multiple methods in one transaction).
    - Optionally stores invoice/client data.
    - Auto-registers a CajaMovimiento (INGRESO) for each payment method.
    """
    tenant_id = current_user.tenant_id or "default"
    sucursal_id = current_user.sucursal_id or sale_in.sucursal_id or "CENTRAL"

    # ── 1. Validate payments cover the total (optional server-side guard) ─────
    # We allow mismatch here and let the frontend enforce it, but we still
    # persist whatever comes in (the POS store already validates client-side).

    # ── 2. Build sale items & deduct inventory ─────────────────────────────────
    sale_items: List[SaleItem] = []
    computed_total = 0.0

    for item in sale_in.items:
        product = await Product.get(item.producto_id)
        if not product or product.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail=f"Producto {item.producto_id} no encontrado")

        from pymongo import ReturnDocument
        from app.models.inventario import InventoryLog, TipoMovimiento

        # Atomic update to avoid race conditions:
        # We only decrement if current cantidad is >= item.cantidad
        updated_inv = await Inventario.get_pymongo_collection().find_one_and_update(
            {
                "tenant_id": tenant_id,
                "sucursal_id": sucursal_id,
                "producto_id": item.producto_id,
                "cantidad": {"$gte": item.cantidad}
            },
            {
                "$inc": {"cantidad": -item.cantidad}
            },
            return_document=ReturnDocument.AFTER
        )

        if not updated_inv:
            # If nothing was modified, it means either the product isn't in this branch,
            # or the stock is insufficient. We do a quick check to provide a good error message.
            inv_check = await Inventario.find_one(
                Inventario.tenant_id == tenant_id,
                Inventario.sucursal_id == sucursal_id,
                Inventario.producto_id == item.producto_id,
            )
            available = inv_check.cantidad if inv_check else 0
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para '{product.descripcion}'. Disponible: {available}, solicitado: {item.cantidad}",
            )

        from app.utils.pricing import resolver_precio
        unit_price_base = item.precio_unitario
        if unit_price_base == 0:
            if updated_inv and updated_inv.get("precio_sucursal") is not None:
                unit_price_base = updated_inv["precio_sucursal"]
            else:
                unit_price_base = product.precio_venta

        # D-08: Resolve price based on customer lists
        unit_price = await resolver_precio(
            producto_id=str(product.id),
            precio_base=unit_price_base,
            cliente_id=sale_in.cliente_id,
            cantidad=item.cantidad,
            tenant_id=tenant_id
        )

        # Apply line discount (manual override)
        final_unit_price = max(0.0, unit_price - item.descuento_unitario)
        subtotal = final_unit_price * item.cantidad
        computed_total += subtotal

        sale_items.append(SaleItem(
            producto_id=str(product.id),
            descripcion=product.descripcion,
            cantidad=item.cantidad,
            precio_unitario=unit_price,
            costo_unitario=product.costo_producto,
            descuento_unitario=item.descuento_unitario,
            subtotal=subtotal,
        ))

        # Record moving in Kardex (P-03)
        await InventoryLog(
            tenant_id=tenant_id,
            sucursal_id=sucursal_id,
            producto_id=item.producto_id,
            descripcion=product.descripcion,
            tipo_movimiento=TipoMovimiento.VENTA,
            cantidad_movida=-item.cantidad,
            stock_resultante=updated_inv["cantidad"],
            costo_unitario_momento=product.costo_producto,
            precio_venta_momento=unit_price,
            usuario_id=str(current_user.id),
            usuario_nombre=current_user.full_name or current_user.username,
            notas="Salida por Venta POS",
            referencia_id="PENDING" # Will update if needed, but for now PENDING is fine or link after sale.create()
        ).create()

        # Record for Analytics (Phase 2)
        await SaleItemAnalytics(
            tenant_id=tenant_id,
            sucursal_id=sucursal_id,
            sale_id="PENDING", # Will update after sale.create()
            sale_date=datetime.utcnow(),
            producto_id=str(product.id),
            descripcion=product.descripcion,
            cantidad=item.cantidad,
            precio_unitario=unit_price,
            costo_unitario=product.costo_producto,
            descuento_unitario=item.descuento_unitario, # New field
            subtotal=subtotal
        ).create()

    # Apply discount to total if any
    if sale_in.descuento:
        val = sale_in.descuento.valor
        if sale_in.descuento.tipo == 'MONTO':
            computed_total -= val
        elif sale_in.descuento.tipo == 'PORCENTAJE':
            computed_total -= (computed_total * val / 100)
        computed_total = max(0.0, computed_total)
        
    # Manual commercial rounding (Handling physical coins)
    import math
    int_part = math.floor(computed_total)
    frac = computed_total - int_part
    frac_fixed = round(frac, 2)

    if frac_fixed < 0.5:
        computed_total = float(int_part)
    elif frac_fixed > 0.5:
        computed_total = float(int_part + 1)
    else:
        computed_total = float(int_part) + 0.5
        
    pagos = [PagoItem(metodo=p.metodo, monto=p.monto) for p in sale_in.pagos]
    cliente_snap = ClienteInfo(**sale_in.cliente.model_dump()) if sale_in.cliente else None

    sale = Sale(
        tenant_id=tenant_id,
        sucursal_id=sucursal_id,
        items=sale_items,
        total=computed_total,
        pagos=pagos,
        descuento=sale_in.descuento,
        cliente_id=sale_in.cliente_id,
        cliente=cliente_snap,
        cashier_id=str(current_user.id),
        cashier_name=current_user.full_name or current_user.username,
    )
    await sale.create()

    # Update the analytics and kardex records with the real sale ID
    await SaleItemAnalytics.find(
        SaleItemAnalytics.tenant_id == tenant_id,
        SaleItemAnalytics.sale_id == "PENDING"
    ).update({"$set": {"sale_id": str(sale.id)}})

    await InventoryLog.find(
        InventoryLog.tenant_id == tenant_id,
        InventoryLog.referencia_id == "PENDING"
    ).update({"$set": {"referencia_id": str(sale.id)}})

    # D-07: Update customer totals
    if sale.cliente_id:
        from app.models.cliente import Cliente
        from beanie.operators import Inc, Set
        await Cliente.get(sale.cliente_id).update(
            Inc({Cliente.total_compras: sale.total}),
            Inc({Cliente.cantidad_compras: 1}),
            Set({Cliente.ultima_compra_at: sale.created_at})
        )

    # ── 4. Auto-register CajaMovimientos (all payment methods) ────────────────
    from app.models.caja import CajaSesion, CajaMovimiento, EstadoSesion, SubtipoMovimiento

    # Subtipo map: method name → SubtipoMovimiento
    _SUBTIPO_MAP = {
        "EFECTIVO": SubtipoMovimiento.VENTA_EFECTIVO,
        "QR":       SubtipoMovimiento.VENTA_QR,
        "TARJETA":  SubtipoMovimiento.VENTA_TARJETA,
    }

    # Find the active cash session for this branch (may not exist — that's OK)
    sesion = await CajaSesion.find_one(
        CajaSesion.tenant_id   == tenant_id,
        CajaSesion.sucursal_id == sucursal_id,
        CajaSesion.estado      == EstadoSesion.ABIERTA,
    )

    cajero_id   = str(current_user.id)
    cajero_name = current_user.full_name or current_user.username
    sale_id_str = str(sale.id)

    if sesion:
        total_pagado = 0.0

        for pago in pagos:
            metodo  = str(pago.metodo).upper()
            monto_p = float(pago.monto)
            total_pagado += monto_p
            subtipo = _SUBTIPO_MAP.get(metodo, SubtipoMovimiento.VENTA_EFECTIVO)

            label = {"EFECTIVO": "Efectivo", "QR": "QR", "TARJETA": "Tarjeta"}.get(metodo, metodo)
            await CajaMovimiento(
                tenant_id   = tenant_id,
                sucursal_id = sucursal_id,
                sesion_id   = str(sesion.id),
                cajero_id   = cajero_id,
                cajero_name = cajero_name,
                subtipo     = subtipo,
                tipo        = "INGRESO",
                monto       = monto_p,
                descripcion = f"Venta #{sale_id_str[-6:]} — {label}",
                sale_id     = sale_id_str,
            ).create()

        # Cambio = total pagado (todos los métodos) - total venta
        # Change is ALWAYS given back in cash, regardless of payment mix.
        cambio = round(total_pagado - computed_total, 2)
        if cambio > 0.005:
            await CajaMovimiento(
                tenant_id   = tenant_id,
                sucursal_id = sucursal_id,
                sesion_id   = str(sesion.id),
                cajero_id   = cajero_id,
                cajero_name = cajero_name,
                subtipo     = SubtipoMovimiento.CAMBIO,
                tipo        = "EGRESO",
                monto       = cambio,
                descripcion = f"Venta #{sale_id_str[-6:]} — Cambio entregado",
                sale_id     = sale_id_str,
            ).create()

        return sale

# ─── GET /sales/stats/today ───────────────────────────────────────────────────

@router.get("/sales/stats/today")
async def get_today_stats(
    sucursal_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """Today's total sales and transaction count for the current tenant."""
    today = datetime.utcnow().date()
    tenant_id = current_user.tenant_id or ""
    
    filters = [Sale.tenant_id == tenant_id]
    if sucursal_id:
        filters.append(Sale.sucursal_id == sucursal_id)
        
    all_sales = await Sale.find(*filters).to_list()
    # Filter by date and NOT voided
    today_sales = [s for s in all_sales if s.created_at.date() == today and not s.anulada]
    
    return {
        "today_sales": sum(s.total for s in today_sales),
        "transaction_count": len(today_sales),
    }


# ─── GET /sales ───────────────────────────────────────────────────────────────

@router.get("/sales", response_model=List[Sale])
async def get_sales(
    sucursal_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user)
):
    """List all sales for the tenant, optionally filtered by sucursal with pagination."""
    filters = []
    
    # Superadmins bypass primary tenant filter to see everything
    if current_user.role != UserRole.SUPERADMIN:
        tenant_id = current_user.tenant_id or ""
        filters.append(Sale.tenant_id == tenant_id)
        
    if sucursal_id:
        filters.append(Sale.sucursal_id == sucursal_id)
        
    # Superadmins / Matriz see all based on filter, Sucursal sees only theirs
    if current_user.role == UserRole.ADMIN_SUCURSAL:
        if sucursal_id and sucursal_id != current_user.sucursal_id:
            raise HTTPException(status_code=403, detail="Cannot view sales of another branch")
        filters.append(Sale.sucursal_id == current_user.sucursal_id)

    # Cashiers can ONLY see their own generated sales
    if current_user.role == UserRole.CAJERO:
        filters.append(Sale.cashier_id == str(current_user.id))

    sales = await Sale.find(*filters).sort(-Sale.created_at).skip(skip).limit(limit).to_list()
    return sales


# ─── PATCH /sales/{sale_id}/anular ────────────────────────────────────────────

@router.patch("/sales/{sale_id}/anular", response_model=Sale)
async def anular_sale(
    sale_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Voids a sale:
    - Sets anulada = True
    - Restores inventory stock and logs to Kardex
    - Auto-registers an EGRESO in the active cash register session to cancel the income.
    """
    if current_user.role not in [UserRole.ADMIN_SUCURSAL, UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="No tienes permiso para anular ventas")

    sale = await Sale.get(sale_id)
    if not sale or sale.tenant_id != (current_user.tenant_id or "default"):
        raise HTTPException(status_code=404, detail="Sale not found")
        
    if sale.anulada:
        raise HTTPException(status_code=400, detail="La venta ya está anulada")

    if current_user.role == UserRole.ADMIN_SUCURSAL and sale.sucursal_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="Solo puedes anular ventas de tu propia sucursal")

    tenant_id = sale.tenant_id
    sucursal_id = sale.sucursal_id

    # 1. Restore Inventory
    for item in sale.items:
        # Restore stock using atomic increment
        updated_inv = await Inventario.get_pymongo_collection().find_one_and_update(
            {
                "tenant_id": tenant_id,
                "sucursal_id": sucursal_id,
                "producto_id": item.producto_id,
            },
            {
                "$inc": {"cantidad": item.cantidad}
            },
            return_document=ReturnDocument.AFTER
        )
        if updated_inv:
            await InventoryLog(
                tenant_id=tenant_id,
                sucursal_id=sucursal_id,
                producto_id=item.producto_id,
                tipo_movimiento=TipoMovimiento.ENTRADA_MANUAL,
                cantidad_movida=item.cantidad,
                stock_resultante=updated_inv["cantidad"],
                usuario_id=str(current_user.id),
                usuario_nombre=current_user.full_name or current_user.username,
                notas=f"Anulación de Venta #{str(sale.id)[-6:]}",
                referencia_id=str(sale.id)
            ).create()

    # 2. Add an Egreso to the active session to cancel the monetary ingress 
    # (assuming all was mapped correctly, we just do a generic refund movement)
    sesion = await CajaSesion.find_one(
        CajaSesion.tenant_id   == tenant_id,
        CajaSesion.sucursal_id == sucursal_id,
        CajaSesion.estado      == EstadoSesion.ABIERTA,
    )
    if sesion:
        await CajaMovimiento(
            tenant_id   = tenant_id,
            sucursal_id = sucursal_id,
            sesion_id   = str(sesion.id),
            cajero_id   = str(current_user.id),
            cajero_name = current_user.full_name or current_user.username,
            subtipo     = SubtipoMovimiento.AJUSTE,
            tipo        = "EGRESO",
            monto       = sale.total,
            descripcion = f"Anulación de Venta #{str(sale.id)[-6:]} (Reembolso)",
            sale_id     = str(sale.id),
        ).create()
        
    # 3. Mark as anulada
    sale.anulada = True
    await sale.save()
    
    return sale


# ─── PATCH /sales/{sale_id}/factura ───────────────────────────────────────────

@router.patch("/sales/{sale_id}/factura", response_model=Sale)
async def toggle_factura_emitida(
    sale_id: str,
    emitida: bool,
    current_user: User = Depends(get_current_active_user)
):
    """
    Toggles the factura_emitida status of a sale.
    """
    sale = await Sale.get(sale_id)
    if not sale or sale.tenant_id != (current_user.tenant_id or "default"):
        raise HTTPException(status_code=404, detail="Sale not found")
        
    if current_user.role == UserRole.ADMIN_SUCURSAL and sale.sucursal_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="Solo puedes editar ventas de tu propia sucursal")
        
    sale.factura_emitida = emitida
    await sale.save()
    
    return sale
