from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from app.auth import get_current_active_user
from app.models.user import User, UserRole
from app.models.sale_item import SaleItem
from app.models.sucursal import Sucursal
from app.models.sale import Sale
from app.models.caja import CajaMovimiento, SubtipoMovimiento
from datetime import datetime, timedelta, time

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
    # Según CSV estimado: Fábrica = ~72%, Distribuidor = ~85% del PVP final
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
                "costo_fabrica": {"$sum": {"$multiply": ["$subtotal", 0.72]}},
                "ingreso_distribuidor": {"$sum": {"$multiply": ["$subtotal", 0.85]}}
            }
        },
        {
            "$project": {
                "total_ventas": 1,
                "total_productos": 1,
                # Ganancia Matriz = (Precio Distribuidor) - (Costo Fabrica)
                "ganancia_matriz": {"$subtract": ["$ingreso_distribuidor", "$costo_fabrica"]},
                # Ganancia Sucursal = (Precio Final) - (Precio Distribuidor)
                "ganancia_sucursal": {"$subtract": ["$total_ventas", "$ingreso_distribuidor"]}
            }
        }
    ]
    
    cursor = SaleItem.get_pymongo_collection().aggregate(kpis_pipeline)
    kpis_cursor = await cursor.to_list(length=1)
    kpis = kpis_cursor[0] if kpis_cursor else {
        "total_ventas": 0, "total_productos": 0, "ganancia_matriz": 0, "ganancia_sucursal": 0
    }
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
                "costo_fabrica": {"$sum": {"$multiply": ["$subtotal", 0.72]}},
                "ingreso_distribuidor": {"$sum": {"$multiply": ["$subtotal", 0.85]}}
            }
        },
        {
            "$project": {
                "sucursal_id_raw": "$_id",
                "total_ventas": 1,
                "ganancia_matriz": {"$subtract": ["$ingreso_distribuidor", "$costo_fabrica"]},
                "ganancia_sucursal": {"$subtract": ["$total_ventas", "$ingreso_distribuidor"]},
                "_id": 0
            }
        },
        {"$sort": {"total_ventas": -1}}
    ]
    cursor = SaleItem.get_pymongo_collection().aggregate(sucursal_pipeline)
    ventas_por_sucursal_raw = await cursor.to_list(length=100)
    
    # Resolver nombres en Python usando el modelo Sucursal (no Tenant)
    todas_sucursales = await Sucursal.find(Sucursal.tenant_id == tenant_id).to_list()
    map_sucursales = {str(s.id): s.nombre for s in todas_sucursales}
    
    ventas_por_sucursal = []
    for reg in ventas_por_sucursal_raw:
        sid = reg.get("sucursal_id_raw")
        reg["sucursal"] = map_sucursales.get(str(sid), str(sid))
        
        # Opcional, limpiar
        if "sucursal_id_raw" in reg:
            del reg["sucursal_id_raw"]
            
        ventas_por_sucursal.append(reg)
    
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
                "costo_fabrica": {"$sum": {"$multiply": ["$subtotal", 0.72]}},
                "ingreso_distribuidor": {"$sum": {"$multiply": ["$subtotal", 0.85]}}
            }
        },
        {
            "$project": {
                "producto": "$_id",
                "cantidad_vendida": 1,
                "total_ventas": 1,
                "ganancia_matriz": {"$subtract": ["$ingreso_distribuidor", "$costo_fabrica"]},
                "ganancia_sucursal": {"$subtract": ["$total_ventas", "$ingreso_distribuidor"]},
                "_id": 0
            }
        },
        {"$sort": {"cantidad_vendida": -1}},
        {"$limit": 10}
    ]
    cursor = SaleItem.get_pymongo_collection().aggregate(top_products_pipeline)
    top_productos = await cursor.to_list(length=10)
    
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
                "costo_fabrica": {"$sum": {"$multiply": ["$subtotal", 0.72]}},
                "ingreso_distribuidor": {"$sum": {"$multiply": ["$subtotal", 0.85]}}
            }
        },
        {
            "$project": {
                "fecha": "$_id",
                "total_ventas": 1,
                "ganancia_matriz": {"$subtract": ["$ingreso_distribuidor", "$costo_fabrica"]},
                "ganancia_sucursal": {"$subtract": ["$total_ventas", "$ingreso_distribuidor"]},
                "_id": 0
            }
        },
        {"$sort": {"fecha": 1}}
    ]
    cursor = SaleItem.get_pymongo_collection().aggregate(diaria_pipeline)
    evolucion_diaria = await cursor.to_list(length=100)
    
    return {
        "kpis": kpis,
        "por_sucursal": ventas_por_sucursal,
        "top_productos": top_productos,
        "evolucion_diaria": evolucion_diaria
    }

