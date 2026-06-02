from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from app.infrastructure.auth import get_current_active_user
from app.domain.models.user import User, UserRole
from app.domain.models.traslado import TrasladoInventario
from app.domain.schemas.traslado import TrasladoCreate, TrasladoReceive
from app.application.services.traslado_service import TrasladoService

router = APIRouter()

@router.post("/")
async def crear_traslado(
    body: TrasladoCreate, 
    current_user: User = Depends(get_current_active_user)
):
    """
    Despacha un traslado desde la sucursal del usuario hacia la sucursal_destino_id.
    """
    return await TrasladoService.despachar_traslado(body, current_user)


@router.post("/{traslado_id}/recibir")
async def recibir_traslado(
    traslado_id: str,
    body: TrasladoReceive,
    current_user: User = Depends(get_current_active_user)
):
    """
    Recibe un traslado en la sucursal destino, pudiendo reportar menos cantidad de la enviada (mermas en tránsito).
    """
    return await TrasladoService.recibir_traslado(traslado_id, body, current_user)


@router.post("/{traslado_id}/cancelar")
async def cancelar_traslado(
    traslado_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Cancela un traslado en tránsito y devuelve el stock al origen.
    """
    return await TrasladoService.cancelar_traslado(traslado_id, current_user)


@router.get("/")
async def listar_traslados(
    tipo: str = Query("todos", description="enviados | recibidos | todos"),
    estado: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user)
):
    """
    Lista los traslados de inventario.
    """
    tenant_id = current_user.tenant_id or "default"
    sucursal_id = current_user.sucursal_id or "CENTRAL"
    
    query = [TrasladoInventario.tenant_id == tenant_id]
    
    if current_user.role in [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMIN_MATRIZ]:
        pass # Can see all
    else:
        if tipo == "enviados":
            query.append(TrasladoInventario.sucursal_origen_id == sucursal_id)
        elif tipo == "recibidos":
            query.append(TrasladoInventario.sucursal_destino_id == sucursal_id)
        else:
            query.append({
                "$or": [
                    {"sucursal_origen_id": sucursal_id},
                    {"sucursal_destino_id": sucursal_id}
                ]
            })
            
    if estado:
        query.append(TrasladoInventario.estado == estado)
        
    find_q = TrasladoInventario.find(*query).sort("-created_at")
    total = await find_q.count()
    items = await find_q.skip((page - 1) * page_size).limit(page_size).to_list()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.get("/{traslado_id}")
async def obtener_traslado(
    traslado_id: str,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    traslado = await TrasladoInventario.get(traslado_id)
    if not traslado or traslado.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Traslado no encontrado")
    return traslado
