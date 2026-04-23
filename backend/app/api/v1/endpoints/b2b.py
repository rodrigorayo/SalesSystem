from fastapi import APIRouter, Depends, Query, Body, HTTPException
from typing import List, Optional
from app.domain.models.user import User
from app.domain.models.b2b import NotaDevolucionMerma
from app.api.deps import get_current_active_user
from app.application.services.b2b_service import B2BService, MermaInputItem
import math

router = APIRouter()

@router.post("/mermas", response_model=NotaDevolucionMerma)
async def registrar_merma(
    sucursal_id: str = Query(..., description="Sucursal que procesa la merma"),
    supermercado_id: str = Query(..., description="ID del Supermercado/Cliente"),
    notas: Optional[str] = Body(None, embed=True),
    items: List[MermaInputItem] = Body(..., description="Lista de productos vencidos devueltos"),
    current_user: User = Depends(get_current_active_user)
):
    """
    Registra el ingreso de mercadería vencida desde un supermercado.
    Calcula automáticamente la deuda de Taboada basada en costo unitario.
    Cruza el inventario para reponer mercadería fresca.
    """
    tenant_id = current_user.tenant_id or "default"
    return await B2BService.registrar_merma(
        tenant_id=tenant_id,
        sucursal_id=sucursal_id,
        supermercado_id=supermercado_id,
        items_input=items,
        registrado_por=current_user,
        notas=notas
    )

@router.get("/mermas")
async def listar_mermas(
    page: int = 1,
    limit: int = 50,
    estado: Optional[str] = None,
    sucursal_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtiene la lista de Mermas/Reclamos hacia Fábrica Taboada.
    """
    tenant_id = current_user.tenant_id or "default"
    query = {"tenant_id": tenant_id}
    
    if estado:
        query["estado_reclamo"] = estado
    if sucursal_id:
        query["sucursal_id"] = sucursal_id
        
    skip = (page - 1) * limit
    
    total = await NotaDevolucionMerma.find(query).count()
    items = await NotaDevolucionMerma.find(query).sort("-fecha_recuperacion").skip(skip).limit(limit).to_list()
    
    # Calcular sumatoria global pendiente
    
    deuda_pendiente_obj = await NotaDevolucionMerma.aggregate([
        {"$match": {"tenant_id": tenant_id, "estado_reclamo": "PENDIENTE"}},
        {"$group": {"_id": None, "total": {"$sum": "$costo_total_merma"}}}
    ]).to_list()
    deuda_pendiente = float(str(deuda_pendiente_obj[0]["total"])) if deuda_pendiente_obj else 0.0

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit),
        "deuda_pendiente_global": deuda_pendiente
    }

@router.post("/mermas/{merma_id}/compensar", response_model=NotaDevolucionMerma)
async def compensar_merma(
    merma_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Marca un reporte de merma como pagado o devuelto por la fábrica Taboada, 
    bajando así la deuda acumulada.
    """
    tenant_id = current_user.tenant_id or "default"
    return await B2BService.compensar_reclamo(
        merma_id=merma_id,
        tenant_id=tenant_id,
        user=current_user
    )
