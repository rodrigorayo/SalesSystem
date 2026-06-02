from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.domain.models.price_request import PriceChangeRequest, PriceRequestStatus
from app.domain.models.inventario import Inventario
from app.domain.models.product import Product
from app.domain.models.user import User, UserRole
from app.infrastructure.auth import get_current_active_user

router = APIRouter()


class PriceRequestCreate(BaseModel):
    sucursal_id: str
    producto_id: str
    precio_propuesto: float
    motivo_solicitud: str


class PriceRequestRespond(BaseModel):
    estado: PriceRequestStatus # APROBADO or RECHAZADO
    motivo_rechazo: Optional[str] = None


@router.post("/price-requests", response_model=PriceChangeRequest)
async def crear_solicitud_precio(
    data: PriceRequestCreate,
    current_user: User = Depends(get_current_active_user)
):
    """Sucursal admin requests a price change for a product in their branch."""
    if current_user.role not in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    tenant_id = current_user.tenant_id or ""
    
    # Validation: Sucursal Admin can only request for their own branch
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR] and data.sucursal_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="Cannot request price changes for other branches")

    product = await Product.get(data.producto_id)
    if not product or product.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Product not found")

    # Get current price in branch or global if not set
    inv = await Inventario.find_one(
        Inventario.tenant_id == tenant_id,
        Inventario.sucursal_id == data.sucursal_id,
        Inventario.producto_id == data.producto_id
    )
    
    precio_actual = inv.precio_sucursal if inv and inv.precio_sucursal is not None else product.precio_venta

    request = PriceChangeRequest(
        tenant_id=tenant_id,
        sucursal_id=data.sucursal_id,
        producto_id=data.producto_id,
        producto_nombre=product.descripcion,
        precio_actual=precio_actual,
        precio_propuesto=data.precio_propuesto,
        motivo_solicitud=data.motivo_solicitud,
        solicitado_por=str(current_user.id),
        solicitado_nombre=current_user.full_name or current_user.username
    )
    await request.create()
    return request


@router.get("/price-requests", response_model=List[PriceChangeRequest])
async def listar_solicitudes_precio(
    estado: Optional[PriceRequestStatus] = None,
    sucursal_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """List price change requests."""
    tenant_id = current_user.tenant_id or ""
    filters = [PriceChangeRequest.tenant_id == tenant_id]
    
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR]:
        filters.append(PriceChangeRequest.sucursal_id == current_user.sucursal_id)
    elif sucursal_id:
        filters.append(PriceChangeRequest.sucursal_id == sucursal_id)
        
    if estado:
        filters.append(PriceChangeRequest.estado == estado)

    return await PriceChangeRequest.find(*filters).sort(-PriceChangeRequest.created_at).to_list()


@router.post("/price-requests/{request_id}/respond", response_model=PriceChangeRequest)
async def responder_solicitud_precio(
    request_id: str,
    data: PriceRequestRespond,
    current_user: User = Depends(get_current_active_user)
):
    """Matrix admin approves or rejects a price change request."""
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Only matrix admins can respond to requests")

    request = await PriceChangeRequest.get(request_id)
    if not request or request.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if request.estado != PriceRequestStatus.PENDIENTE:
        raise HTTPException(status_code=400, detail="This request has already been processed")

    if data.estado not in [PriceRequestStatus.APROBADO, PriceRequestStatus.RECHAZADO]:
        raise HTTPException(status_code=400, detail="Invalid status")

    request.estado = data.estado
    request.motivo_rechazo = data.motivo_rechazo
    request.respondido_por = str(current_user.id)
    request.responded_at = datetime.utcnow()

    if data.estado == PriceRequestStatus.APROBADO:
        # Update Inventario price override
        inv = await Inventario.find_one(
            Inventario.tenant_id == request.tenant_id,
            Inventario.sucursal_id == request.sucursal_id,
            Inventario.producto_id == request.producto_id
        )
        if not inv:
            # Create inventory record if it doesn't exist yet (though it should usually)
            inv = Inventario(
                tenant_id=request.tenant_id,
                sucursal_id=request.sucursal_id,
                producto_id=request.producto_id,
                cantidad=0,
                precio_sucursal=request.precio_propuesto
            )
            await inv.create()
        else:
            inv.precio_sucursal = request.precio_propuesto
            inv.updated_at = datetime.utcnow()
            await inv.save()

    await request.save()
    return request


@router.post("/inventario/override-price")
async def override_branch_price(
    sucursal_id: str,
    producto_id: str,
    nuevo_precio: Optional[float], # if None, reset to global
    current_user: User = Depends(get_current_active_user)
):
    """Directly override a branch price (Matrix Admin only)."""
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Only matrix admins can override prices directly")

    tenant_id = current_user.tenant_id or ""
    
    inv = await Inventario.find_one(
        Inventario.tenant_id == tenant_id,
        Inventario.sucursal_id == sucursal_id,
        Inventario.producto_id == producto_id
    )
    
    if not inv:
        if nuevo_precio is None:
            return {"message": "Already using global price"}
        inv = Inventario(
            tenant_id=tenant_id,
            sucursal_id=sucursal_id,
            producto_id=producto_id,
            cantidad=0,
            precio_sucursal=nuevo_precio
        )
        await inv.create()
    else:
        inv.precio_sucursal = nuevo_precio
        inv.updated_at = datetime.utcnow()
        await inv.save()
        
    return {"message": "Price updated successfully", "precio_sucursal": nuevo_precio}
