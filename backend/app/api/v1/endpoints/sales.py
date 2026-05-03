from datetime import datetime, timedelta
from app.utils.date_utils import get_now_bolivia

from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.domain.models.sale import Sale, ClienteInfo, PagoItem, SaleItem
from app.domain.models.sale_item import SaleItem as SaleItemAnalytics
from app.domain.models.product import Product
from app.domain.models.inventario import Inventario, InventoryLog, TipoMovimiento
from app.domain.models.caja import CajaMovimiento, CajaSesion, EstadoSesion, SubtipoMovimiento
from app.domain.models.user import User, UserRole
from app.infrastructure.auth import get_current_active_user
from pymongo import ReturnDocument

router = APIRouter()


from app.domain.schemas.sale import SaleCreate, SalesPaginated
from app.application.services.sales_service import SalesService


# ─── Schema: Anulación ──────────────────────────────────────────────────────────────────

class AnularRequest(BaseModel):
    motivo: Literal[
        "ERROR_COBRO",
        "DEVOLUCION_CLIENTE",
        "PRODUCTO_DEFECTUOSO",
        "VENTA_DUPLICADA",
        "OTRO"
    ]
    notas: Optional[str] = None  # Obligatorio en frontend si motivo == "OTRO"
    # Solo requerido cuando motivo == "ERROR_COBRO"
    metodo_pago_correcto: Optional[Literal["EFECTIVO", "QR", "TARJETA", "TRANSFERENCIA"]] = None
    afectar_caja: bool = True


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
    today = get_now_bolivia().date()

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
        "items_count": sum(sum(i.cantidad for i in s.items) for s in today_sales),
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
    body: AnularRequest,
    current_user: User = Depends(get_current_active_user)
):
    return await SalesService.anular_sale(
        sale_id, current_user,
        motivo=body.motivo,
        notas=body.notas,
        metodo_pago_correcto=body.metodo_pago_correcto,
        afectar_caja=body.afectar_caja
    )


# ─── GET /sales/{sale_id}/posible-duplicado ────────────────────────────────────────

@router.get("/sales/{sale_id}/posible-duplicado")
async def check_posible_duplicado(
    sale_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Detect if another sale from the same cashier with same total exists within 2 minutes."""
    tenant_id = current_user.tenant_id or "default"
    sale = await Sale.get(sale_id)
    if not sale or sale.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    window_start = sale.created_at - timedelta(minutes=2)
    window_end   = sale.created_at + timedelta(minutes=2)

    # Find other non-annulled sales from same cashier with same total in the time window
    candidatos = await Sale.find(
        Sale.tenant_id   == tenant_id,
        Sale.cashier_id  == sale.cashier_id,
        Sale.total       == sale.total,
        Sale.anulada     == False,
        Sale.created_at  >= window_start,
        Sale.created_at  <= window_end,
    ).to_list()

    # Exclude the sale itself
    candidatos = [s for s in candidatos if str(s.id) != sale_id]

    if candidatos:
        c = candidatos[0]
        return {
            "tiene_duplicado": True,
            "candidato_id": str(c.id),
            "candidato_id_corto": str(c.id)[-6:].upper(),
            "candidato_monto": float(c.total),
            "candidato_fecha": c.created_at.isoformat(),
            "candidato_cajero": c.cashier_name,
        }
    return {"tiene_duplicado": False}

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
        from app.domain.models.sale import QRInfo
        sale.qr_info = QRInfo()
        
    sale.qr_info.banco = qr_data.banco
    sale.qr_info.referencia = qr_data.referencia
    sale.qr_info.monto_transferido = qr_data.monto_transferido
    sale.qr_info.confirmado = True
    sale.qr_info.confirmado_at = datetime.utcnow()
    sale.qr_info.confirmado_por = current_user.full_name or current_user.username
    
    await sale.save()
    
    return sale


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
    body: AnularRequest,
    current_user: User = Depends(get_current_active_user)
):
    return await SalesService.anular_sale(
        sale_id, current_user,
        motivo=body.motivo,
        notas=body.notas,
        metodo_pago_correcto=body.metodo_pago_correcto,
    )




# ─── GET /sales/{sale_id}/posible-duplicado ────────────────────────────────────────

@router.get("/sales/{sale_id}/posible-duplicado")
async def check_posible_duplicado(
    sale_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Detect if another sale from the same cashier with same total exists within 2 minutes."""
    tenant_id = current_user.tenant_id or "default"
    sale = await Sale.get(sale_id)
    if not sale or sale.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    window_start = sale.created_at - timedelta(minutes=2)
    window_end   = sale.created_at + timedelta(minutes=2)

    # Find other non-annulled sales from same cashier with same total in the time window
    candidatos = await Sale.find(
        Sale.tenant_id   == tenant_id,
        Sale.cashier_id  == sale.cashier_id,
        Sale.total       == sale.total,
        Sale.anulada     == False,
        Sale.created_at  >= window_start,
        Sale.created_at  <= window_end,
    ).to_list()

    # Exclude the sale itself
    candidatos = [s for s in candidatos if str(s.id) != sale_id]

    if candidatos:
        c = candidatos[0]
        return {
            "tiene_duplicado": True,
            "candidato_id": str(c.id),
            "candidato_id_corto": str(c.id)[-6:].upper(),
            "candidato_monto": float(c.total),
            "candidato_fecha": c.created_at.isoformat(),
            "candidato_cajero": c.cashier_name,
        }
    return {"tiene_duplicado": False}

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
        from app.domain.models.sale import QRInfo
        sale.qr_info = QRInfo()
        
    sale.qr_info.banco = qr_data.banco
    sale.qr_info.referencia = qr_data.referencia
    sale.qr_info.monto_transferido = qr_data.monto_transferido
    sale.qr_info.confirmado = True
    sale.qr_info.confirmado_at = datetime.utcnow()
    sale.qr_info.confirmado_por = current_user.full_name or current_user.username
    
    await sale.save()
    
    return sale
