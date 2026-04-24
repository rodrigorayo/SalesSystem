from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional
from decimal import Decimal
from app.infrastructure.auth import get_current_active_user
from app.domain.models.user import User, UserRole
from app.domain.models.sale_item import SaleItem
from app.domain.models.sucursal import Sucursal
from app.domain.models.sale import Sale
from app.domain.models.caja import CajaMovimiento, SubtipoMovimiento
from app.domain.models.inventario import Inventario
from app.domain.models.product import Product
from app.utils.serializers import normalize_bson
from datetime import datetime, timedelta, time, timezone
from app.utils.date_utils import BOLIVIA_TZ, get_day_range_bolivia


_ZERO = Decimal("0")  # Constante DRY para el valor cero monetario

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
    
    # 00:00:00 of X days ago in Bolivia time, converted to UTC
    now_bo = datetime.now(BOLIVIA_TZ)
    start_bo = (now_bo - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = start_bo.astimezone(timezone.utc) # UTC

    
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
                "costo_total": {"$sum": {"$multiply": ["$costo_unitario", "$cantidad"]}},
                "ganancia_matriz": {"$sum": {"$multiply": ["$costo_unitario", "$cantidad", 0.15]}}
            }
        },
        {
            "$project": {
                "total_ventas": 1,
                "total_productos": 1,
                "ganancia_matriz": 1,
                # Ganancia Sucursal = (Precio de Venta Total) - (Costo Unitario * Cantidad)
                "ganancia_sucursal": {"$subtract": ["$total_ventas", "$costo_total"]}
            }
        }
    ]
    
    cursor = SaleItem.get_pymongo_collection().aggregate(kpis_pipeline)
    kpis_cursor = await cursor.to_list(length=1)
    kpis = normalize_bson(kpis_cursor[0]) if kpis_cursor else {
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
                "costo_total": {"$sum": {"$multiply": ["$costo_unitario", "$cantidad"]}},
                "ganancia_matriz": {"$sum": {"$multiply": ["$costo_unitario", "$cantidad", 0.15]}}
            }
        },
        {
            "$project": {
                "sucursal_id_raw": "$_id",
                "total_ventas": 1,
                "ganancia_matriz": 1,
                "ganancia_sucursal": {"$subtract": ["$total_ventas", "$costo_total"]},
                "_id": 0
            }
        },
        {"$sort": {"total_ventas": -1}}
    ]
    cursor = SaleItem.get_pymongo_collection().aggregate(sucursal_pipeline)
    ventas_por_sucursal_raw = await cursor.to_list(length=100)
    ventas_por_sucursal_raw = [normalize_bson(r) for r in ventas_por_sucursal_raw]
    
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
                "costo_total": {"$sum": {"$multiply": ["$costo_unitario", "$cantidad"]}},
                "ganancia_matriz": {"$sum": {"$multiply": ["$costo_unitario", "$cantidad", 0.15]}}
            }
        },
        {
            "$project": {
                "producto": "$_id",
                "cantidad_vendida": 1,
                "total_ventas": 1,
                "ganancia_matriz": 1,
                "ganancia_sucursal": {"$subtract": ["$total_ventas", "$costo_total"]},
                "_id": 0
            }
        },
        {"$sort": {"cantidad_vendida": -1}},
        {"$limit": 10}
    ]
    cursor = SaleItem.get_pymongo_collection().aggregate(top_products_pipeline)
    top_productos = [normalize_bson(r) for r in await cursor.to_list(length=10)]
    
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
                "_id": { "$dateToString": { "format": "%Y-%m-%d", "date": "$sale_date", "timezone": "-04:00" } },
                "total_ventas": {"$sum": "$subtotal"},
                "costo_total": {"$sum": {"$multiply": ["$costo_unitario", "$cantidad"]}},
                "ganancia_matriz": {"$sum": {"$multiply": ["$costo_unitario", "$cantidad", 0.15]}}
            }
        },
        {
            "$project": {
                "fecha": "$_id",
                "total_ventas": 1,
                "ganancia_matriz": 1,
                "ganancia_sucursal": {"$subtract": ["$total_ventas", "$costo_total"]},
                "_id": 0
            }
        },
        {"$sort": {"fecha": 1}}
    ]
    cursor = SaleItem.get_pymongo_collection().aggregate(diaria_pipeline)
    evolucion_diaria = [normalize_bson(r) for r in await cursor.to_list(length=100)]
    
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
        start_dt, end_dt = get_day_range_bolivia(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")


    # 1. Sales summary (Pagos)
    sales = await Sale.find(
        Sale.tenant_id == tenant_id,
        Sale.sucursal_id == target_sucursal,
        Sale.created_at >= start_dt,
        Sale.created_at <= end_dt
    ).to_list()

    ventas_por_metodo: Dict[str, Decimal] = {
        "EFECTIVO": _ZERO, "QR": _ZERO, "TARJETA": _ZERO, "TRANSFERENCIA": _ZERO
    }
    total_ventas    = _ZERO
    total_descuentos = _ZERO
    anuladas_count  = 0
    anuladas_monto  = _ZERO
    
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
            ventas_por_metodo[metodo] = ventas_por_metodo.get(metodo, _ZERO) + p.monto

    # 2. Expenses (Gastos) from CajaMovimiento
    movimientos = await CajaMovimiento.find(
        CajaMovimiento.tenant_id == tenant_id,
        CajaMovimiento.sucursal_id == target_sucursal,
        CajaMovimiento.fecha >= start_dt,
        CajaMovimiento.fecha <= end_dt
    ).to_list()

    total_gastos = _ZERO
    gastos_list = []
    
    for m in movimientos:
        if m.tipo == "EGRESO" and m.subtipo == SubtipoMovimiento.GASTO:
            total_gastos += m.monto
            gastos_list.append({
                "descripcion": m.descripcion,
                "monto": float(m.monto),
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
    items_list = [
        {
            "producto": i["_id"],
            "cantidad": i["cantidad"],
            "total": float(i["subtotal"].to_decimal()) if type(i["subtotal"]).__name__ == "Decimal128" else float(i["subtotal"])
        }
        for i in items_summary
    ]

    return {
        "fecha": date,
        "sucursal_id": target_sucursal,
        "resumen_ventas": {
            "total_bruto":      float(total_ventas),
            "total_descuentos": float(total_descuentos),
            "por_metodo":       {k: float(v) for k, v in ventas_por_metodo.items()},
            "anuladas": {
                "cantidad": anuladas_count,
                "monto":    float(anuladas_monto)
            }
        },
        "gastos": {
            "total":   float(total_gastos),
            "detalle": gastos_list
        },
        "items_vendidos": items_list,
        "balance_neto": float(ventas_por_metodo.get("EFECTIVO", _ZERO) - total_gastos)
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
        start_dt, _ = get_day_range_bolivia(start_date)
        _, end_dt = get_day_range_bolivia(end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")


    match_filter = {
        "tenant_id": tenant_id,
        "sale_date": {"$gte": start_dt, "$lte": end_dt}
    }
    
    if sucursal_id and sucursal_id != "all":
        match_filter["sucursal_id"] = sucursal_id

    pipeline = [
        {"$match": match_filter},
        {
            "$group": {
                "_id": {
                    "fecha": { "$dateToString": { "format": "%Y-%m-%d", "date": "$sale_date", "timezone": "-04:00" } },
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
                # Margen Utilidad (Retail) = Venta al publico - Costo fabrica
                "margen_retail": {"$subtract": ["$total_publico", "$total_fabrica"]},
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
    results = [normalize_bson(r) for r in await cursor.to_list(length=2000)]

    # Resolve sucursal names
    todas_sucursales = await Sucursal.find(Sucursal.tenant_id == tenant_id).to_list()
    map_sucursales = {str(s.id): s.nombre for s in todas_sucursales}
    
    for r in results:
        r["sucursal_nombre"] = map_sucursales.get(r["sucursal_id"], r["sucursal_id"])

    return results

@router.get("/valued-inventory")
async def get_valued_inventory(current_user: User = Depends(get_current_active_user)):
    """
    Returns the total value of inventory (cantidad * costo_producto)
    grouped by branch, plus a detailed breakdown.
    Admin Sucursal can see their own branch.
    Admin Matriz/SuperAdmin can see all branches.
    """
    tenant_id = current_user.tenant_id or ""
    
    match_filter = {"tenant_id": tenant_id}
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR]:
        match_filter["sucursal_id"] = current_user.sucursal_id

    # Pipeline to join with Products and calculate value
    pipeline = [
        {"$match": match_filter},
        {
            "$lookup": {
                "from": Product.get_collection_name(),
                "let": {"pid": "$producto_id"},
                "pipeline": [
                    {"$match": {
                        "$expr": {"$eq": [{"$toString": "$_id"}, "$$pid"]}
                    }}
                ],
                "as": "product_info"
            }
        },
        {"$unwind": { "path": "$product_info", "preserveNullAndEmptyArrays": True }},
        {
            "$project": {
                "sucursal_id": 1,
                "producto_id": 1,
                "cantidad": 1,
                "producto_nombre": {"$ifNull": ["$product_info.descripcion", "Producto Desconocido"]},
                "costo_producto": {"$ifNull": ["$product_info.costo_producto", 0]},
                "precio_venta": {
                    "$ifNull": [
                        "$precio_sucursal", 
                        {"$ifNull": ["$product_info.precio_venta", 0]}
                    ]
                },
                "valor_fabrica": {
                    "$multiply": ["$cantidad", {"$ifNull": ["$product_info.costo_producto", 0]}]
                },
                "valor_publico": {
                    "$multiply": [
                        "$cantidad", 
                        {
                            "$ifNull": [
                                "$precio_sucursal", 
                                {"$ifNull": ["$product_info.precio_venta", 0]}
                            ]
                        }
                    ]
                }
            }
        },
        {
            "$group": {
                "_id": "$sucursal_id",
                "total_items": {"$sum": "$cantidad"},
                "valor_total_fabrica_sucursal": {"$sum": "$valor_fabrica"},
                "valor_total_publico_sucursal": {"$sum": "$valor_publico"},
                "desglose": {
                    "$push": {
                        "producto_id": "$producto_id",
                        "producto_nombre": "$producto_nombre",
                        "cantidad": "$cantidad",
                        "costo_unitario": "$costo_producto",
                        "precio_publico_unitario": "$precio_venta",
                        "valor_fabrica": "$valor_fabrica",
                        "valor_publico": "$valor_publico"
                    }
                }
            }
        },
        {"$sort": {"valor_total_fabrica_sucursal": -1}}
    ]

    cursor = Inventario.get_pymongo_collection().aggregate(pipeline)
    raw_results = await cursor.to_list(length=100)
    
    # Resolve sucursal names
    todas_sucursales = await Sucursal.find(Sucursal.tenant_id == tenant_id).to_list()
    map_sucursales = {str(s.id): s.nombre for s in todas_sucursales}
    map_sucursales["CENTRAL"] = "Almacén Central (Matriz)"

    results = []
    total_general_fabrica = Decimal("0")
    total_general_publico = Decimal("0")

    for r in raw_results:
        norm = normalize_bson(r)
        sid = norm.get("_id")
        norm["sucursal_id"] = sid
        norm["sucursal_nombre"] = map_sucursales.get(str(sid), str(sid))
        total_general_fabrica += Decimal(str(norm.get("valor_total_fabrica_sucursal", 0)))
        total_general_publico += Decimal(str(norm.get("valor_total_publico_sucursal", 0)))
        del norm["_id"]
        results.append(norm)

    return {
        "total_general_fabrica": float(total_general_fabrica),
        "total_general_publico": float(total_general_publico),
        "ganancia_potencial": float(total_general_publico - total_general_fabrica),
        "por_sucursal": results
    }

@router.get("/sales-by-hour")
async def get_sales_by_hour(
    date: str, # YYYY-MM-DD
    sucursal_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    Returns total sales grouped by hour for a specific day.
    """
    tenant_id = current_user.tenant_id or "default"
    
    target_sucursal = sucursal_id
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR]:
        target_sucursal = current_user.sucursal_id

    try:
        start_dt, end_dt = get_day_range_bolivia(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")

    match_filter = {
        "tenant_id": tenant_id,
        "anulada": False,
        "created_at": {"$gte": start_dt, "$lte": end_dt}
    }
    
    if target_sucursal and target_sucursal != "all":
        match_filter["sucursal_id"] = target_sucursal

    pipeline = [
        {"$match": match_filter},
        {
            "$project": {
                # Convertir a hora Bolivia (-04:00) para agrupar correctamente
                "hour": {"$hour": {"date": "$created_at", "timezone": "-04:00"}},
                "total": 1
            }
        },
        {
            "$group": {
                "_id": "$hour",
                "total_ventas": {"$sum": "$total"},
                "cantidad_ventas": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]

    cursor = Sale.get_pymongo_collection().aggregate(pipeline)
    raw_results = await cursor.to_list(length=24)
    
    # Generar un arreglo con todas las horas (0-23) para que el gráfico no tenga huecos
    hourly_data = {i: {"hour": f"{i:02d}:00", "total_ventas": 0.0, "cantidad_ventas": 0} for i in range(24)}
    
    for r in raw_results:
        h = r["_id"]
        hourly_data[h]["total_ventas"] = float(r["total_ventas"].to_decimal()) if type(r["total_ventas"]).__name__ == "Decimal128" else float(r["total_ventas"])
        hourly_data[h]["cantidad_ventas"] = r["cantidad_ventas"]

    # Filtrar solo desde la primera hora con ventas hasta la última (o 8am a 10pm por defecto si prefieres)
    # Por ahora devolvemos todo y el frontend decide si mostrar las 24 hrs
    return list(hourly_data.values())

@router.get("/staff-performance")
async def get_staff_performance(
    date: str, # YYYY-MM-DD
    sucursal_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    Returns sales grouped by cashier and by vendor for a specific day.
    """
    tenant_id = current_user.tenant_id or "default"
    
    target_sucursal = sucursal_id
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR]:
        target_sucursal = current_user.sucursal_id

    try:
        start_dt, end_dt = get_day_range_bolivia(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")

    match_filter = {
        "tenant_id": tenant_id,
        "anulada": False,
        "created_at": {"$gte": start_dt, "$lte": end_dt}
    }
    
    if target_sucursal and target_sucursal != "all":
        match_filter["sucursal_id"] = target_sucursal

    # Pipeline para obtener el desglose de productos y categorías por staff
    def get_details_pipeline(staff_field):
        return [
            {"$match": match_filter},
            {"$unwind": "$items"},
            # Lookup de productos para obtener categoría
            {"$addFields": {"tmp_prod_id": {"$toObjectId": "$items.producto_id"}}},
            {"$lookup": {
                "from": "products",
                "localField": "tmp_prod_id",
                "foreignField": "_id",
                "as": "product_info"
            }},
            {"$unwind": {"path": "$product_info", "preserveNullAndEmptyArrays": True}},
            # Lookup de categorías
            {"$addFields": {"tmp_cat_id": {"$toObjectId": "$product_info.categoria_id"}}},
            {"$lookup": {
                "from": "categories",
                "localField": "tmp_cat_id",
                "foreignField": "_id",
                "as": "category_info"
            }},
            {"$unwind": {"path": "$category_info", "preserveNullAndEmptyArrays": True}},
            # Agrupar por Staff -> Categoría -> Producto
            {"$group": {
                "_id": {
                    "staff": {"$ifNull": [f"${staff_field}", "Desconocido"]},
                    "categoria": {"$ifNull": ["$category_info.nombre", "Sin Categoría"]},
                    "producto": "$items.descripcion"
                },
                "cantidad": {"$sum": "$items.cantidad"},
                "total": {"$sum": "$items.subtotal"}
            }},
            # Anidar productos en categorías
            {"$group": {
                "_id": {
                    "staff": "$_id.staff",
                    "categoria": "$_id.categoria"
                },
                "productos": {"$push": {
                    "nombre": "$_id.producto",
                    "cantidad": "$cantidad",
                    "total": "$total"
                }},
                "total_categoria": {"$sum": "$total"}
            }},
            # Anidar categorías en staff
            {"$group": {
                "_id": "$_id.staff",
                "categorias": {"$push": {
                    "nombre": "$_id.categoria",
                    "total": "$total_categoria",
                    "productos": "$productos"
                }},
                "total_items": {"$sum": "$total_categoria"}
            }},
            {"$sort": {"total_items": -1}}
        ]

    pipeline = [
        {"$match": match_filter},
        {"$facet": {
            "resumen_cajeros": [
                {"$group": {
                    "_id": {"$ifNull": ["$cashier_name", "Cajero Desconocido"]},
                    "total_ventas": {"$sum": "$total"},
                    "cantidad_ventas": {"$sum": 1}
                }},
                {"$sort": {"total_ventas": -1}}
            ],
            "resumen_vendedores": [
                {"$group": {
                    "_id": {"$ifNull": ["$vendedor_name", "Sin Vendedor Asignado"]},
                    "total_ventas": {"$sum": "$total"},
                    "cantidad_ventas": {"$sum": 1}
                }},
                {"$sort": {"total_ventas": -1}}
            ],
            "detalles_cajeros": get_details_pipeline("cashier_name"),
            "detalles_vendedores": get_details_pipeline("vendedor_name")
        }}
    ]

    cursor = Sale.get_pymongo_collection().aggregate(pipeline)
    raw_results = await cursor.to_list(length=1)
    
    if not raw_results:
        return {"cajeros": [], "vendedores": []}
        
    facet = raw_results[0]
    
    # Helper para formatear Decimal128
    def fmt_val(v):
        if v is None: return 0.0
        return float(v.to_decimal()) if type(v).__name__ == "Decimal128" else float(v)

    # Mapear detalles para acceso rápido
    detalles_caj_map = {d["_id"]: d["categorias"] for d in facet.get("detalles_cajeros", [])}
    detalles_ven_map = {d["_id"]: d["categorias"] for d in facet.get("detalles_vendedores", [])}

    # Formatear Cajeros
    cajeros = []
    for c in facet.get("resumen_cajeros", []):
        nombre = c["_id"]
        cajeros.append({
            "nombre": nombre,
            "total_ventas": fmt_val(c["total_ventas"]),
            "cantidad_ventas": c["cantidad_ventas"],
            "categorias": [
                {
                    "nombre": cat["nombre"],
                    "total": fmt_val(cat["total"]),
                    "productos": [
                        {
                            "nombre": p["nombre"],
                            "cantidad": p["cantidad"],
                            "total": fmt_val(p["total"])
                        } for p in cat["productos"]
                    ]
                } for cat in detalles_caj_map.get(nombre, [])
            ]
        })
        
    # Formatear Vendedores
    vendedores = []
    for v in facet.get("resumen_vendedores", []):
        nombre = v["_id"]
        vendedores.append({
            "nombre": nombre,
            "total_ventas": fmt_val(v["total_ventas"]),
            "cantidad_ventas": v["cantidad_ventas"],
            "categorias": [
                {
                    "nombre": cat["nombre"],
                    "total": fmt_val(cat["total"]),
                    "productos": [
                        {
                            "nombre": p["nombre"],
                            "cantidad": p["cantidad"],
                            "total": fmt_val(p["total"])
                        } for p in cat["productos"]
                    ]
                } for cat in detalles_ven_map.get(nombre, [])
            ]
        })

    return {
        "cajeros": cajeros,
        "vendedores": vendedores
    }