@router.get("/daily-report")
async def get_daily_report(
    date: str, # YYYY-MM-DD
    sucursal_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    Returns a detailed daily report for a specific branch.
    Accessible by Matriz admins (for any branch) or Branch admins (only for their branch).
    """
    tenant_id = current_user.tenant_id or "default"
    
    # Permission check
    target_sucursal = sucursal_id
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR]:
        target_sucursal = current_user.sucursal_id
    elif not target_sucursal:
         # For general admins, if no sucursal is provided, they might want a global daily report or it might be an error.
         # Let's assume they MUST provide one or we take a default one like "CENTRAL".
         target_sucursal = "CENTRAL"

    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")
    
    start_dt = datetime.combine(dt, time.min)
    end_dt = datetime.combine(dt, time.max)

    # 1. Sales summary (Pagos)
    sales = await Sale.find(
        Sale.tenant_id == tenant_id,
        Sale.sucursal_id == target_sucursal,
        Sale.created_at >= start_dt,
        Sale.created_at <= end_dt
    ).to_list()

    ventas_por_metodo = {"EFECTIVO": 0.0, "QR": 0.0, "TARJETA": 0.0, "TRANSFERENCIA": 0.0}
    total_ventas = 0.0
    total_descuentos = 0.0
    anuladas_count = 0
    anuladas_monto = 0.0
    
    for s in sales:
        if s.anulada:
            anuladas_count += 1
            anuladas_monto += s.total
            continue
            
        total_ventas += s.total
        if s.descuento:
            total_descuentos += s.descuento.valor
            
        for p in s.pagos:
            metodo = p.metodo.upper()
            if metodo in ventas_por_metodo:
                ventas_por_metodo[metodo] += p.monto
            else:
                ventas_por_metodo[metodo] = ventas_por_metodo.get(metodo, 0) + p.monto

    # 2. Expenses (Gastos) from CajaMovimiento
    movimientos = await CajaMovimiento.find(
        CajaMovimiento.tenant_id == tenant_id,
        CajaMovimiento.sucursal_id == target_sucursal,
        CajaMovimiento.fecha >= start_dt,
        CajaMovimiento.fecha <= end_dt
    ).to_list()

    total_gastos = 0.0
    gastos_list = []
    
    for m in movimientos:
        if m.tipo == "EGRESO" and m.subtipo == SubtipoMovimiento.GASTO:
            total_gastos += m.monto
            gastos_list.append({
                "descripcion": m.descripcion,
                "monto": m.monto,
                "cajero": m.cajero_name,
                "hora": m.fecha.strftime("%H:%M")
            })

    # 3. Simple inventory items sold count
    items_vendidos_pipeline = [
        {
            "$match": {
                "tenant_id": tenant_id,
                "sucursal_id": target_sucursal,
                "sale_date": {"$gte": start_dt, "$lte": end_dt}
            }
        },
        {
            "$group": {
                "_id": "$descripcion",
                "cantidad": {"$sum": "$cantidad"},
                "subtotal": {"$sum": "$subtotal"}
            }
        },
        {"$sort": {"cantidad": -1}}
    ]
    cursor = SaleItem.get_pymongo_collection().aggregate(items_vendidos_pipeline)
    items_summary = await cursor.to_list(length=100)
    items_list = [{"producto": i["_id"], "cantidad": i["cantidad"], "total": i["subtotal"]} for i in items_summary]

    return {
        "fecha": date,
        "sucursal_id": target_sucursal,
        "resumen_ventas": {
            "total_bruto": total_ventas,
            "total_descuentos": total_descuentos,
            "por_metodo": ventas_por_metodo,
            "anuladas": {
                "cantidad": anuladas_count,
                "monto": anuladas_monto
            }
        },
        "gastos": {
            "total": total_gastos,
            "detalle": gastos_list
        },
        "items_vendidos": items_list,
        "balance_neto": (ventas_por_metodo["EFECTIVO"] - total_gastos) # Balance de caja física solo efectivo
    }

@router.get("/financial-report")
async def get_financial_report(
    start_date: str, # YYYY-MM-DD
    end_date: str,   # YYYY-MM-DD
    sucursal_id: Optional[str] = "all", 
    current_user: User = Depends(get_current_active_user)
):
    """
    Returns a financial detail report for General Admins.
    Shows Público, Fábrica, Margen 15%, Margen Retail and Margen Total.
    """
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMIN_MATRIZ]:
        raise HTTPException(status_code=403, detail="Acceso denegado. Solo administradores generales pueden ver este reporte.")
        
    tenant_id = current_user.tenant_id or "default"
    
    try:
        s_dt = datetime.strptime(start_date, "%Y-%m-%d")
        e_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")

    s_dt = datetime.combine(s_dt, time.min)
    e_dt = datetime.combine(e_dt, time.max)

    match_filter = {
        "tenant_id": tenant_id,
        "sale_date": {"$gte": s_dt, "$lte": e_dt}
    }
    
    if sucursal_id and sucursal_id != "all":
        match_filter["sucursal_id"] = sucursal_id

    pipeline = [
        {"$match": match_filter},
        {
            "$group": {
                "_id": {
                    "fecha": { "$dateToString": { "format": "%Y-%m-%d", "date": "$sale_date" } },
                    "sucursal_id": "$sucursal_id"
                },
                "total_publico": {"$sum": "$subtotal"},
                "total_fabrica": {"$sum": {"$multiply": ["$costo_unitario", "$cantidad"]}},
            }
        },
        {
            "$project": {
                "fecha": "$_id.fecha",
                "sucursal_id": "$_id.sucursal_id",
                "total_publico": 1,
                "total_fabrica": 1,
                # Margen 15% (Distribuidor) = 15% del costo de fabrica
                "margen_distribuidor": {"$multiply": ["$total_fabrica", 0.15]},
                # Margen Utilidad (Retail) = Venta al publico - (Costo fabrica + Margen Distribuidor)
                "margen_retail": {"$subtract": ["$total_publico", {"$multiply": ["$total_fabrica", 1.15]}]},
                "_id": 0
            }
        },
        {
            "$project": {
                "fecha": 1,
                "sucursal_id": 1,
                "total_publico": 1,
                "total_fabrica": 1,
                "margen_distribuidor": 1,
                "margen_retail": 1,
                "margen_total": {"$add": ["$margen_distribuidor", "$margen_retail"]}
            }
        },
        {"$sort": {"fecha": 1, "sucursal_id": 1}}
    ]

    cursor = SaleItem.get_pymongo_collection().aggregate(pipeline)
    results = await cursor.to_list(length=2000)

    # Resolve sucursal names
    todas_sucursales = await Sucursal.find(Sucursal.tenant_id == tenant_id).to_list()
    map_sucursales = {str(s.id): s.nombre for s in todas_sucursales}
    
    for r in results:
        r["sucursal_nombre"] = map_sucursales.get(r["sucursal_id"], r["sucursal_id"])

    return results
