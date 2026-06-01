import traceback
import pandas as pd
from datetime import date, datetime
from typing import Any, Dict, List

from app.db import get_raw_db
from datetime import timedelta


def get_easter_sunday(year: int) -> date:
    a = year % 19
    b = year // 100
    c = year % 22  # Wait, Jones/Butcher algorithm has c = year % 100, let's verify
    # Let's write the exact standard Jones/Butcher algorithm:
    # a = year % 19
    # b = year // 100
    # c = year % 100
    # d = b // 4
    # e = b % 4
    # f = (b + 8) // 25
    # g = (b - f + 1) // 3
    # h = (19 * a + b - d - g + 15) % 30
    # i = c // 4
    # k = c % 4
    # l = (32 + 2 * e + 2 * i - h - k) % 7
    # m = (a + 11 * h + 22 * l) // 451
    # n = (h + l - 7 * m + 114) // 31
    # p = (h + l - 7 * m + 114) % 31
    # return date(year, n, p + 1)
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
    
    # Festividades móviles
    carnaval_lunes = easter - timedelta(days=48)
    carnaval_martes = easter - timedelta(days=47)
    viernes_santo = easter - timedelta(days=2)
    pascua = easter
    corpus_christi = easter + timedelta(days=60)
    
    holidays_map = {
        # Festividades fijas
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
        
        # Festividades móviles
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
    sucursal: str = None,
) -> Dict[str, Any]:
    """
    Devuelve ventas por hora para:
      - fecha_referencia        (Año 0  / "Real")
      - fecha_referencia - 364d (Año -1 / 2025) o festividad correspondiente
      - fecha_referencia - 728d (Año -2 / 2024) o festividad correspondiente
    
    Si fecha_referencia == hoy, agrega una línea de Predicción hasta las 20:00
    basada en el promedio de Año -1 y Año -2 con un factor +10%.
    Si sucursal se provee, filtra solo esa sucursal.
    """
    print(f"\n>>> MOTOR MULTI-AÑO: fecha_referencia={fecha_referencia}, sucursal={sucursal or 'TODAS'}")

    try:
        db = await get_raw_db()

        # Detección inteligente de festividades
        f0 = fecha_referencia                          # Año 0 (día elegido)
        holiday_name = None
        
        f0_year = f0.year
        holidays_curr = get_holidays_for_year(f0_year)
        f0_date = f0.date() if hasattr(f0, 'date') else f0
        
        if f0_date in holidays_curr:
            holiday_name = holidays_curr[f0_date]
            print(f"Festividad detectada: {holiday_name}")
            
            # Buscar el mismo festivo en Año -1 y Año -2
            holidays_prev1 = get_holidays_for_year(f0_year - 1)
            holidays_prev2 = get_holidays_for_year(f0_year - 2)
            
            f1 = None
            for d, name in holidays_prev1.items():
                if name == holiday_name:
                    f1 = d
                    break
            
            f2 = None
            for d, name in holidays_prev2.items():
                if name == holiday_name:
                    f2 = d
                    break
            
            if f1 is None:
                f1 = f0 - pd.DateOffset(days=364)
            if f2 is None:
                f2 = f0 - pd.DateOffset(days=728)
        else:
            f1 = f0 - pd.DateOffset(days=364)
            f2 = f0 - pd.DateOffset(days=728)

        # Convertimos a datetime para el filtro
        f0_dt = datetime.combine(f0, datetime.min.time())
        f1_dt = datetime.combine(f1.date(), datetime.min.time()) if hasattr(f1, 'date') else datetime.combine(f1, datetime.min.time())
        f2_dt = datetime.combine(f2.date(), datetime.min.time()) if hasattr(f2, 'date') else datetime.combine(f2, datetime.min.time())

        # OPTIMIZACIÓN: Traer SOLO los 3 días necesarios
        date_filter = {"$or": [
            {"fecha_transaccion": {"$gte": f0_dt, "$lt": f0_dt + timedelta(days=1)}},
            {"fecha_transaccion": {"$gte": f1_dt, "$lt": f1_dt + timedelta(days=1)}},
            {"fecha_transaccion": {"$gte": f2_dt, "$lt": f2_dt + timedelta(days=1)}}
        ]}
        # Filtrar por sucursal si se especifica
        if sucursal and sucursal.strip():
            suc_pattern = sucursal.strip()
            if suc_pattern.lower() == "heroinas":
                suc_pattern = "Hero[íi]nas"
            date_filter["sucursal"] = {"$regex": suc_pattern, "$options": "i"}
        
        cursor = db.ventas_historicas_crudas.find(
            date_filter,
            {
                "_id": 0,
                "fecha_transaccion": 1,
                "monto_total_bs": 1,
            }
        )
        datos = await cursor.to_list(length=None)

        if not datos:
            return _empty_hourly()

        df = pd.DataFrame(datos)

        # Limpieza
        df['fecha_transaccion'] = pd.to_datetime(df['fecha_transaccion'], errors='coerce', utc=True)
        df.dropna(subset=['fecha_transaccion'], inplace=True)
        df['monto_total_bs'] = pd.to_numeric(df['monto_total_bs'], errors='coerce').fillna(0)
        df['fecha_solo'] = df['fecha_transaccion'].dt.date
        df['hora_str'] = df['fecha_transaccion'].dt.strftime('%H:00')

        # --- Helper: agrupar por hora para una fecha dada ---
        def agrupar_hora(fecha_target):
            fecha_date = fecha_target.date() if hasattr(fecha_target, 'date') else fecha_target
            sub = df[df['fecha_solo'] == fecha_date]
            if sub.empty:
                return {}
            gr = sub.groupby('hora_str')['monto_total_bs'].sum()
            return gr.to_dict()

        gr0 = agrupar_hora(f0)   # Real / Año 0
        gr1 = agrupar_hora(f1)   # Año -1
        gr2 = agrupar_hora(f2)   # Año -2

        # Rango horario forzado 08:00 - 20:00
        horas = [f"{h:02d}:00" for h in range(8, 21)]

        hoy_real = date.today()
        es_hoy = (fecha_referencia == hoy_real) or (
            # fallback: si no hay datos hoy, comparamos con fecha_max
            pd.Timestamp(fecha_referencia, tz='UTC').date() == df['fecha_transaccion'].max().date()
        )

        filas: List[Dict] = []
        for hora in horas:
            real_val = gr0.get(hora, 0.0)
            anio1_val = gr1.get(hora, 0.0)
            anio2_val = gr2.get(hora, 0.0)

            # Predicción: promedio de años anteriores x1.10
            promedio_hist = (anio1_val + anio2_val) / 2 if (anio1_val + anio2_val) > 0 else 0.0
            prediccion = round(promedio_hist * 1.10, 2) if es_hoy else None

            fila: Dict[str, Any] = {
                "hora": hora,
                "real": round(real_val, 2),
                "anio1": round(anio1_val, 2),
                "anio2": round(anio2_val, 2),
            }
            if prediccion is not None:
                fila["prediccion"] = prediccion

            filas.append(fila)

        # Calcular variaciones porcentuales globales para el tooltip
        total_real = sum(r["real"] for r in filas)
        total_a1   = sum(r["anio1"] for r in filas)
        total_a2   = sum(r["anio2"] for r in filas)

        def variacion(curr, prev):
            if prev == 0:
                return None
            return round((curr - prev) / prev * 100, 1)

        labels = {
            "real_label":  str(f0),
            "anio1_label": str(f1.date() if hasattr(f1, 'date') else f1),
            "anio2_label": str(f2.date() if hasattr(f2, 'date') else f2),
            "es_hoy": es_hoy,
            "variacion_vs_anio1": variacion(total_real, total_a1),
            "variacion_vs_anio2": variacion(total_real, total_a2),
            "holiday_name": holiday_name,
        }

        print(f">>> MULTI-AÑO OK: {len(filas)} horas, real={total_real:.0f}")
        return {"horas": filas, "meta": labels}

    except Exception as e:
        print(f"[X] Error en motor multi-año: {e}")
        print(traceback.format_exc())
        return _empty_hourly()


def _empty_hourly():
    horas = [f"{h:02d}:00" for h in range(8, 21)]
    return {
        "horas": [{"hora": h, "real": 0, "anio1": 0, "anio2": 0} for h in horas],
        "meta": {
            "real_label": "—", "anio1_label": "—", "anio2_label": "—",
            "es_hoy": False, "variacion_vs_anio1": None, "variacion_vs_anio2": None
        }
    }
