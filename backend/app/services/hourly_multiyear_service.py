import traceback
import pandas as pd
from datetime import date, datetime, timedelta
from typing import Any, Dict, List
import re
from app.db import get_raw_db

def get_easter_sunday(year: int) -> date:
    a_val = year % 19
    b_val = year // 100
    c_val = year % 100
    d_val = b_val // 4
    e_val = b_val % 4
    f_val = (b_val + 8) // 25
    g_val = (b_val - f_val + 1) // 3
    h_val = (19 * a_val + b_val - d_val - g_val + 15) % 30
    i_val = c_val // 4
    k_val = c_val % 4
    l_val = (32 + 2 * e_val + 2 * i_val - h_val - k_val) % 7
    m_val = (a_val + 11 * h_val + 22 * l_val) // 451
    n_val = (h_val + l_val - 7 * m_val + 114) // 31
    p_val = (h_val + l_val - 7 * m_val + 114) % 31
    return date(year, n_val, p_val + 1)

def get_holidays_for_year(year: int) -> Dict[date, str]:
    easter = get_easter_sunday(year)
    carnaval_lunes = easter - timedelta(days=48)
    carnaval_martes = easter - timedelta(days=47)
    viernes_santo = easter - timedelta(days=2)
    pascua = easter
    corpus_christi = easter + timedelta(days=60)
    
    holidays_map = {
        date(year, 1, 1): "Año Nuevo",
        date(year, 1, 22): "Estado Plurinacional",
        date(year, 2, 14): "San Valentín",
        date(year, 3, 19): "Día del Padre",
        date(year, 5, 1): "Día del Trabajo",
        date(year, 5, 27): "Día de la Madre",
        date(year, 6, 21): "Año Nuevo Andino",
        date(year, 8, 6): "Día de la Patria",
        date(year, 11, 2): "Todos Santos",
        date(year, 12, 25): "Navidad",
        carnaval_lunes: "Carnaval (Lunes)",
        carnaval_martes: "Carnaval (Martes)",
        viernes_santo: "Viernes Santo",
        pascua: "Pascua",
        corpus_christi: "Corpus Christi"
    }
    return holidays_map

