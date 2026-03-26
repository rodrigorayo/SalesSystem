from typing import List, Optional
from datetime import datetime
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
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


class PedidoRecepcionItem(BaseModel):
    producto_id: str
    cantidad_recibida: int


class PedidoRecepcion(BaseModel):
    items: List[PedidoRecepcionItem]


class PedidoCreate(BaseModel):
    sucursal_origen_id: str = "CENTRAL"
    sucursal_destino_id: str
    items: List[PedidoItemCreate]
    notas: Optional[str] = None
    transferencia_directa: bool = False # If true, auto-resolves to RECIBIDO


class DespachoData(BaseModel):
    precio_mayorista_override: Optional[dict] = None  # {producto_id: precio}


# ── Create ──────────────────────────────────────────────────────────────────

@router.post("/pedidos", response_model=PedidoInterno)
async def crear_pedido(
    data: PedidoCreate,
    current_user: User = Depends(get_current_active_user)
):
    """Branch admin creates an internal order to request stock from the central warehouse."""
    if current_user.role not in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    tenant_id = current_user.tenant_id or ""
    
    # Validation constraints
    if data.sucursal_origen_id == "CENTRAL" and current_user.role == UserRole.SUPERVISOR:
        raise HTTPException(status_code=403, detail="Los Supervisores no pueden pedir directo a Matriz, solo a Sucursales Físicas")
        
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.VENDEDOR] and data.sucursal_destino_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="No puedes crear solicitudes de entrada para otras sucursales")
        
    if current_user.role == UserRole.SUPERVISOR and data.transferencia_directa:
        if data.sucursal_origen_id != current_user.sucursal_id and data.sucursal_destino_id != current_user.sucursal_id:
            raise HTTPException(status_code=403, detail="Solo puedes transferir inventario desde o hacia tu propia bodega de Supervisor")
    
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

    tipo_pedido = "SUCURSAL_A_SUCURSAL" if data.sucursal_origen_id != "CENTRAL" else "MATRIZ_A_SUCURSAL"
    
    pedido = PedidoInterno(
        tenant_id=tenant_id,
        sucursal_id=data.sucursal_destino_id, # Legacy compatibility
        sucursal_origen_id=data.sucursal_origen_id,
        sucursal_destino_id=data.sucursal_destino_id,
        tipo_pedido=tipo_pedido,
        estado=EstadoPedido.CREADO,
        items=items,
        notas=data.notas,
        total_mayorista=sum(i.subtotal for i in items)
    )
    
    # Auto-dispatch/receive for Direct Transfers (Supervisor -> Vendedor)
    if data.transferencia_directa:
        pedido.estado = EstadoPedido.RECIBIDO
        pedido.aceptado_at = datetime.utcnow()
        pedido.despachado_at = datetime.utcnow()
        pedido.recibido_at = datetime.utcnow()
        pedido.aceptado_por = str(current_user.id)
        pedido.despachado_por = str(current_user.id)
        pedido.recibido_por = str(current_user.id)
        
        # Deduct from origin (Supervisor inventory)
        for item in items:
            item.cantidad_recibida = item.cantidad
            await Inventario.get_pymongo_collection().find_one_and_update(
                {"tenant_id": tenant_id, "sucursal_id": data.sucursal_origen_id, "producto_id": item.producto_id},
                {"$inc": {"cantidad": -item.cantidad}}
            )
            # Add to destination (Vendedor inventory)
            await Inventario.get_pymongo_collection().find_one_and_update(
                {"tenant_id": tenant_id, "sucursal_id": data.sucursal_destino_id, "producto_id": item.producto_id},
                {"$inc": {"cantidad": item.cantidad}},
                upsert=True
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
    filters = [PedidoInterno.tenant_id == tenant_id]

    from beanie.operators import Or

    # Rol based restrictions
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.CAJERO]:
        # Branch users can see orders where they are either sending or receiving
        filters.append(
            Or(
                PedidoInterno.sucursal_id == current_user.sucursal_id,
                PedidoInterno.sucursal_origen_id == current_user.sucursal_id,
                PedidoInterno.sucursal_destino_id == current_user.sucursal_id
            )
        )
    elif sucursal_id:
        # General admins can filter by sucursal or see all
        filters.append(
            Or(
                PedidoInterno.sucursal_id == sucursal_id,
                PedidoInterno.sucursal_origen_id == sucursal_id,
                PedidoInterno.sucursal_destino_id == sucursal_id
            )
        )

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
        
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR] and pedido.sucursal_id != current_user.sucursal_id:
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
    # Matrix Admins can accept any. Branch Admins can accept if they are the ORIGIN.
    is_matrix_admin = current_user.role in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]
    # We will validate branch admin in the next step


    pedido = await PedidoInterno.get(pedido_id)
    if not pedido or pedido.tenant_id != (current_user.tenant_id or ""):
        raise HTTPException(status_code=404, detail="Order not found")
        
    if not is_matrix_admin:
        if current_user.role not in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR] or pedido.sucursal_origen_id != current_user.sucursal_id:
            raise HTTPException(status_code=403, detail="No tienes permiso para aprobar despachos de esta sucursal origen")
        
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
    is_matrix_admin = current_user.role in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]

    pedido = await PedidoInterno.get(pedido_id)
    if not pedido or pedido.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if not is_matrix_admin:
        if current_user.role not in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR] or pedido.sucursal_origen_id != current_user.sucursal_id:
            raise HTTPException(status_code=403, detail="No tienes permiso para despachar de esta sucursal origen")
    if pedido.estado not in [EstadoPedido.CREADO, EstadoPedido.ACEPTADO]:
        raise HTTPException(status_code=400, detail=f"El pedido debe estar CREADO o ACEPTADO para ser despachado. Actual: {pedido.estado}")

    tenant_id = current_user.tenant_id or ""

    # If origin is a branch (not CENTRAL), we MUST deduct from the origin inventory directly
    if pedido.sucursal_origen_id != "CENTRAL":
        for item in pedido.items:
            await Inventario.get_pymongo_collection().find_one_and_update(
                {"tenant_id": tenant_id, "sucursal_id": pedido.sucursal_origen_id, "producto_id": item.producto_id},
                {"$inc": {"cantidad": -item.cantidad}},
                return_document=ReturnDocument.AFTER
            )
            # You could add negative stock validations here, but we'll allow negative for simplicity if they oversell
            
    total = sum(item.cantidad * item.precio_mayorista for item in pedido.items)

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
    data: Optional[PedidoRecepcion] = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    Branch admin confirms receipt, with optional partial quantities.
    - Adds stock to the branch's Inventario.
    - Sets estado = RECIBIDO.
    """
    if current_user.role not in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    pedido = await PedidoInterno.get(pedido_id)
    if not pedido or pedido.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR] and pedido.sucursal_destino_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="Not authorized to receive this order")

    if pedido.estado != EstadoPedido.DESPACHADO:
        raise HTTPException(status_code=400, detail="Order must be DESPACHADO before receiving")

    tenant_id = current_user.tenant_id or ""
    
    recepcion_map = {}
    if data and data.items:
        recepcion_map = {item.producto_id: item.cantidad_recibida for item in data.items}

    # Add stock to the branch atomically
    for item in pedido.items:
        cant_recibida = recepcion_map.get(item.producto_id, item.cantidad)
        
        if cant_recibida > item.cantidad:
            raise HTTPException(status_code=400, detail=f"No puedes recibir más de lo despachado para {item.descripcion}")
            
        item.cantidad_recibida = cant_recibida
        
        if cant_recibida == 0:
            continue

        updated_inv = await Inventario.get_pymongo_collection().find_one_and_update(
            {
                "tenant_id": tenant_id,
                "sucursal_id": pedido.sucursal_id,
                "producto_id": item.producto_id
            },
            {
                "$inc": {"cantidad": cant_recibida}
            },
            return_document=ReturnDocument.AFTER
        )
        
        # If it didn't exist, create it (upsert-like behavior since beanie .create is safer for new docs to hit validation)
        if not updated_inv:
            new_inv = await Inventario(
                tenant_id=tenant_id,
                sucursal_id=pedido.sucursal_id,
                producto_id=item.producto_id,
                cantidad=cant_recibida,
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
            cantidad_movida=cant_recibida,
            stock_resultante=stock_resultante,
            costo_unitario_momento=item.precio_mayorista,
            usuario_id=str(current_user.id),
            usuario_nombre=current_user.full_name or current_user.username,
            notas="Recepción de Pedido Central",
            referencia_id=str(pedido.id)
        ).create()

    pedido.estado = EstadoPedido.RECIBIDO
    pedido.recibido_at = datetime.utcnow()
    pedido.recibido_por = str(current_user.id)
    await pedido.save()
    return pedido


# ── Report (Generar PDF) ────────────────────────────────────────────────────

@router.get("/pedidos/{pedido_id}/pdf")
async def descargar_pdf_pedido(
    pedido_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Generate a PDF summarizing the order, specifically showing quantities dispatched vs received.
    """
    if current_user.role not in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    pedido = await PedidoInterno.get(pedido_id)
    if not pedido or pedido.tenant_id != (current_user.tenant_id or ""):
        raise HTTPException(status_code=404, detail="Order not found")
        
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR] and pedido.sucursal_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this order")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    Story = []
    
    styles = getSampleStyleSheet()
    title_style = styles['Title']
    normal_style = styles['Normal']
    
    Story.append(Paragraph("Comprobante de Recepción de Pedido", title_style))
    Story.append(Spacer(1, 12))
    
    Story.append(Paragraph(f"<b>Sucursal:</b> {pedido.sucursal_id}", normal_style))
    Story.append(Paragraph(f"<b>Estado:</b> {pedido.estado}", normal_style))
    
    fecha_recibido = pedido.recibido_at.strftime("%Y-%m-%d %H:%M") if pedido.recibido_at else "Pendiente"
    Story.append(Paragraph(f"<b>Fecha Recibido:</b> {fecha_recibido}", normal_style))
    Story.append(Spacer(1, 20))
    
    # Table data
    data = [["Producto", "Req/Env", "Recibida", "Diferencia"]]
    
    for item in pedido.items:
        desc = item.descripcion
        pedida = item.cantidad
        recibida = item.cantidad_recibida if item.cantidad_recibida is not None else pedida
        diff = recibida - pedida
        diff_str = str(diff) if diff != 0 else "0"
        data.append([desc, str(pedida), str(recibida), diff_str])
        
    table = Table(data, colWidths=[280, 80, 80, 80])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.whitesmoke),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    
    Story.append(table)
    
    if pedido.notas:
        Story.append(Spacer(1, 20))
        Story.append(Paragraph(f"<b>Notas Originales:</b> {pedido.notas}", normal_style))

    doc.build(Story)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=recepcion_{pedido_id}.pdf"}
    )

