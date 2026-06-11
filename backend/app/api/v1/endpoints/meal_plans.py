from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.domain.models.meal_plan_template import MealPlanTemplate
from app.domain.models.user import User
from app.infrastructure.auth import get_current_active_user
from app.schemas.meal_plan import MealPlanTemplateCreate, MealPlanTemplateUpdate, MealPlanTemplateResponse

router = APIRouter()

@router.post("/meal-plans/templates", response_model=MealPlanTemplateResponse)
async def create_meal_plan_template(
    data: MealPlanTemplateCreate,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    from app.domain.models.base import DecimalMoney
    
    template = MealPlanTemplate(
        tenant_id=tenant_id,
        nombre=data.nombre,
        descripcion=data.descripcion,
        cantidad_comidas=data.cantidad_comidas,
        dias_vigencia=data.dias_vigencia,
        precio_sugerido=DecimalMoney(str(data.precio_sugerido)),
        es_flexible=data.es_flexible
    )
    await template.create()
    return template

@router.get("/meal-plans/templates", response_model=List[MealPlanTemplateResponse])
async def list_meal_plan_templates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    templates = await MealPlanTemplate.find(
        MealPlanTemplate.tenant_id == tenant_id, 
        MealPlanTemplate.is_active == True
    ).skip(skip).limit(limit).to_list()
    return templates

@router.put("/meal-plans/templates/{template_id}", response_model=MealPlanTemplateResponse)
async def update_meal_plan_template(
    template_id: str,
    data: MealPlanTemplateUpdate,
    current_user: User = Depends(get_current_active_user)
):
    template = await MealPlanTemplate.get(template_id)
    if not template or template.tenant_id != (current_user.tenant_id or "default"):
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
        
    update_data = data.model_dump(exclude_unset=True)
    if "precio_sugerido" in update_data and update_data["precio_sugerido"] is not None:
        from app.domain.models.base import DecimalMoney
        update_data["precio_sugerido"] = DecimalMoney(str(update_data["precio_sugerido"]))
        
    for field, value in update_data.items():
        setattr(template, field, value)
        
    await template.save()
    return template

@router.delete("/meal-plans/templates/{template_id}")
async def delete_meal_plan_template(
    template_id: str,
    current_user: User = Depends(get_current_active_user)
):
    template = await MealPlanTemplate.get(template_id)
    if not template or template.tenant_id != (current_user.tenant_id or "default"):
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
        
    template.is_active = False
    await template.save()
    return {"message": "Plantilla desactivada exitosamente"}

from app.domain.models.client_meal_plan import ClientMealPlan
from pydantic import BaseModel
from datetime import datetime

@router.get("/clientes/{cliente_id}/meal-plans")
async def list_client_meal_plans(
    cliente_id: str,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    plans = await ClientMealPlan.find(
        ClientMealPlan.tenant_id == tenant_id,
        ClientMealPlan.cliente_id == cliente_id
    ).to_list()
    
    result = []
    for p in plans:
        template = await MealPlanTemplate.get(p.template_id)
        p_dump = p.model_dump()
        p_dump["_id"] = str(p.id)
        p_dump["template_name"] = template.nombre if template else "Plan Desconocido"
        result.append(p_dump)
        
    return result

class AssignPlanRequest(BaseModel):
    template_id: str
    fecha_inicio: Optional[datetime] = None

@router.post("/clientes/{cliente_id}/meal-plans")
async def assign_plan_to_client(
    cliente_id: str,
    data: AssignPlanRequest,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    template = await MealPlanTemplate.get(data.template_id)
    if not template or template.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Plantilla de plan no encontrada")
        
    from datetime import timedelta
    fecha_ini = data.fecha_inicio or datetime.utcnow()
    fecha_fin = fecha_ini + timedelta(days=template.dias_vigencia)
    
    new_plan = ClientMealPlan(
        tenant_id=tenant_id,
        cliente_id=cliente_id,
        template_id=data.template_id,
        fecha_inicio=fecha_ini,
        fecha_fin_estimada=fecha_fin,
        comidas_totales=template.cantidad_comidas,
        comidas_consumidas=0
    )
    await new_plan.create()
    return new_plan