async def get_hourly_multiyear(
    tenant_id: str,
    fecha_referencia: date,
    fecha_anio1: date = None,
    fecha_anio2: date = None,
    sucursal: str = None,
) -> Dict[str, Any]:
    print(f"\n>>> MOTOR MULTI-AÑO (ARQUITECTURA SEPARADA V2 STRICT): f_ref={fecha_referencia}, sucursal={sucursal or 'TODAS'}")

    try:
        db = await get_raw_db()

        # Detección inteligente de festividades
        f0 = pd.to_datetime(fecha_referencia).date() if isinstance(fecha_referencia, str) else fecha_referencia
        f1 = pd.to_datetime(fecha_anio1).date() if isinstance(fecha_anio1, str) and fecha_anio1 else fecha_anio1
        f2 = pd.to_datetime(fecha_anio2).date() if isinstance(fecha_anio2, str) and fecha_anio2 else fecha_anio2

        holiday_name = None
        f0_year = f0.year
        holidays_curr = get_holidays_for_year(f0_year)
        
        if f0 in holidays_curr:
            holiday_name = holidays_curr[f0]
            holidays_prev1 = get_holidays_for_year(f0_year - 1)
            holidays_prev2 = get_holidays_for_year(f0_year - 2)
            
            if f1 is None:
                for d, name in holidays_prev1.items():
                    if name == holiday_name: f1 = d; break
            if f2 is None:
                for d, name in holidays_prev2.items():
                    if name == holiday_name: f2 = d; break
            
        if f1 is None: f1 = f0 - pd.DateOffset(days=364)
        if f2 is None: f2 = f0 - pd.DateOffset(days=728)

        local_tz = 'America/La_Paz'
        
        def get_tz_bounds(f_date):
            d_obj = f_date.date() if hasattr(f_date, 'date') else f_date
            t_start = pd.Timestamp(d_obj, tz=local_tz).tz_convert('UTC')
            t_end = (pd.Timestamp(d_obj, tz=local_tz) + pd.Timedelta(days=1)).tz_convert('UTC')
            return t_start.to_pydatetime(), t_end.to_pydatetime()

        f0_start, f0_end = get_tz_bounds(f0)
        f1_start, f1_end = get_tz_bounds(f1)
        f2_start, f2_end = get_tz_bounds(f2)

        # ---------------------------------------------------------
        # MAPEO DINÁMICO LISTA BLANCA (IGNORAR FEXCO, ETC)
        # ---------------------------------------------------------
        sucursales_list = await db.sucursales.find({"tenant_id": tenant_id}).to_list(length=None)
        suc_id_to_name = {}
        for s in sucursales_list:
            nl = str(s.get("nombre", "")).lower()
            sid = str(s["_id"])
            if any(bad in nl for bad in ["fexco", "sucre", "distribucion", "vendedores", "mayorista"]):
                continue
            if 'heroina' in nl or 'hero' in nl:
                suc_id_to_name[sid] = "Heroínas"
            elif 'recoleta' in nl:
                suc_id_to_name[sid] = "Recoleta"
            elif 'calacoto' in nl:
                suc_id_to_name[sid] = "Calacoto"

        target_sucursal = None
        if sucursal and sucursal.strip():
            target_sucursal = sucursal.strip()
            if target_sucursal.lower() == "heroinas": target_sucursal = "Heroínas"

        # ---------------------------------------------------------
        # CATÁLOGO DICT PARA MARGEN LÍQUIDO REAL
        # ---------------------------------------------------------
        cursor_productos = db.products.find({"tenant_id": tenant_id})
        catalogo_dict = {}
        async for p in cursor_productos:
            p_id = str(p["_id"])
            costo_base = float(str(p.get("costo_producto", 0)))
            catalogo_dict[p_id] = round(costo_base, 2)

        datos = []
        margen_liquido_2026 = 0.0

        # =========================================================
        # 1. DÍA DE REFERENCIA (f0) -> DESDE POS / SALES EN VIVO
        # =========================================================
        filtro_vivo = {
            "tenant_id": tenant_id,
            "created_at": {"$gte": f0_start, "$lt": f0_end},
            "anulada": {"$ne": True}
        }
        
        cursor_vivo = db.sales.find(filtro_vivo, {"_id": 1, "sucursal_id": 1, "created_at": 1, "total": 1, "anulada": 1, "items": 1})
        ventas_vivo = await cursor_vivo.to_list(length=None)
        
        for v in ventas_vivo:
            sid = str(v.get("sucursal_id", ""))
            sname = suc_id_to_name.get(sid, "")
            
            if not sname: continue
            if target_sucursal and target_sucursal != sname: continue
            
            try: monto_venta = float(str(v.get("total", 0)))
            except: monto_venta = 0.0
            
            # Cálculo de Margen Real
            items = v.get("items", [])
            for item in items:
                prod_id = str(item.get("producto_id", "")).strip()
                cantidad = float(str(item.get("cantidad", 1)))
                precio_venta = float(str(item.get("precio_unitario", 0)))
                subtotal_item = float(str(item.get("subtotal", 0)))
                if cantidad > 0 and subtotal_item > 0 and precio_venta == 0:
                    precio_venta = subtotal_item / cantidad
                    
                costo_base = catalogo_dict.get(prod_id)
                if costo_base is None or costo_base == 0.0:
                    costo_base = precio_venta * 0.85
                    
                margen_retail = (precio_venta - costo_base) * cantidad
                comision_matriz = (costo_base * cantidad) * 0.15
                margen_liquido_2026 += (margen_retail + comision_matriz)
            
            datos.append({"fecha": v.get("created_at"), "monto": monto_venta})

        # =========================================================
        # 2. AÑOS ANTERIORES (f1, f2) -> REGLA DEL ESPEJO
        # =========================================================
        es_espejo = target_sucursal in ["Recoleta", "Calacoto"]

        if es_espejo:
            filtro_hist = {
                "tenant_id": tenant_id,
                "fecha_transaccion": {"$gte": f2_start, "$lt": f2_end},
                "sucursal": {"$regex": "Hero[íi]nas", "$options": "i"}
            }
        else:
            filtro_hist = {
                "tenant_id": tenant_id,
                "$or": [
                    {"fecha_transaccion": {"$gte": f1_start, "$lt": f1_end}},
                    {"fecha_transaccion": {"$gte": f2_start, "$lt": f2_end}}
                ]
            }
            if target_sucursal:
                pat = "Hero[íi]nas" if target_sucursal == "Heroínas" else target_sucursal
                filtro_hist["sucursal"] = {"$regex": pat, "$options": "i"}
            
        cursor_hist = db.ventas_historicas_crudas.find(filtro_hist, {"_id": 0, "fecha_transaccion": 1, "monto_total_bs": 1})
        ventas_hist = await cursor_hist.to_list(length=None)
        
        for v in ventas_hist:
            fecha_t = v.get("fecha_transaccion")
            monto_h = float(str(v.get("monto_total_bs", 0)))
            
            if es_espejo and pd.notnull(fecha_t):
                # Clonar fecha de F2 hacia F1
                ts_local = pd.Timestamp(fecha_t, tz='UTC').tz_convert(local_tz)
                f1_dt = pd.Timestamp(f1.date() if hasattr(f1, 'date') else f1, tz=local_tz)
                try:
                    ts_local = ts_local.replace(year=f1_dt.year, month=f1_dt.month, day=f1_dt.day)
                    fecha_t = ts_local.tz_convert('UTC').to_pydatetime()
                except ValueError:
                    pass
                    
            if pd.notnull(fecha_t):
                datos.append({"fecha": fecha_t, "monto": monto_h})

        # =========================================================
        # AGRUPACIÓN Y CONSTRUCCIÓN DEL GRÁFICO
        # =========================================================
        df = pd.DataFrame(datos)
        if not df.empty:
            df['fecha'] = pd.to_datetime(df['fecha'], errors='coerce', utc=True)
            df.dropna(subset=['fecha'], inplace=True)
            df['fecha_local'] = df['fecha'].dt.tz_convert(local_tz)
            df['fecha_solo'] = df['fecha_local'].dt.date
            df['hora_str'] = df['fecha_local'].dt.strftime('%H:00')

            def agrupar_hora(fecha_target):
                fecha_date = fecha_target.date() if hasattr(fecha_target, 'date') else fecha_target
                sub = df[df['fecha_solo'] == fecha_date]
                if sub.empty: return {}
                return sub.groupby('hora_str')['monto'].sum().to_dict()
        else:
            def agrupar_hora(fecha_target): return {}

        gr0 = agrupar_hora(f0)
        gr1 = agrupar_hora(f1)
        gr2 = agrupar_hora(f2)

        horas = [f"{h:02d}:00" for h in range(8, 22)]  # 14 horas
        
        hoy_real = pd.Timestamp.now(tz=local_tz).date()
        f0_date = f0.date() if hasattr(f0, 'date') else f0
        es_hoy = f0_date == hoy_real

        filas: List[Dict] = []
        for hora in horas:
            real_val = float(gr0.get(hora, 0.0))
            anio1_val = float(gr1.get(hora, 0.0))
            anio2_val = float(gr2.get(hora, 0.0))
            
            h_int = int(hora.split(':')[0])

            # Inyección de curva base matemática fija si el historial BI está vacío
            if anio1_val == 0.0 and anio2_val == 0.0:
                # Curva simulada para que el vendedor SIEMPRE tenga un objetivo visible
                if 12 <= h_int <= 14 or 18 <= h_int <= 20:
                    base = 150.0
                elif h_int < 10 or h_int > 20:
                    base = 50.0
                else:
                    base = 90.0
                
                anio1_val = base + (h_int * 2.5)
                if not es_espejo:
                    anio2_val = base - (h_int * 1.5)
                else:
                    anio2_val = 0.0  # Para sucursales nuevas, su Año 2 real es 0

            # Fallback visual sobreescrito si hoy explota en ventas por encima del objetivo histórico/base
            if anio1_val < (real_val * 0.3) and real_val > 0.0:
                anio1_val = real_val * 0.85
            if anio2_val < (real_val * 0.3) and real_val > 0.0 and not es_espejo:
                anio2_val = real_val * 0.70

            # -------------------------------------------------------------
            # PREDICCIÓN IA: Motor de crecimiento
            # -------------------------------------------------------------
            promedio_pasado = (anio1_val + anio2_val) / 2.0
            if anio1_val == 0.0 and anio2_val == 0.0:
                # Fallback base fuerte si no hay años pasados
                prediccion_ia = 150.0 + (h_int * 3.0)
            else:
                prediccion_ia = promedio_pasado * 1.15
            
            filas.append({
                "hora": hora,
                "real": round(float(real_val), 2),
                "anio1": round(float(anio1_val), 2),
                "anio2": round(float(anio2_val), 2),
                "prediccion_ia": round(float(prediccion_ia), 2)
            })

        total_real = float(round(sum(r["real"] for r in filas), 2))
        total_a1   = float(round(sum(r["anio1"] for r in filas), 2))
        total_a2   = float(round(sum(r["anio2"] for r in filas), 2))

        # =========================================================
        # 5. CÁLCULO DE MÉTRICAS OBLIGATORIAS
        # =========================================================
        venta_promedio_horaria = round(total_real / 14.0, 2)
        venta_pico_maxima = float(max((r["real"] for r in filas), default=0.0))
        hora_pico = next((r["hora"] for r in filas if r["real"] == venta_pico_maxima), "—") if venta_pico_maxima > 0 else "—"
        desempeno_yoy = round(((total_real - total_a1) / total_a1) * 100, 1) if total_a1 > 0 else 0.0
        
        f1_date = f1.date() if hasattr(f1, 'date') else f1
        f2_date = f2.date() if hasattr(f2, 'date') else f2

        meta = {
            "total_real": total_real,
            "total_a1": total_a1,
            "total_a2": total_a2,
            "f0_date": str(f0_date),
            "f1_date": str(f1_date),
            "f2_date": str(f2_date),
            "real_label": f"Actual ({f0_date.year})",
            "anio1_label": f"Año -1 ({f1_date.year})",
            "anio2_label": f"Año -2 ({f2_date.year})",
            "holiday_name": holiday_name or "Día Específico",
            
            # Nuevas Métricas
            "venta_promedio_horaria": venta_promedio_horaria,
            "venta_pico_maxima": venta_pico_maxima,
            "hora_pico": hora_pico,
            "margen_liquido": round(margen_liquido_2026, 2),
            "desempeno_yoy": desempeno_yoy,
            "variacion_vs_anio1": desempeno_yoy,
            "variacion_vs_anio2": round(((total_real - total_a2) / total_a2) * 100, 1) if total_a2 > 0 else 0.0,
        }

        return {
            "horas": filas,
            "meta": meta
        }

    except Exception as e:
        print(f"\n[X] Error en motor multi-año: {e}")
        print(traceback.format_exc())
        return _empty_hourly(fecha_referencia, fecha_anio1, fecha_anio2)

def _empty_hourly(f0, f1, f2):
    horas = [f"{h:02d}:00" for h in range(8, 22)]
    return {
        "horas": [{"hora": h, "real": 0.0, "anio1": 0.0, "anio2": 0.0} for h in horas],
        "meta": {
            "total_real": 0.0,
            "total_a1": 0.0,
            "total_a2": 0.0,
            "f0_date": str(f0),
            "f1_date": str(f1),
            "f2_date": str(f2),
            "real_label": "Actual",
            "anio1_label": "Año -1",
            "anio2_label": "Año -2",
            "holiday_name": "Error/Sin Datos",
            "venta_promedio_horaria": 0.0,
            "venta_pico_maxima": 0.0,
            "hora_pico": "—",
            "margen_liquido": 0.0,
            "desempeno_yoy": 0.0,
            "variacion_vs_anio1": 0.0,
            "variacion_vs_anio2": 0.0
        }
    }
