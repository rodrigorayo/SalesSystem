from datetime import datetime
from typing import Dict, Any, Optional

from app.utils.cache import ttl_cache
from app.schemas.analytics import BCGMatrixResponse, BCGProduct

@ttl_cache(seconds=300)
async def calculate_bcg_matrix(
    tenant_id: str,
    start_date: datetime,
    end_date: datetime,
    sucursal_id: Optional[str] = None
) -> BCGMatrixResponse:
    """
    Motor de Analítica Matriz BCG.
    Lee de ventas_historicas_crudas (datos históricos planos importados).
    Compara el periodo actual vs el periodo equivalente anterior.
    """
    from app.db import get_raw_db
    db = await get_raw_db()

    from datetime import timezone
    # Forzar zona horaria a UTC para que coincida con la DB
    if start_date.tzinfo is None: start_date = start_date.replace(tzinfo=timezone.utc)
    if end_date.tzinfo is None: end_date = end_date.replace(tzinfo=timezone.utc)
    
    # 1. Calcular el periodo previo equivalente
    delta = end_date - start_date
    prev_end_date = start_date
    prev_start_date = start_date - delta

    print(f"[BCG] Periodo actual: {start_date} -> {end_date}")
    print(f"[BCG] Periodo previo: {prev_start_date} -> {prev_end_date}")

    # 2. Helper de pipeline sobre ventas_historicas_crudas (colección histórica plana)
    def pipeline_for_period(start: datetime, end: datetime):
        # Los datos históricos importados tienen tenant_id=None
        # Solo filtramos por tenant cuando hay tenant_id real
        match: Dict[str, Any] = {
            "fecha_transaccion": {"$gte": start, "$lte": end},
        }
        # Solo agregar filtro de tenant si existe (algunos registros tienen tenant_id=None)
    def pipeline_for_period(start: datetime, end: datetime):
        match: Dict[str, Any] = {
            "fecha_transaccion": {"$gte": start, "$lte": end},
        }
        if tenant_id:
            match["$or"] = [
                {"tenant_id": tenant_id},
                {"tenant_id": None},
                {"tenant_id": {"$exists": False}}
            ]
        if sucursal_id:
            s_lower = sucursal_id.lower()
            if 'heroina' in s_lower or 'heroína' in s_lower:
                match["sucursal"] = {"$regex": "hero.*nas?", "$options": "i"}
            else:
                match["sucursal"] = {"$regex": s_lower, "$options": "i"}

        return [
            {"$match": match},
            {
                "$group": {
                    "_id": "$nombre_producto",
                    "nombre": {"$first": "$nombre_producto"},
                    "ingresos": {"$sum": "$monto_total_bs"}
                }
            }
        ]

    def pos_pipeline_for_period(start: datetime, end: datetime):
        match_pos: Dict[str, Any] = {
            "anulada": {"$ne": True},
            "created_at": {"$gte": start, "$lte": end}
        }
        if sucursal_id:
            s_lower = sucursal_id.lower()
            if 'heroina' in s_lower or 'heroína' in s_lower:
                match_pos["sucursal_id"] = {"$regex": "hero.*nas?", "$options": "i"}
            else:
                match_pos["sucursal_id"] = {"$regex": s_lower, "$options": "i"}
        return [
            {"$match": match_pos},
            {"$unwind": "$items"},
            {
                "$group": {
                    "_id": "$items.descripcion",
                    "nombre": {"$first": "$items.descripcion"},
                    "ingresos": {"$sum": {"$toDouble": "$items.subtotal"}}
                }
            }
        ]

    # 3. Ejecutar consultas paralelas (Historial + POS)
    cursor_current_hist = await db["ventas_historicas_crudas"].aggregate(
        pipeline_for_period(start_date, end_date)
    ).to_list(length=2000)
    
    cursor_current_pos = await db["sales"].aggregate(
        pos_pipeline_for_period(start_date, end_date)
    ).to_list(length=2000)
    
    cursor_prev_hist = await db["ventas_historicas_crudas"].aggregate(
        pipeline_for_period(prev_start_date, prev_end_date)
    ).to_list(length=2000)
    
    cursor_prev_pos = await db["sales"].aggregate(
        pos_pipeline_for_period(prev_start_date, prev_end_date)
    ).to_list(length=2000)

    # Consolidar current y prev
    cursor_current = cursor_current_hist + cursor_current_pos
    cursor_prev = cursor_prev_hist + cursor_prev_pos

    # 4. Fusionar datos en RAM
    productos_dict: Dict[str, Dict[str, Any]] = {}

    for doc in cursor_prev:
        pid = str(doc["_id"] or "")
        if not pid:
            continue
        productos_dict[pid] = {
            "nombre": doc.get("nombre") or pid,
            "prev": float(doc.get("ingresos") or 0.0),
            "curr": 0.0
        }

    max_revenue = 0.0
    for doc in cursor_current:
        pid = str(doc["_id"] or "")
        if not pid:
            continue
        ingresos_curr = float(doc.get("ingresos") or 0.0)

        if ingresos_curr > max_revenue:
            max_revenue = ingresos_curr

        if pid in productos_dict:
            productos_dict[pid]["curr"] = ingresos_curr
            productos_dict[pid]["nombre"] = doc.get("nombre") or pid
        else:
            productos_dict[pid] = {
                "nombre": doc.get("nombre") or pid,
                "prev": 0.0,
                "curr": ingresos_curr
            }

    print(f"[BCG] Total productos únicos: {len(productos_dict)} | Max revenue: {max_revenue}")

    # 5. Calcular métricas BCG y clasificar
    response = BCGMatrixResponse()

    for pid, data in productos_dict.items():
        curr = data["curr"]
        prev = data["prev"]

        # Ignorar si no ha vendido nada en los últimos 2 periodos
        if curr == 0 and prev == 0:
            continue

        # Cuota Relativa (0.0 a 1.0) comparado con la Máxima Estrella actual
        cuota_relativa = (curr / max_revenue) if max_revenue > 0 else 0.0

        # Crecimiento de ingresos (Tasa de Variación)
        if prev == 0 and curr > 0:
            crecimiento = 1.0  # Nuevo producto: crecimiento máximo capado al 100%
        elif prev > 0:
            crecimiento = (curr - prev) / prev
        else:
            crecimiento = 0.0

        # Reglas de Clasificación BCG (Umbrales Gerenciales)
        # ALTO CRECIMIENTO: > 5% (0.05)
        # ALTA CUOTA: > 50% de las ventas del producto líder (0.50)
        es_alto_crecimiento = crecimiento >= 0.05
        es_alta_cuota = cuota_relativa >= 0.50

        if es_alto_crecimiento and es_alta_cuota:
            cuadrante = "ESTRELLA"
        elif not es_alto_crecimiento and es_alta_cuota:
            cuadrante = "VACA"
        elif es_alto_crecimiento and not es_alta_cuota:
            cuadrante = "INTERROGANTE"
        else:
            cuadrante = "PERRO"

        # Generar tendencia legible
        pct = crecimiento * 100
        if prev == 0 and curr > 0:
            tendencia_str = "Nuevo ▲ 100%"
        elif pct >= 0:
            tendencia_str = f"Subió {pct:.1f}%"
        else:
            tendencia_str = f"Bajó {abs(pct):.1f}%"

        bcg_product = BCGProduct(
            producto_id=pid,
            nombre=data["nombre"],
            ingresos_actuales=curr,
            ingresos_anteriores=prev,
            crecimiento=crecimiento,
            cuota_relativa=cuota_relativa,
            cuadrante=cuadrante,
            tendencia=tendencia_str,
            badge="up" if crecimiento >= 0 else "down",
            nota="Sugerencia: Liquidación o descontinuar" if cuadrante == "PERRO" and crecimiento < -0.1 else None
        )

        if cuadrante == "ESTRELLA":
            response.estrellas.append(bcg_product)
        elif cuadrante == "VACA":
            response.vacas.append(bcg_product)
        elif cuadrante == "INTERROGANTE":
            response.interrogantes.append(bcg_product)
        else:
            response.perros.append(bcg_product)

    # Ordenar Arrays
    response.estrellas.sort(key=lambda x: x.cuota_relativa, reverse=True)
    response.vacas.sort(key=lambda x: x.cuota_relativa, reverse=True)
    response.interrogantes.sort(key=lambda x: x.crecimiento, reverse=True)
    response.perros.sort(key=lambda x: x.ingresos_actuales, reverse=True)

    print(f"[BCG] Estrellas: {len(response.estrellas)} | Vacas: {len(response.vacas)} | Interrogantes: {len(response.interrogantes)} | Perros: {len(response.perros)}")

    return response
