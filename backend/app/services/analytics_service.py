from datetime import datetime
from typing import List, Dict, Any, Optional

from app.models.sale import Sale
from app.utils.cache import ttl_cache
from app.schemas.analytics import (
    KpiResumen,
    SucursalVenta,
    VentasPorSucursal,
    ProductoTop,
    TopProductos,
    DashboardResponse
)

@ttl_cache(seconds=120)
async def get_dashboard_metrics(
    tenant_id: str, 
    start_date: datetime, 
    end_date: datetime,
    sucursal_id: Optional[str] = None,
    cashier_id: Optional[str] = None
) -> DashboardResponse:
    """
    Obtiene las métricas del dashboard filtrando por tenant_id y rango de fechas.
    Usamos el Aggregation Pipeline a través de Motor/Beanie para no bloquear la BD.
    Aprovechamos la colección de `Sale` directamente (y sus items embebidos) para 
    asegurar que filtramos rigurosamente `anulada: False`.
    """
    
    # 1. Construir condiciones del filtro base
    match_conditions = {
        "tenant_id": tenant_id,
        "created_at": {"$gte": start_date, "$lte": end_date},
        "anulada": False
    }

    if sucursal_id:
        match_conditions["sucursal_id"] = sucursal_id
    if cashier_id:
        match_conditions["cashier_id"] = cashier_id

    # Filtro común (match obligatorio por seguridad SaaS y rendimiento)
    base_match = {
        "$match": match_conditions
    }

    # ==========================================
    # PIPELINE 1: KPIs Básicos
    # ==========================================
    kpi_pipeline = [
        base_match,
        {
            "$project": {
                "total": 1,
                "costo_total_doc": {
                    "$sum": {
                        "$map": {
                            "input": "$items",
                            "as": "item",
                            "in": {"$multiply": ["$$item.cantidad", "$$item.costo_unitario"]}
                        }
                    }
                }
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ventas": {"$sum": "$total"},
                "costo_total": {"$sum": "$costo_total_doc"},
                "cantidad_transacciones": {"$sum": 1}
            }
        }
    ]
    
    kpi_cursor = await Sale.aggregate(kpi_pipeline).to_list()
    
    kpi_data = kpi_cursor[0] if kpi_cursor else {}
    total_ventas = kpi_data.get("total_ventas", 0.0)
    costo_total = kpi_data.get("costo_total", 0.0)
    cantidad_transacciones = kpi_data.get("cantidad_transacciones", 0)
    
    # Prevenimos division por cero
    margen_bruto = 0.0
    if total_ventas > 0:
        margen_bruto = (total_ventas - costo_total) / total_ventas

    kpis = KpiResumen(
        total_ventas=total_ventas,
        costo_total=costo_total,
        margen_bruto=margen_bruto,
        cantidad_transacciones=cantidad_transacciones
    )

    # ==========================================
    # PIPELINE 2: Ventas por Sucursal
    # ==========================================
    sucursales_pipeline = [
        base_match,
        {
            "$group": {
                "_id": "$sucursal_id",
                "total_ingresos": {"$sum": "$total"}
            }
        },
        {"$sort": {"total_ingresos": -1}}
    ]
    
    sucursales_cursor = await Sale.aggregate(sucursales_pipeline).to_list()
    sucursales_list = [
        SucursalVenta(sucursal_id=doc["_id"], total_ingresos=doc["total_ingresos"])
        for doc in sucursales_cursor
    ]
    ventas_por_sucursal = VentasPorSucursal(detalle=sucursales_list)

    # ==========================================
    # PIPELINE 3: Top 5 Productos MÁS VENDIDOS
    # Usa un $unwind sobre los items para sumarlos
    # ==========================================
    top_productos_pipeline = [
        base_match,
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": "$items.producto_id",
                "nombre": {"$first": "$items.descripcion"},
                "cantidad_vendida": {"$sum": "$items.cantidad"},
                "ingresos": {"$sum": "$items.subtotal"}
            }
        },
        {"$sort": {"cantidad_vendida": -1}},
        {"$limit": 5}
    ]
    
    top_productos_cursor = await Sale.aggregate(top_productos_pipeline).to_list()
    productos_list = [
        ProductoTop(
            producto_id=doc["_id"],
            nombre=doc["nombre"],
            cantidad_vendida=doc["cantidad_vendida"],
            ingresos=doc["ingresos"]
        ) for doc in top_productos_cursor
    ]
    top_productos = TopProductos(productos=productos_list)

    return DashboardResponse(
        kpis=kpis,
        ventas_por_sucursal=ventas_por_sucursal,
        top_productos=top_productos
    )
