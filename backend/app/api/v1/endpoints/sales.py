from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.models.sale import Sale, ClienteInfo, PagoItem, SaleItem
from app.models.sale_item import SaleItem as SaleItemAnalytics
from app.models.product import Product
from app.models.inventario import Inventario, InventoryLog, TipoMovimiento
from app.models.caja import CajaMovimiento, CajaSesion, EstadoSesion, SubtipoMovimiento
from app.models.user import User, UserRole
from app.auth import get_current_active_user
from pymongo import ReturnDocument

router = APIRouter()


from app.schemas.sale import SaleCreate, SalesPaginated
from app.services.sales_service import SalesService

from app.services.sales_service import SalesService

@router.post("/ventas", response_model=Sale)
@router.post("/sales", response_model=Sale)
async def create_sale_endpoint(
    sale_in: SaleCreate,
    current_user: User = Depends(get_current_active_user)
):
    return await SalesService.create_sale(sale_in, current_user)

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

@router.get("/sales", response_model=SalesPaginated)
async def get_sales(
    sucursal_id: Optional[str] = None,
    metodo_pago: Optional[str] = None,
    estado_pago: Optional[str] = None,
    solo_facturas: bool = False,
    qr_confirmed: Optional[bool] = None,
    page: int = 1,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user)
):
    """List all sales for the tenant, optionally filtered by sucursal, payment method or invoice status with pagination."""
    filters = []
    
    # Superadmins bypass primary tenant filter to see everything
    if current_user.role != UserRole.SUPERADMIN:
        tenant_id = current_user.tenant_id or "default"
        filters.append(Sale.tenant_id == tenant_id)
        
    if sucursal_id:
        filters.append(Sale.sucursal_id == sucursal_id)

    if metodo_pago:
        # Filter sales where at least one payment method matches
        filters.append({"pagos.metodo": metodo_pago.upper()})
        
    if estado_pago:
        if estado_pago.upper() == "DEUDA":
            from beanie.operators import In
            filters.append(In(Sale.estado_pago, ["PENDIENTE", "PARCIAL"]))
        else:
            filters.append(Sale.estado_pago == estado_pago.upper())

    if qr_confirmed is not None:
        filters.append(Sale.qr_info.confirmado == qr_confirmed)

    if solo_facturas:
        # Filter sales where customer requested invoice (NIT present and not empty, OR es_factura flag)
        from beanie.operators import Or, And
        filters.append(Or(
            And(Sale.cliente.nit != None, Sale.cliente.nit != ""),
            Sale.cliente.es_factura == True
        ))
        
    # Superadmins / Matriz see all based on filter, Sucursal sees only theirs
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR]:
        if sucursal_id and sucursal_id != current_user.sucursal_id:
            raise HTTPException(status_code=403, detail="Cannot view sales of another branch")
        filters.append(Sale.sucursal_id == current_user.sucursal_id)

    # Cashiers can ONLY see their own generated sales
    if current_user.role == UserRole.CAJERO:
        filters.append(Sale.cashier_id == str(current_user.id))

    skip = (page - 1) * limit
    
    query = Sale.find(*filters)
    total = await query.count()
    sales = await query.sort(-Sale.created_at).skip(skip).limit(limit).to_list()
    
    import math
    return {
        "items": sales,
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if limit > 0 else 1
    }


# ─── PATCH /sales/{sale_id}/anular ────────────────────────────────────────────

@router.patch("/sales/{sale_id}/anular", response_model=Sale)
async def anular_sale(
    sale_id: str,
    current_user: User = Depends(get_current_active_user)
):
    return await SalesService.anular_sale(sale_id, current_user)

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
        
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR] and sale.sucursal_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="Solo puedes editar ventas de tu propia sucursal")
        
    sale.factura_emitida = emitida
    await sale.save()
    
    return sale


# ─── PATCH /sales/{sale_id}/qr ────────────────────────────────────────────────

class QRInfoUpdate(BaseModel):
    banco: str
    referencia: str
    monto_transferido: float

@router.patch("/sales/{sale_id}/qr", response_model=Sale)
async def update_qr_info(
    sale_id: str,
    qr_data: QRInfoUpdate,
    current_user: User = Depends(get_current_active_user)
):
    """
    Updates the QR payment tracking info (Bank, Reference, Amount) and marks it as confirmed.
    """
    sale = await Sale.get(sale_id)
    if not sale or sale.tenant_id != (current_user.tenant_id or "default"):
        raise HTTPException(status_code=404, detail="Sale not found")
        
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR] and sale.sucursal_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="Solo puedes confirmar pagos de tu propia sucursal")
        
    if not sale.qr_info:
        from app.models.sale import QRInfo
        sale.qr_info = QRInfo()
        
    sale.qr_info.banco = qr_data.banco
    sale.qr_info.referencia = qr_data.referencia
    sale.qr_info.monto_transferido = qr_data.monto_transferido
    sale.qr_info.confirmado = True
    sale.qr_info.confirmado_at = datetime.utcnow()
    sale.qr_info.confirmado_por = current_user.full_name or current_user.username
    
    await sale.save()
    
    return sale

from app.schemas.sale import AbonoCreate
from app.models.sale import EstadoPago

@router.post("/sales/{sale_id}/abono", response_model=Sale)
async def registrar_abono(sale_id: str, abono: AbonoCreate, current_user: User = Depends(get_current_active_user)):
    """
    Registers a partial layout (amortization) to an active debt in a sale.
    """
    sale = await Sale.get(sale_id)
    if not sale or sale.tenant_id != (current_user.tenant_id or "default"):
        raise HTTPException(status_code=404, detail="Sale not found")
        
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR] and sale.sucursal_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="No puedes abonar a ventas de otras sucursales")
        
    if sale.estado_pago == EstadoPago.PAGADO:
        raise HTTPException(status_code=400, detail="Esta venta ya está completamente pagada.")
        
    # Append the payment
    nuevo_pago = PagoItem(metodo=abono.metodo, monto=abono.monto)
    if not sale.pagos:
        sale.pagos = []
    sale.pagos.append(nuevo_pago)
    
    # Recalculate state
    # Due to floating point math, check against a small epsilon
    total_pagado = sum(p.monto for p in sale.pagos)
    if total_pagado >= sale.total - 0.01:
        sale.estado_pago = EstadoPago.PAGADO
    else:
        sale.estado_pago = EstadoPago.PARCIAL
        
    await sale.save()
    return sale
