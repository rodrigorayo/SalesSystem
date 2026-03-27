from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.auth import get_current_active_user
from app.schemas.analytics import DashboardResponse
from app.services.analytics_service import get_dashboard_metrics

router = APIRouter()

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    start_date: datetime = Query(..., description="Fecha de inicio (ejemplo: 2023-01-01T00:00:00)"),
    end_date: datetime = Query(..., description="Fecha de fin (ejemplo: 2023-12-31T23:59:59)"),
    sucursal_id: Optional[str] = Query(None, description="Filtra las métricas por una sucursal en específico"),
    cashier_id: Optional[str] = Query(None, description="Filtra las métricas por un cajero en específico"),
    current_user = Depends(get_current_active_user)
):
    """
    Obtener métricas de BI estructuradas directamente de MongoDB con Caché incorporado.
    El tenant_id se extrae automáticamente del token por seguridad.
    """
    return await get_dashboard_metrics(
        tenant_id=current_user.tenant_id,
        start_date=start_date,
        end_date=end_date,
        sucursal_id=sucursal_id,
        cashier_id=cashier_id
    )
