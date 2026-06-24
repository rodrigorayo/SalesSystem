"""
rentabilidad_service.py — OPTIMIZADO
=====================================
- Queries paralelas con asyncio.gather
- Caché en memoria (60s TTL para 'today', 300s para el resto)
- Aggregation pipelines en MongoDB para reducir data transfer
"""

import asyncio
import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from app.db import get_raw_db

# ─── Caché en memoria ─────────────────────────────────────────────────────────
_rent_cache: Dict[str, tuple] = {}

def _suc_regex(sucursal_id: str) -> dict:
    s = sucursal_id.lower()
    if "hero" in s:
        return {"$regex": "hero.*nas?", "$options": "i"}
    return {"$regex": s, "$options": "i"}


async def get_rentabilidad_real(
    tenant_id: str,
    start_date: datetime,
    end_date: datetime,
    sucursal_id: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Tabla de rentabilidad por producto con costos REALES.
    Usa asyncio.gather para lanzar todas las queries en paralelo.
    """
    if start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=timezone.utc)
    if end_date.tzinfo is None:
        end_date = end_date.replace(tzinfo=timezone.utc)

    # Caché key — TTL corto si es "hoy"
    now_ts = time.time()
    is_today = (datetime.now(timezone.utc).date() == start_date.date() == end_date.date())
    ttl = 30 if is_today else 300
    cache_key = f"rent_{sucursal_id}_{start_date.date()}_{end_date.date()}_{limit}"
    if cache_key in _rent_cache:
        cached_ts, cached_data = _rent_cache[cache_key]
        if now_ts - cached_ts < ttl:
            return cached_data

    db = await get_raw_db()

    # ── Resolver sucursal_ids en paralelo con los demás queries ───────────────
    async def get_suc_ids():
        if not sucursal_id:
            return None
        docs = await db.sucursales.find(
            {"nombre": _suc_regex(sucursal_id)}, {"_id": 1}
        ).to_list(20)
        return [str(d["_id"]) for d in docs]

    async def get_product_costs():
        prods = await db.products.find(
            {}, {"descripcion": 1, "costo_producto": 1}
        ).to_list(5000)
        costs: Dict[str, float] = {}
        for p in prods:
            k = str(p.get("descripcion", "")).strip().upper()
            try:
                costs[k] = float(str(p.get("costo_producto", 0)))
            except Exception:
                costs[k] = 0.0
        return costs

    async def get_suc_names():
        docs = await db.sucursales.find({}, {"_id": 1, "nombre": 1}).to_list(100)
        m = {str(d["_id"]): d["nombre"] for d in docs}
        m["CENTRAL"] = "Central"
        return m

    # Lanzar lookup de sucursal_ids + costos + nombres de sucursal EN PARALELO
    suc_ids, product_costs, suc_name_map = await asyncio.gather(
        get_suc_ids(),
        get_product_costs(),
        get_suc_names(),
    )

    # ── Build match filters ────────────────────────────────────────────────────
    pos_match: Dict[str, Any] = {
        "anulada": {"$ne": True},
        "created_at": {"$gte": start_date, "$lte": end_date},
    }
    if suc_ids:
        pos_match["sucursal_id"] = {"$in": suc_ids}
    elif sucursal_id:
        pos_match["sucursal_id"] = {"$regex": sucursal_id, "$options": "i"}

    hist_match: Dict[str, Any] = {
        "fecha_transaccion": {"$gte": start_date, "$lte": end_date},
    }
    if sucursal_id:
        hist_match["sucursal"] = _suc_regex(sucursal_id)

    # ── Pipelines de aggregation (procesan en MongoDB, no en Python) ──────────
    pos_pipeline = [
        {"$match": pos_match},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.descripcion",
            "unidades":        {"$sum": {"$toInt": "$items.cantidad"}},
            "ingreso_bruto":   {"$sum": {"$toDouble": "$items.subtotal"}},
            "costo_real":      {"$sum": {"$multiply": [
                {"$toDouble": "$items.costo_unitario"},
                {"$toDouble": "$items.cantidad"}
            ]}},
            "descuentos":      {"$sum": {"$multiply": [
                {"$toDouble": "$items.descuento_unitario"},
                {"$toDouble": "$items.cantidad"}
            ]}},
            "producto_id_ref": {"$first": "$items.producto_id"},
        }},
    ]

    hist_pipeline = [
        {"$match": hist_match},
        {"$group": {
            "_id": "$nombre_producto",
            "unidades":      {"$sum": {"$toDouble": {"$ifNull": ["$cantidad_vendida", 1]}}},
            "ingreso_bruto": {"$sum": {"$toDouble": "$monto_total_bs"}},
        }},
    ]

    # ── Lanzar POS + Historial EN PARALELO ────────────────────────────────────
    pos_docs, hist_docs = await asyncio.gather(
        db.sales.aggregate(pos_pipeline).to_list(5000),
        db.ventas_historicas_crudas.aggregate(hist_pipeline).to_list(5000),
    )

    # ── Construir mapas ───────────────────────────────────────────────────────
    pos_map: Dict[str, dict] = {}
    for d in pos_docs:
        name = str(d["_id"] or "Sin nombre")
        pos_map[name] = {
            "unidades":        int(d.get("unidades", 0)),
            "ingreso_bruto":   float(d.get("ingreso_bruto", 0)),
            "costo_real":      float(d.get("costo_real", 0)),
            "descuentos":      float(d.get("descuentos", 0)),
            "producto_id_ref": str(d.get("producto_id_ref", "")),
            "fuente": "POS",
        }

    hist_map: Dict[str, dict] = {}
    for d in hist_docs:
        name = str(d["_id"] or "Sin nombre")
        unidades = float(d.get("unidades", 1) or 1)
        ingreso  = float(d.get("ingreso_bruto", 0))
        costo_unit = product_costs.get(name.strip().upper(), 0.0)
        hist_map[name] = {
            "unidades":        unidades,
            "ingreso_bruto":   ingreso,
            "costo_real":      costo_unit * unidades,
            "descuentos":      0.0,
            "producto_id_ref": "",
            "fuente": "HIST",
        }

    # ── MERGE ─────────────────────────────────────────────────────────────────
    merged: Dict[str, dict] = dict(hist_map)
    for name, data in pos_map.items():
        if name in merged:
            merged[name]["unidades"]      += data["unidades"]
            merged[name]["ingreso_bruto"] += data["ingreso_bruto"]
            merged[name]["costo_real"]    += data["costo_real"]
            merged[name]["descuentos"]    += data["descuentos"]
            merged[name]["fuente"] = "POS+HIST"
        else:
            merged[name] = dict(data)

    # ── STOCK: query en paralelo al inventario ────────────────────────────────
    prod_ids = list({v["producto_id_ref"] for v in merged.values() if v.get("producto_id_ref")})
    inv_docs = await db.inventario.find(
        {"producto_id": {"$in": prod_ids}},
        {"producto_id": 1, "sucursal_id": 1, "cantidad": 1}
    ).to_list(50000)

    stock_map: Dict[str, Dict[str, int]] = {}
    for inv in inv_docs:
        pid   = str(inv.get("producto_id", ""))
        sname = suc_name_map.get(str(inv.get("sucursal_id", "")), str(inv.get("sucursal_id", "")))
        qty   = int(inv.get("cantidad", 0) or 0)
        stock_map.setdefault(pid, {})[sname] = qty

    # ── Calcular métricas finales ─────────────────────────────────────────────
    result = []
    for nombre, d in merged.items():
        ingreso  = d["ingreso_bruto"]
        costo    = d["costo_real"]
        unidades = d["unidades"]
        ganancia_suc    = ingreso - costo
        ganancia_matriz = costo * 0.15
        margen_pct      = (ganancia_suc / ingreso * 100) if ingreso > 0 else 0.0
        result.append({
            "nombre":          nombre,
            "unidades":        int(unidades),
            "ingreso_bruto":   round(ingreso, 2),
            "costo_real":      round(costo, 2),
            "ganancia_suc":    round(ganancia_suc, 2),
            "ganancia_matriz": round(ganancia_matriz, 2),
            "descuentos":      round(d["descuentos"], 2),
            "margen_pct":      round(margen_pct, 1),
            "precio_prom":     round(ingreso / unidades, 2) if unidades > 0 else 0.0,
            "costo_prom":      round(costo  / unidades, 2) if unidades > 0 else 0.0,
            "stock":           stock_map.get(d.get("producto_id_ref", ""), {}),
            "fuente":          d.get("fuente", "?"),
        })

    result.sort(key=lambda x: x["ingreso_bruto"], reverse=True)
    result = result[:limit]

    # Guardar en caché
    _rent_cache[cache_key] = (time.time(), result)
    return result


async def get_kpis_reales(
    tenant_id: str,
    start_date: datetime,
    end_date: datetime,
    sucursal_id: Optional[str] = None,
) -> Dict[str, Any]:
    productos = await get_rentabilidad_real(tenant_id, start_date, end_date, sucursal_id, limit=5000)
    ingreso  = sum(p["ingreso_bruto"]   for p in productos)
    costo    = sum(p["costo_real"]       for p in productos)
    gan_suc  = sum(p["ganancia_suc"]     for p in productos)
    gan_mat  = sum(p["ganancia_matriz"]  for p in productos)
    return {
        "ingreso_bruto":   round(ingreso, 2),
        "costo_real":      round(costo, 2),
        "ganancia_suc":    round(gan_suc, 2),
        "ganancia_matriz": round(gan_mat, 2),
        "margen_pct":      round((gan_suc / ingreso * 100) if ingreso > 0 else 0, 1),
    }

