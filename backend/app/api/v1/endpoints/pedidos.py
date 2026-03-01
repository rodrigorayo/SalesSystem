from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.models.pedido_interno import PedidoInterno, PedidoItem, EstadoPedido
from app.models.pedido_item import PedidoItemDocument
from app.models.inventario import Inventario, TipoMovimiento, InventoryLog
from pymongo import ReturnDocument
from app.models.product import Product
from app.models.user import User, UserRole
from app.auth import get_current_active_user

router = APIRouter()


class PedidoItemCreate(BaseModel):
    producto_id: str
    cantidad: int


class PedidoCreate(BaseModel):
    sucursal_id: str
    items: List[PedidoItemCreate]
    notas: Optional[str] = None


class DespachoData(BaseModel):
    precio_mayorista_override: Optional[dict] = None  # {producto_id: precio}


# ── Create ──────────────────────────────────────────────────────────────────

@router.post("/pedidos", response_model=PedidoInterno)
async def crear_pedido(
    data: PedidoCreate,
    current_user: User = Depends(get_current_active_user)
):
    """Branch admin creates an internal order to request stock from the central warehouse."""
    if current_user.role not in [UserRole.ADMIN_SUCURSAL, UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    tenant_id = current_user.tenant_id or ""
    
    # Validation constraint: Admin Sucursal can only create orders for their own sucursal
    if current_user.role == UserRole.ADMIN_SUCURSAL and data.sucursal_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="Cannot create orders for other branches")
    
    items = []
    for item in data.items:
        product = await Product.get(item.producto_id)
        if not product or product.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail=f"Product {item.producto_id} not found")
        
        costo = product.costo_producto
        subtotal = item.cantidad * costo
        items.append(PedidoItem(
            producto_id=item.producto_id,
            descripcion=product.descripcion,
            cantidad=item.cantidad,
            precio_mayorista=costo,
            subtotal=subtotal
        ))

    pedido = PedidoInterno(
        tenant_id=tenant_id,
        sucursal_id=data.sucursal_id, # Legacy
        sucursal_origen_id="CENTRAL", # Matrix to Branch
        sucursal_destino_id=data.sucursal_id,
        tipo_pedido="MATRIZ_A_SUCURSAL",
        items=items,
        notas=data.notas,
        total_mayorista=sum(i.subtotal for i in items)
    )
    await pedido.create()

    # D-02: Write to separate collection for analytics
    items_docs = [
        PedidoItemDocument(
            tenant_id=pedido.tenant_id,
            pedido_id=str(pedido.id),
            sucursal_origen_id=pedido.sucursal_origen_id,
            sucursal_destino_id=pedido.sucursal_destino_id,
            pedido_fecha=pedido.created_at,
            producto_id=item.producto_id,
            descripcion=item.descripcion,
            cantidad=item.cantidad,
            precio_mayorista=item.precio_mayorista,
            subtotal=item.subtotal
        )
        for item in items
    ]
    await PedidoItemDocument.insert_many(items_docs)

    return pedido


# ── List ─────────────────────────────────────────────────────────────────────

@router.get("/pedidos", response_model=List[PedidoInterno])
async def listar_pedidos(
    sucursal_id: Optional[str] = None,
    estado: Optional[EstadoPedido] = None,
    current_user: User = Depends(get_current_active_user)
):
    """List internal orders. Filtered by sucursal or estado if provided."""
    tenant_id = current_user.tenant_id or ""
    query = {Inventario.tenant_id: tenant_id}

    filters = [PedidoInterno.tenant_id == tenant_id]
    if sucursal_id:
        filters.append(PedidoInterno.sucursal_id == sucursal_id)
    if estado:
        filters.append(PedidoInterno.estado == estado)

    return await PedidoInterno.find(*filters).sort(-PedidoInterno.created_at).to_list()


# ── State Transitions ────────────────────────────────────────────────────────

