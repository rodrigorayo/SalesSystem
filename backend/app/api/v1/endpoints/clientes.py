from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from datetime import datetime
from bson import ObjectId

from app.models.cliente import Cliente
from app.models.user import User, UserRole
from app.auth import get_current_active_user

router = APIRouter()

class ClienteCreate(BaseModel):
    nombre: str = Field(..., description="Nombre completo o razón social")
    telefono: Optional[str] = None
    email: Optional[str] = None
    nit_ci: Optional[str] = None
    direccion: Optional[str] = None
    notas: Optional[str] = None
    lista_precio_id: Optional[str] = None

class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    nit_ci: Optional[str] = None
    direccion: Optional[str] = None
    notas: Optional[str] = None
    lista_precio_id: Optional[str] = None
    is_active: Optional[bool] = None

class ClienteResponse(BaseModel):
    id: str = Field(..., alias="_id")
    tenant_id: str
    nombre: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    nit_ci: Optional[str] = None
    direccion: Optional[str] = None
    notas: Optional[str] = None
    lista_precio_id: Optional[str] = None
    total_compras: float
    cantidad_compras: int
    ultima_compra_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat()}


@router.get("/clientes", response_model=List[ClienteResponse])
async def listar_clientes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    q: Optional[str] = Query(None, description="Buscar por nombre, NIT o teléfono"),
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    filters = [Cliente.tenant_id == tenant_id, Cliente.is_active == True]
    
    # Or query equivalent done with beanie:
    if q:
        import re
        pattern = re.compile(q, re.IGNORECASE)
        # Beanie motor raw query fallback for $or regex
        query = {
            "tenant_id": tenant_id,
            "is_active": True,
            "$or": [
                {"nombre": {"$regex": pattern}},
                {"nit_ci": {"$regex": pattern}},
                {"telefono": {"$regex": pattern}}
            ]
        }
        clientes_cursor = Cliente.find(query)
    else:
        clientes_cursor = Cliente.find(*filters)
        
    clientes = await clientes_cursor.skip(skip).limit(limit).sort("-created_at").to_list()
    
    return [c.model_dump(by_alias=True) for c in clientes]


@router.post("/clientes", response_model=ClienteResponse)
async def crear_cliente(
    data: ClienteCreate,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    
    # Optional NIT uniqueness check per tenant
    if data.nit_ci:
        existing = await Cliente.find_one(Cliente.tenant_id == tenant_id, Cliente.nit_ci == data.nit_ci)
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un cliente con este NIT/CI.")

    cliente = Cliente(
        tenant_id=tenant_id,
        nombre=data.nombre,
        telefono=data.telefono,
        email=data.email,
        nit_ci=data.nit_ci,
        direccion=data.direccion,
        notas=data.notas,
        lista_precio_id=data.lista_precio_id
    )
    await cliente.create()
    return cliente.model_dump(by_alias=True)


@router.get("/clientes/{cliente_id}", response_model=ClienteResponse)
async def obtener_cliente(
    cliente_id: str,
    current_user: User = Depends(get_current_active_user)
):
    cliente = await Cliente.get(cliente_id)
    if not cliente or cliente.tenant_id != (current_user.tenant_id or "default"):
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente.model_dump(by_alias=True)


@router.put("/clientes/{cliente_id}", response_model=ClienteResponse)
async def actualizar_cliente(
    cliente_id: str,
    data: ClienteUpdate,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    cliente = await Cliente.get(cliente_id)
    
    if not cliente or cliente.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if data.nit_ci and data.nit_ci != cliente.nit_ci:
        existing = await Cliente.find_one(Cliente.tenant_id == tenant_id, Cliente.nit_ci == data.nit_ci)
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un cliente con este NIT/CI.")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cliente, field, value)
        
    await cliente.save()
    return cliente.model_dump(by_alias=True)


@router.delete("/clientes/{cliente_id}")
async def eliminar_cliente(
    cliente_id: str,
    current_user: User = Depends(get_current_active_user)
):
    # Soft delete
    cliente = await Cliente.get(cliente_id)
    if not cliente or cliente.tenant_id != (current_user.tenant_id or "default"):
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    cliente.is_active = False
    cliente.deleted_at = datetime.utcnow()
    cliente.deleted_by = str(current_user.id)
    await cliente.save()
    return {"message": "Cliente eliminado exitosamente"}
