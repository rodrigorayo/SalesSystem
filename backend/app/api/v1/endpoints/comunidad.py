from fastapi import APIRouter, Depends, Request, HTTPException
from typing import List
from app.application.services.comunidad_service import ComunidadService, ReclamoInput
from app.domain.models.comunidad import ComunidadUser
from app.infrastructure.auth import get_current_active_user
from app.domain.models.user import User, UserRole

router = APIRouter()

# --- Endpoints Públicos (Para la Landing Page) ---

@router.post("/visita")
async def registrar_visita(request: Request, tenant_id: str = "default"):
    """
    Registra una visita anónima desde la landing page.
    """
    ip = request.client.host if request.client else "Unknown"
    user_agent = request.headers.get("user-agent", "Unknown")
    await ComunidadService.registrar_visita(tenant_id, ip, user_agent, "/visita")
    return {"status": "ok"}

@router.get("/check-phone/{telefono}")
async def check_phone(telefono: str, request: Request, tenant_id: str = "default"):
    """
    Verifica si un número de teléfono ya ha reclamado. 
    Llamar a este endpoint también suma 1 a sus visitas_pagina.
    """
    ip = request.client.host if request.client else "Unknown"
    user_agent = request.headers.get("user-agent", "Unknown")
    await ComunidadService.registrar_visita(tenant_id, ip, user_agent, f"/check-phone/{telefono}")
    
    user = await ComunidadService.check_phone(tenant_id, telefono)
    return {
        "telefono": user.telefono,
        "ha_reclamado": user.ha_reclamado,
        "premio_reclamado": user.premio_reclamado
    }

@router.post("/claim")
async def reclamar_premio(data: ReclamoInput, request: Request, tenant_id: str = "default"):
    """
    Procesa el reclamo del premio con los datos completos.
    """
    ip = request.client.host if request.client else "Unknown"
    user_agent = request.headers.get("user-agent", "Unknown")
    await ComunidadService.registrar_visita(tenant_id, ip, user_agent, "/claim")
    
    user = await ComunidadService.reclamar_premio(tenant_id, data)
    return {"status": "success", "user": user}


# --- Endpoints Privados (Para el Administrador en SalesSystem) ---

@router.get("/stats")
async def get_stats(current_user: User = Depends(get_current_active_user)):
    """
    Estadísticas del módulo de comunidad. Solo para administradores.
    """
    if current_user.role not in [UserRole.ADMIN_MASTER, UserRole.ADMIN_SUCURSAL]:
         raise HTTPException(status_code=403, detail="No tienes permisos para ver estadísticas de comunidad")
         
    tenant_id = current_user.tenant_id or "default"
    return await ComunidadService.get_stats(tenant_id)

@router.get("/users")
async def get_users(limit: int = 100, skip: int = 0, current_user: User = Depends(get_current_active_user)):
    """
    Lista de usuarios registrados en la comunidad.
    """
    if current_user.role not in [UserRole.ADMIN_MASTER, UserRole.ADMIN_SUCURSAL]:
         raise HTTPException(status_code=403, detail="No tienes permisos para ver los usuarios de comunidad")
         
    tenant_id = current_user.tenant_id or "default"
    return await ComunidadService.get_users(tenant_id, limit, skip)
