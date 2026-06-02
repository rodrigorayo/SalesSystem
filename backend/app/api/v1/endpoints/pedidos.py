from typing import List, Optional
from datetime import datetime
from app.utils.date_utils import convert_to_bolivia

import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from app.domain.models.pedido_interno import PedidoInterno, PedidoItem, EstadoPedido
from app.domain.models.pedido_item import PedidoItemDocument
from app.domain.models.inventario import Inventario, TipoMovimiento, InventoryLog
from pymongo import ReturnDocument
from app.domain.models.product import Product
from app.domain.models.user import User, UserRole
from app.infrastructure.auth import get_current_active_user

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
    from app.application.services.pedidos_service import PedidosService
    return await PedidosService.crear_pedido(data, current_user)


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
    from app.application.services.pedidos_service import PedidosService
    return await PedidosService.cancelar_pedido(pedido_id, current_user)


@router.patch("/pedidos/{pedido_id}/aceptar", response_model=PedidoInterno)
async def aceptar_pedido(
    pedido_id: str,
    current_user: User = Depends(get_current_active_user)
):
    from app.application.services.pedidos_service import PedidosService
    return await PedidosService.aceptar_pedido(pedido_id, current_user)


# ── Despachar (ACEPTADO → DESPACHADO) ─────────────────────────────────────────

@router.patch("/pedidos/{pedido_id}/despachar", response_model=PedidoInterno)
async def despachar_pedido(
    pedido_id: str,
    current_user: User = Depends(get_current_active_user)
):
    from app.application.services.pedidos_service import PedidosService
    return await PedidosService.despachar_pedido(pedido_id, current_user)


# ── Recibir (DESPACHADO → RECIBIDO) ─────────────────────────────────────────

@router.patch("/pedidos/{pedido_id}/recibir", response_model=PedidoInterno)
async def recibir_pedido(
    pedido_id: str,
    data: Optional[PedidoRecepcion] = None,
    current_user: User = Depends(get_current_active_user)
):
    from app.application.services.pedidos_service import PedidosService
    return await PedidosService.recibir_pedido(pedido_id, data, current_user)


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
    
    fecha_recibido = convert_to_bolivia(pedido.recibido_at).strftime("%Y-%m-%d %H:%M") if pedido.recibido_at else "Pendiente"

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

