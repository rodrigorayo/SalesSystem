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
    
    if current_user.role in ["ADMIN", "SUPERADMIN", "ADMIN_MATRIZ"]:
        descuentos = await Descuento.find(
            Descuento.tenant_id == tenant_id
        ).sort("-created_at").to_list()
    else:
        sucursal_id = current_user.sucursal_id or "CENTRAL"
        descuentos = await Descuento.find(
            Descuento.tenant_id == tenant_id,
            {"$or": [{"sucursal_id": sucursal_id}, {"aplica_todas_sucursales": True}]}
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
    
    if current_user.role == "ADMIN_SUCURSAL":
        descuento.aplica_todas_sucursales = False
        descuento.sucursal_id = current_user.sucursal_id or "CENTRAL"
    else:
        if not descuento.aplica_todas_sucursales and not descuento.sucursal_id:
            raise HTTPException(status_code=400, detail="Debe especificar una sucursal o marcar aplicar_todas_sucursales=True")
    
    nuevo_descuento = Descuento(
        tenant_id=tenant_id,
        creado_por_rol=current_user.role.value if hasattr(current_user.role, 'value') else current_user.role,
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
        
    if current_user.role == "ADMIN_SUCURSAL":
        if existente.creado_por_rol in ["ADMIN", "SUPERADMIN", "ADMIN_MATRIZ"]:
            raise HTTPException(status_code=403, detail="No puedes modificar un descuento administrado por la Matriz")
        descuento_update.aplica_todas_sucursales = False
        
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
        
    if current_user.role == "ADMIN_SUCURSAL" and existente.creado_por_rol in ["ADMIN", "SUPERADMIN", "ADMIN_MATRIZ"]:
        raise HTTPException(status_code=403, detail="No puedes eliminar un descuento administrado por la Matriz")
        
    await existente.delete()
