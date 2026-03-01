from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.auth import get_current_active_user
from app.models.user import User
from app.models.descuento import DescuentoCreate, DescuentoUpdate, DescuentoResponse, Descuento
from bson import ObjectId
from datetime import datetime

router = APIRouter()

@router.get("/", response_model=List[DescuentoResponse])
async def get_descuentos(
    current_user: User = Depends(get_current_active_user),
):
    """
    Obtener todos los descuentos disponibles para la sucursal actual.
    Cajeros y Admins pueden verlos.
    """
    tenant_id = current_user.tenant_id or "default"
    sucursal_id = current_user.sucursal_id or "CENTRAL"
    
    descuentos = await Descuento.find(
        Descuento.tenant_id == tenant_id,
        Descuento.sucursal_id == sucursal_id
    ).sort("-created_at").to_list()
    
    return [DescuentoResponse(**d.model_dump(), _id=str(d.id)) for d in descuentos]

@router.post("/", response_model=DescuentoResponse)
async def create_descuento(
    descuento: DescuentoCreate,
    current_user: User = Depends(get_current_active_user),
):
    """
    Crear un nuevo descuento. Solo Administradores.
    """
    if current_user.role not in ["ADMIN", "SUPERADMIN", "ADMIN_SUCURSAL"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear descuentos")
        
    tenant_id = current_user.tenant_id or "default"
    sucursal_id = current_user.sucursal_id or "CENTRAL"
    
    nuevo_descuento = Descuento(
        tenant_id=tenant_id,
        sucursal_id=sucursal_id,
        **descuento.model_dump()
    )
    
    await nuevo_descuento.insert()
    return DescuentoResponse(**nuevo_descuento.model_dump(), _id=str(nuevo_descuento.id))

@router.patch("/{descuento_id}", response_model=DescuentoResponse)
async def update_descuento(
    descuento_id: str,
    descuento_update: DescuentoUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """
    Actualizar un descuento existente (ej. desactivarlo). Solo Administradores.
    """
    if current_user.role not in ["ADMIN", "SUPERADMIN", "ADMIN_SUCURSAL"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar descuentos")
        
    if not ObjectId.is_valid(descuento_id):
        raise HTTPException(status_code=400, detail="ID inválido")
        
    tenant_id = current_user.tenant_id or "default"
    existente = await Descuento.find_one(Descuento.id == ObjectId(descuento_id), Descuento.tenant_id == tenant_id)
    
    if not existente:
        raise HTTPException(status_code=404, detail="Descuento no encontrado")
        
    update_data = descuento_update.model_dump(exclude_unset=True)
    if update_data:
        for key, value in update_data.items():
            setattr(existente, key, value)
        existente.updated_at = datetime.utcnow()
        await existente.save()
    
    return DescuentoResponse(**existente.model_dump(), _id=str(existente.id))

@router.delete("/{descuento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_descuento(
    descuento_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """
    Eliminar un descuento permanentemente. Solo Administradores.
    """
    if current_user.role not in ["ADMIN", "SUPERADMIN", "ADMIN_SUCURSAL"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar descuentos")
        
    if not ObjectId.is_valid(descuento_id):
        raise HTTPException(status_code=400, detail="ID inválido")
        
    tenant_id = current_user.tenant_id or "default"
    existente = await Descuento.find_one(Descuento.id == ObjectId(descuento_id), Descuento.tenant_id == tenant_id)
    
    if not existente:
        raise HTTPException(status_code=404, detail="Descuento no encontrado")
        
    await existente.delete()
