from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.domain.models.almacen import Almacen, TipoAlmacen
from app.infrastructure.auth import get_current_user
from app.infrastructure.core.dependencies import require_roles
from app.domain.models.user import User, UserRole

router = APIRouter()

class AlmacenCreate(BaseModel):
    nombre: str
    tipo: TipoAlmacen = TipoAlmacen.GENERAL
    is_default: bool = False

class AlmacenUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[TipoAlmacen] = None
    is_default: Optional[bool] = None

@router.get("/{sucursal_id}", response_model=List[Almacen])
async def get_almacenes(
    sucursal_id: str,
    current_user: User = Depends(get_current_user)
):
    """Obtiene los almacenes de una sucursal específica."""
    tenant_id = current_user.tenant_id
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.VENDEDOR, UserRole.CAJERO]:
        if sucursal_id != current_user.sucursal_id and current_user.sucursal_id is not None:
            raise HTTPException(status_code=403, detail="No tienes acceso a los almacenes de esta sucursal")
    
    almacenes = await Almacen.find({"tenant_id": tenant_id, "sucursal_id": sucursal_id, "deleted_at": None}).to_list()
    
    # Fallback temporal: si la sucursal no tiene almacenes, retornamos uno "virtual" por defecto
    if not almacenes:
        return [
            Almacen(
                tenant_id=tenant_id,
                sucursal_id=sucursal_id,
                nombre="Almacén Principal",
                tipo=TipoAlmacen.GENERAL,
                is_default=True,
                id="default"
            )
        ]
    return almacenes

@router.post("/{sucursal_id}", response_model=Almacen)
async def create_almacen(
    sucursal_id: str,
    data: AlmacenCreate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL))
):
    tenant_id = current_user.tenant_id
    
    exists = await Almacen.find_one({"tenant_id": tenant_id, "sucursal_id": sucursal_id, "nombre": data.nombre, "deleted_at": None})
    if exists:
        raise HTTPException(status_code=400, detail="Ya existe un almacén con este nombre en la sucursal")

    if data.is_default:
        await Almacen.find({"tenant_id": tenant_id, "sucursal_id": sucursal_id}).update({"$set": {"is_default": False}})

    new_almacen = Almacen(
        tenant_id=tenant_id,
        sucursal_id=sucursal_id,
        nombre=data.nombre,
        tipo=data.tipo,
        is_default=data.is_default
    )
    await new_almacen.insert()
    return new_almacen

@router.patch("/{almacen_id}", response_model=Almacen)
async def update_almacen(
    almacen_id: str,
    data: AlmacenUpdate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL))
):
    almacen = await Almacen.get(almacen_id)
    if not almacen or almacen.tenant_id != current_user.tenant_id or almacen.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Almacén no encontrado")

    if data.nombre is not None:
        almacen.nombre = data.nombre
    if data.tipo is not None:
        almacen.tipo = data.tipo
    if data.is_default is not None:
        if data.is_default and not almacen.is_default:
            await Almacen.find({"tenant_id": almacen.tenant_id, "sucursal_id": almacen.sucursal_id}).update({"$set": {"is_default": False}})
        almacen.is_default = data.is_default

    await almacen.save()
    return almacen

@router.delete("/{almacen_id}")
async def delete_almacen(
    almacen_id: str,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMIN_MATRIZ))
):
    almacen = await Almacen.get(almacen_id)
    if not almacen or almacen.tenant_id != current_user.tenant_id or almacen.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Almacén no encontrado")
        
    if almacen.is_default:
        raise HTTPException(status_code=400, detail="No puedes eliminar el almacén principal por defecto")

    await almacen.soft_delete()
    return {"message": "Almacén eliminado"}
