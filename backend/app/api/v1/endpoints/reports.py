from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.auth import get_current_active_user
from app.models.user import User, UserRole
from app.models.sale_item import SaleItem
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/general")
async def get_general_reports(
    days: int = 30,
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """
    Returns general analytics data (KPIs, sales by branch, top products, daily evolution)
    Only accessible by MATRIZ admins. Over the last `days` days.
    """
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMIN_MATRIZ]:
        raise HTTPException(status_code=403, detail="Acceso denegado. Solo administradores generales pueden ver los reportes.")
        
    tenant_id = current_user.tenant_id or "default"
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # ─── 1. KPIs Generales ────────────────────────────────────────────────────────
    kpis_pipeline = [
        {
            "$match": {
                "tenant_id": tenant_id,
                "sale_date": {"$gte": start_date}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ventas": {"$sum": "$subtotal"},
                "total_productos": {"$sum": "$cantidad"},
                "ganancia": {"$sum": {"$multiply": ["$subtotal", 0.15]}}
            }
        }
    ]
    
    kpis_cursor = await SaleItem.motor_collection.aggregate(kpis_pipeline).to_list(length=1)
    kpis = kpis_cursor[0] if kpis_cursor else {"total_ventas": 0, "total_productos": 0, "ganancia": 0}
    if "_id" in kpis:
        del kpis["_id"]
        
    # ─── 2. Ventas por Sucursal ───────────────────────────────────────────────────
    sucursal_pipeline = [
        {
            "$match": {
                "tenant_id": tenant_id,
                "sale_date": {"$gte": start_date}
            }
        },
        {
            "$group": {
                "_id": "$sucursal_id",
                "total_ventas": {"$sum": "$subtotal"},
                "ganancia": {"$sum": {"$multiply": ["$subtotal", 0.15]}}
            }
        },
        {
            "$project": {
                "sucursal": "$_id",
                "total_ventas": 1,
                "ganancia": 1,
                "_id": 0
            }
        },
        {"$sort": {"total_ventas": -1}}
    ]
    ventas_por_sucursal = await SaleItem.motor_collection.aggregate(sucursal_pipeline).to_list(length=100)
    
    # ─── 3. Top Productos Mas Vendidos ────────────────────────────────────────────
    top_products_pipeline = [
        {
            "$match": {
                "tenant_id": tenant_id,
                "sale_date": {"$gte": start_date}
            }
        },
        {
            "$group": {
                "_id": "$descripcion",
                "cantidad_vendida": {"$sum": "$cantidad"},
                "total_ventas": {"$sum": "$subtotal"},
                "ganancia": {"$sum": {"$multiply": ["$subtotal", 0.15]}}
            }
        },
        {
            "$project": {
                "producto": "$_id",
                "cantidad_vendida": 1,
                "total_ventas": 1,
                "ganancia": 1,
                "_id": 0
            }
        },
        {"$sort": {"cantidad_vendida": -1}},
        {"$limit": 10}
    ]
    top_productos = await SaleItem.motor_collection.aggregate(top_products_pipeline).to_list(length=10)
    
    # ─── 4. Evolucion Diaria ──────────────────────────────────────────────────────
    diaria_pipeline = [
        {
            "$match": {
                "tenant_id": tenant_id,
                "sale_date": {"$gte": start_date}
            }
        },
        {
            "$group": {
                "_id": { "$dateToString": { "format": "%Y-%m-%d", "date": "$sale_date" } },
                "total_ventas": {"$sum": "$subtotal"},
                "ganancia": {"$sum": {"$multiply": ["$subtotal", 0.15]}}
            }
        },
        {
            "$project": {
                "fecha": "$_id",
                "total_ventas": 1,
                "ganancia": 1,
                "_id": 0
            }
        },
        {"$sort": {"fecha": 1}}
    ]
    evolucion_diaria = await SaleItem.motor_collection.aggregate(diaria_pipeline).to_list(length=100)
    
    return {
        "kpis": kpis,
        "por_sucursal": ventas_por_sucursal,
        "top_productos": top_productos,
        "evolucion_diaria": evolucion_diaria
    }
