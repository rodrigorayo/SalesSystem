from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from bson import ObjectId

from app.domain.models.price_list import ListaPrecio, ListaPrecioItem, TipoListaPrecio
from app.domain.models.user import User
from app.infrastructure.auth import get_current_active_user

router = APIRouter()

# --- Schemas ---

class ListaPrecioCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    tipo: TipoListaPrecio
    valor_descuento: Optional[float] = None # Solo si tipo = PORCENTAJE_DESCUENTO

class ListaPrecioUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: Optional[TipoListaPrecio] = None
    valor_descuento: Optional[float] = None
    is_active: Optional[bool] = None

class ListaPrecioItemCreate(BaseModel):
    producto_id: str
    precio_especial: float = Field(ge=0)
    cantidad_minima: int = Field(ge=1, default=1)

class ListaPrecioItemUpdate(BaseModel):
    precio_especial: Optional[float] = None
    cantidad_minima: Optional[int] = None

class ListaPrecioResponse(BaseModel):
    id: str = Field(..., alias="_id")
    tenant_id: str
    nombre: str
    descripcion: Optional[str] = None
    tipo: TipoListaPrecio
    valor_descuento: Optional[float] = None
    is_active: bool
    created_at: datetime
    
    model_config = ConfigDict(populate_by_name=True)

class ListaPrecioItemResponse(BaseModel):
    id: str = Field(..., alias="_id")
    tenant_id: str
    lista_id: str
    producto_id: str
    precio_especial: float
    cantidad_minima: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)


# --- API Endpoints: Listas ---

@router.get("", response_model=List[ListaPrecioResponse])
async def listar_listas_precios(
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    listas = await ListaPrecio.find(
        ListaPrecio.tenant_id == tenant_id,
        ListaPrecio.is_active == True
    ).to_list()
    return [li.model_dump(by_alias=True) for li in listas]

@router.post("", response_model=ListaPrecioResponse)
async def crear_lista_precio(
    data: ListaPrecioCreate,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    
    if data.tipo == TipoListaPrecio.PORCENTAJE_DESCUENTO and data.valor_descuento is None:
        raise HTTPException(status_code=400, detail="El valor_descuento es requerido para el tipo PORCENTAJE_DESCUENTO")

    lista = ListaPrecio(
        tenant_id=tenant_id,
        nombre=data.nombre,
        descripcion=data.descripcion,
        tipo=data.tipo,
        valor_descuento=data.valor_descuento
    )
    await lista.create()
    return lista.model_dump(by_alias=True)

@router.put("/{lista_id}", response_model=ListaPrecioResponse)
async def actualizar_lista_precio(
    lista_id: str,
    data: ListaPrecioUpdate,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    lista = await ListaPrecio.get(lista_id)
    if not lista or lista.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Lista de precio no encontrada")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lista, field, value)
        
    if lista.tipo == TipoListaPrecio.PORCENTAJE_DESCUENTO and lista.valor_descuento is None:
        raise HTTPException(status_code=400, detail="El valor_descuento es requerido para el tipo PORCENTAJE_DESCUENTO")

    await lista.save()
    return lista.model_dump(by_alias=True)

@router.delete("/{lista_id}")
async def eliminar_lista_precio(
    lista_id: str,
    current_user: User = Depends(get_current_active_user)
):
    lista = await ListaPrecio.get(lista_id)
    if not lista or lista.tenant_id != (current_user.tenant_id or "default"):
        raise HTTPException(status_code=404, detail="Lista de precio no encontrada")
        
    lista.is_active = False
    lista.deleted_at = datetime.utcnow()
    lista.deleted_by = str(current_user.id)
    await lista.save()
    return {"message": "Lista eliminada exitosamente"}


# --- API Endpoints: Items ---

@router.get("/{lista_id}/items", response_model=List[ListaPrecioItemResponse])
async def listar_items_lista(
    lista_id: str,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    
    # Verify list belongs to tenant
    lista = await ListaPrecio.get(lista_id)
    if not lista or lista.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Lista de precio no encontrada")

    items = await ListaPrecioItem.find(ListaPrecioItem.lista_id == lista_id).to_list()
    return [i.model_dump(by_alias=True) for i in items]


@router.post("/{lista_id}/items", response_model=ListaPrecioItemResponse)
async def agregar_item_lista(
    lista_id: str,
    data: ListaPrecioItemCreate,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    
    lista = await ListaPrecio.get(lista_id)
    if not lista or lista.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Lista de precio no encontrada")

    if lista.tipo != TipoListaPrecio.FIJO:
        raise HTTPException(status_code=400, detail="Solo las listas de tipo FIJO llevan items específicos por producto")

    existing = await ListaPrecioItem.find_one(
        ListaPrecioItem.lista_id == lista_id, 
        ListaPrecioItem.producto_id == data.producto_id,
        ListaPrecioItem.cantidad_minima == data.cantidad_minima
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un precio para este producto y cantidad mínima")

    item = ListaPrecioItem(
        tenant_id=tenant_id,
        lista_id=lista_id,
        producto_id=data.producto_id,
        precio_especial=data.precio_especial,
        cantidad_minima=data.cantidad_minima
    )
    await item.create()
    return item.model_dump(by_alias=True)

@router.put("/{lista_id}/items/{item_id}", response_model=ListaPrecioItemResponse)
async def actualizar_item_lista(
    lista_id: str,
    item_id: str,
    data: ListaPrecioItemUpdate,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    
    item = await ListaPrecioItem.get(item_id)
    if not item or item.tenant_id != tenant_id or item.lista_id != lista_id:
        raise HTTPException(status_code=404, detail="Item de lista no encontrado")

    if data.precio_especial is not None:
        item.precio_especial = data.precio_especial
    if data.cantidad_minima is not None:
        item.cantidad_minima = data.cantidad_minima
        
    item.updated_at = datetime.utcnow()
    await item.save()
    return item.model_dump(by_alias=True)

@router.delete("/{lista_id}/items/{item_id}")
async def eliminar_item_lista(
    lista_id: str,
    item_id: str,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    
    item = await ListaPrecioItem.get(item_id)
    if not item or item.tenant_id != tenant_id or item.lista_id != lista_id:
        raise HTTPException(status_code=404, detail="Item de lista no encontrado")

    await item.delete()
    return {"message": "Item eliminado exitosamente"}
