from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.application.services.production_service import ProductionService
from app.dependencies import get_production_service
from app.domain.models.user import User
from app.domain.models.meal_schedule import MealScheduleStatus, MealSchedule
from app.infrastructure.auth import get_current_active_user

router = APIRouter()

class UpdateScheduleRequest(BaseModel):
    recetas_ids: Optional[List[str]] = None
    estado: Optional[MealScheduleStatus] = None
    motivo_postergacion: Optional[str] = None

@router.get("/production/daily-report")
async def get_daily_production_report(
    fecha: str = Query(..., description="Fecha en formato YYYY-MM-DD"),
    current_user: User = Depends(get_current_active_user),
    service: ProductionService = Depends(get_production_service)
):
    tenant_id = current_user.tenant_id or "default"
    sucursal_id = current_user.sucursal_id or "default"
    return await service.get_daily_production_report(tenant_id, sucursal_id, fecha)

@router.put("/production/schedules/{schedule_id}")
async def update_meal_schedule(
    schedule_id: str,
    data: UpdateScheduleRequest,
    current_user: User = Depends(get_current_active_user),
    service: ProductionService = Depends(get_production_service)
):
    tenant_id = current_user.tenant_id or "default"
    return await service.update_meal_schedule(
        tenant_id=tenant_id,
        schedule_id=schedule_id,
        recetas_ids=data.recetas_ids,
        estado=data.estado,
        motivo_postergacion=data.motivo_postergacion
    )

@router.post("/production/schedules/{schedule_id}/deliver")
async def mark_schedule_as_delivered(
    schedule_id: str,
    current_user: User = Depends(get_current_active_user),
    service: ProductionService = Depends(get_production_service)
):
    tenant_id = current_user.tenant_id or "default"
    sucursal_id = current_user.sucursal_id or "default"
    return await service.mark_as_delivered(tenant_id, sucursal_id, schedule_id, current_user)

from app.domain.models.cliente import Cliente
from app.domain.models.recipe import Recipe

@router.get("/production/schedules")
async def list_meal_schedules(
    cliente_id: Optional[str] = None,
    fecha_programada: Optional[str] = None,
    estado: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    filters = [MealSchedule.tenant_id == tenant_id]
    
    if cliente_id:
        filters.append(MealSchedule.cliente_id == cliente_id)
    if fecha_programada:
        filters.append(MealSchedule.fecha_programada == fecha_programada)
    if estado:
        filters.append(MealSchedule.estado == estado)
        
    schedules = await MealSchedule.find(*filters).sort("fecha_programada").to_list()
    
    result = []
    for s in schedules:
        client = await Cliente.get(s.cliente_id)
        s_dump = s.model_dump()
        s_dump["_id"] = str(s.id)
        s_dump["client_name"] = client.nombre if client else "Cliente Desconocido"
        
        recipe_names = []
        for rid in s.recetas_ids:
            r = await Recipe.get(rid)
            if r:
                recipe_names.append(r.nombre)
        s_dump["recipe_names"] = recipe_names
        result.append(s_dump)
        
    return result

class CreateScheduleRequest(BaseModel):
    cliente_id: str
    client_meal_plan_id: str
    fecha_programada: str  # YYYY-MM-DD
    recetas_ids: List[str]

@router.post("/production/schedules")
async def create_meal_schedule(
    data: CreateScheduleRequest,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    from app.domain.models.client_meal_plan import ClientMealPlan
    
    plan = await ClientMealPlan.get(data.client_meal_plan_id)
    if not plan or plan.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Plan de comida de cliente no encontrado")
        
    schedule = MealSchedule(
        tenant_id=tenant_id,
        cliente_id=data.cliente_id,
        client_meal_plan_id=data.client_meal_plan_id,
        fecha_programada=data.fecha_programada,
        recetas_ids=data.recetas_ids,
        estado=MealScheduleStatus.PROGRAMADO
    )
    await schedule.create()
    return schedule