@router.patch("/pedidos/{pedido_id}/cancelar", response_model=PedidoInterno)
async def cancelar_pedido(
    pedido_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Branch or Matrix admin cancels an order.
    Allowed only if state is CREADO.
    """
    pedido = await PedidoInterno.get(pedido_id)
    if not pedido or pedido.tenant_id != (current_user.tenant_id or ""):
        raise HTTPException(status_code=404, detail="Order not found")
        
    if pedido.estado != EstadoPedido.CREADO:
        raise HTTPException(status_code=400, detail=f"No se puede cancelar un pedido en estado {pedido.estado}")
        
    if current_user.role == UserRole.ADMIN_SUCURSAL and pedido.sucursal_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this order")

    pedido.estado = EstadoPedido.CANCELADO
    pedido.cancelado_at = datetime.utcnow()
    pedido.cancelado_por = str(current_user.id)
    await pedido.save()
    return pedido


@router.patch("/pedidos/{pedido_id}/aceptar", response_model=PedidoInterno)
async def aceptar_pedido(
    pedido_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Matrix admin accepts an order.
    Allowed only if state is CREADO.
    """
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Only matrix admins can accept orders")

    pedido = await PedidoInterno.get(pedido_id)
    if not pedido or pedido.tenant_id != (current_user.tenant_id or ""):
        raise HTTPException(status_code=404, detail="Order not found")
        
    if pedido.estado != EstadoPedido.CREADO:
        raise HTTPException(status_code=400, detail=f"No se puede aceptar un pedido en estado {pedido.estado}")

    pedido.estado = EstadoPedido.ACEPTADO
    pedido.aceptado_at = datetime.utcnow()
    pedido.aceptado_por = str(current_user.id)
    await pedido.save()
    return pedido


# ── Despachar (ACEPTADO → DESPACHADO) ─────────────────────────────────────────

@router.patch("/pedidos/{pedido_id}/despachar", response_model=PedidoInterno)
async def despachar_pedido(
    pedido_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Matrix admin dispatches an order.
    - Validates central inventory has enough stock.
    - Deducts from CENTRAL inventory.
    - Sets estado = DESPACHADO.
    """
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Only matrix admins can dispatch orders")

    pedido = await PedidoInterno.get(pedido_id)
    if not pedido or pedido.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if pedido.estado not in [EstadoPedido.CREADO, EstadoPedido.ACEPTADO]:
        raise HTTPException(status_code=400, detail=f"El pedido debe estar CREADO o ACEPTADO para ser despachado. Actual: {pedido.estado}")

    tenant_id = current_user.tenant_id or ""

    # Validate central stock first to avoid partial deductions
    for item in pedido.items:
        central_inv = await Inventario.find_one(
            Inventario.tenant_id == tenant_id,
            Inventario.sucursal_id == "CENTRAL",
            Inventario.producto_id == item.producto_id,
        )
        available = central_inv.cantidad if central_inv else 0
        if available < item.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock central insuficiente para '{item.producto_nombre}'. Disponible: {available}, solicitado: {item.cantidad}"
            )

    # All checks passed — now deduct atomically and log
    total = 0.0
    for item in pedido.items:
        updated_inv = await Inventario.get_pymongo_collection().find_one_and_update(
            {
                "tenant_id": tenant_id,
                "sucursal_id": "CENTRAL",
                "producto_id": item.producto_id,
                "cantidad": {"$gte": item.cantidad}
            },
            {
                "$inc": {"cantidad": -item.cantidad}
            },
            return_document=ReturnDocument.AFTER
        )
        
        if not updated_inv:
            raise HTTPException(
                status_code=400,
                detail=f"Error de concurrencia: Stock insuficiente para '{item.producto_nombre}'."
            )

        # Log to Kardex
        await InventoryLog(
            tenant_id=tenant_id,
            sucursal_id="CENTRAL",
            producto_id=item.producto_id,
            descripcion=item.descripcion,
            tipo_movimiento=TipoMovimiento.TRASLADO,
            cantidad_movida=-item.cantidad,
            stock_resultante=updated_inv["cantidad"],
            costo_unitario_momento=item.precio_mayorista,
            usuario_id=str(current_user.id),
            usuario_nombre=current_user.full_name or current_user.username,
            notas=f"Despacho Pedido a Sucursal {pedido.sucursal_id}",
            referencia_id=str(pedido.id)
        ).create()

        total += item.cantidad * item.precio_mayorista

    pedido.estado = EstadoPedido.DESPACHADO
    pedido.despachado_at = datetime.utcnow()
    pedido.despachado_por = str(current_user.id)
    pedido.total_mayorista = total
    await pedido.save()
    return pedido


# ── Recibir (DESPACHADO → RECIBIDO) ─────────────────────────────────────────

@router.patch("/pedidos/{pedido_id}/recibir", response_model=PedidoInterno)
async def recibir_pedido(
    pedido_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Branch admin confirms receipt.
    - Adds stock to the branch's Inventario.
    - Sets estado = RECIBIDO.
    """
    if current_user.role not in [UserRole.ADMIN_SUCURSAL, UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    pedido = await PedidoInterno.get(pedido_id)
    if not pedido or pedido.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if pedido.estado != EstadoPedido.DESPACHADO:
        raise HTTPException(status_code=400, detail="Order must be DESPACHADO before receiving")

    tenant_id = current_user.tenant_id or ""

    # Add stock to the branch atomically
    for item in pedido.items:
        updated_inv = await Inventario.get_pymongo_collection().find_one_and_update(
            {
                "tenant_id": tenant_id,
                "sucursal_id": pedido.sucursal_id,
                "producto_id": item.producto_id
            },
            {
                "$inc": {"cantidad": item.cantidad}
            },
            return_document=ReturnDocument.AFTER
        )
        
        # If it didn't exist, create it (upsert-like behavior since beanie .create is safer for new docs to hit validation)
        if not updated_inv:
            new_inv = await Inventario(
                tenant_id=tenant_id,
                sucursal_id=pedido.sucursal_id,
                producto_id=item.producto_id,
                cantidad=item.cantidad,
            ).create()
            stock_resultante = new_inv.cantidad
        else:
            stock_resultante = updated_inv["cantidad"]

        # Log to Kardex
        await InventoryLog(
            tenant_id=tenant_id,
            sucursal_id=pedido.sucursal_id,
            producto_id=item.producto_id,
            descripcion=item.descripcion,
            tipo_movimiento=TipoMovimiento.TRASLADO,
            cantidad_movida=item.cantidad,
            stock_resultante=stock_resultante,
            costo_unitario_momento=item.precio_mayorista,
            usuario_id=str(current_user.id),
            usuario_nombre=current_user.full_name or current_user.username,
            notas=f"Recepción de Pedido Central",
            referencia_id=str(pedido.id)
        ).create()

    pedido.estado = EstadoPedido.RECIBIDO
    pedido.recibido_at = datetime.utcnow()
    pedido.recibido_por = str(current_user.id)
    await pedido.save()
    return pedido
