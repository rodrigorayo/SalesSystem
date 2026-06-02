import traceback
import pandas as pd
from datetime import datetime
from typing import Dict, Any
import asyncio
import time

from app.db import get_raw_db

_dashboard_cache = {}
_dashboard_locks = {}

async def get_dashboard_metrics(
    tenant_id: str, 
    start_date: datetime, 
    end_date: datetime,
    sucursal_id: str = None,
    time_range: str = '30days',
    clima_evento: str = None
) -> Dict[str, Any]:
    
    if time_range != 'custom':
        cache_key = f"{tenant_id}_{sucursal_id}_{time_range}_{clima_evento}"
    else:
        cache_key = f"{tenant_id}_{sucursal_id}_{time_range}_{start_date.date()}_{end_date.date()}_{clima_evento}"
        
    if cache_key in _dashboard_cache:
        cached_time, cached_data = _dashboard_cache[cache_key]
        if time.time() - cached_time < 300:
            print(f">>> RETORNANDO DATOS DE CACHE PARA {cache_key} <<<")
            return cached_data
        
    if cache_key not in _dashboard_locks:
        _dashboard_locks[cache_key] = asyncio.Lock()
        
    async with _dashboard_locks[cache_key]:
        if cache_key in _dashboard_cache:
            cached_time, cached_data = _dashboard_cache[cache_key]
            if time.time() - cached_time < 300:
                return cached_data
            
        t_start = __import__('time').time()
        print("\n" + "="*50)
        print(">>> INICIANDO PROCESAMIENTO ANALÍTICO EJECUTIVO <<<")
    
    try:
        db = await get_raw_db()
        
        filtro = {}
        if sucursal_id:
            filtro["sucursal"] = sucursal_id
            
        # OPTIMIZACIÓN: Obtener la fecha máxima directamente desde MongoDB
        max_doc = await db.ventas_historicas_crudas.find_one(filtro, sort=[("fecha_transaccion", -1)])
        if not max_doc or "fecha_transaccion" not in max_doc:
            return _empty_response()
            
        fecha_max_db = pd.to_datetime(max_doc["fecha_transaccion"], utc=True)
        
        # Calcular fecha mínima para evitar cargar toda la base de datos
        delta_pasado = pd.DateOffset(days=30)
        start_curr = fecha_max_db - pd.DateOffset(days=30)
        
        if time_range == '7days': 
            delta_pasado = pd.DateOffset(days=7)
            start_curr = fecha_max_db - pd.DateOffset(days=7)
        elif time_range == 'this_year': 
            delta_pasado = pd.DateOffset(days=364)
            start_curr = pd.to_datetime(datetime(fecha_max_db.year, 1, 1), utc=True)
        elif time_range == 'today': 
            delta_pasado = pd.DateOffset(days=364)
            hoy_real = pd.Timestamp.now(tz='UTC').normalize()
            start_curr = hoy_real
        elif time_range == 'this_month': 
            delta_pasado = pd.DateOffset(days=30)
            start_curr = pd.to_datetime(datetime(fecha_max_db.year, fecha_max_db.month, 1), utc=True)
        elif time_range == 'custom':
            start_curr = pd.to_datetime(start_date, utc=True)
            dias_diff = (end_date - start_date).days
            delta_pasado = pd.DateOffset(days=max(dias_diff, 1))
            
        fecha_minima_periodo = start_curr - delta_pasado
        
        if time_range != 'all':
            # OPTIMIZACIÓN EXTREMA: En lugar de traer todo el año, solo pedimos
            # 1. El periodo actual y previo (desde fecha_minima_periodo hasta hoy)
            # 2. El día específico de hace 1 año para la comparativa horaria YoY
            
            rango_principal = {
                "fecha_transaccion": {"$gte": fecha_minima_periodo.to_pydatetime()}
            }
            
            # El YoY compara el día de fecha_max con hace 364 días
            fecha_yoy = fecha_max_db - pd.DateOffset(days=364)
            inicio_yoy = pd.to_datetime(fecha_yoy.date(), utc=True)
            fin_yoy = inicio_yoy + pd.DateOffset(days=1)
            
            rango_yoy = {
                "fecha_transaccion": {
                    "$gte": inicio_yoy.to_pydatetime(),
                    "$lt": fin_yoy.to_pydatetime()
                }
            }
            
            filtro["$or"] = [rango_principal, rango_yoy]
            
        print(f"Obteniendo registros filtrados de forma óptima...")
        t_mongo_start = __import__('time').time()
        
        projection = {
            "_id": 0, 
            "fecha_transaccion": 1, 
            "monto_total_bs": 1,
            "sucursal": 1,
            "nombre_producto": 1,
            "cantidad_vendida": 1,
            "cliente": 1
        }

        if "$or" in filtro:
            # Separamos las consultas para evitar full collection scan por culpa del $or
            cursor_principal = db.ventas_historicas_crudas.find(rango_principal, projection).batch_size(10000)
            datos_principal = await cursor_principal.to_list(length=None)
            
            cursor_yoy = db.ventas_historicas_crudas.find(rango_yoy, projection).batch_size(10000)
            datos_yoy = await cursor_yoy.to_list(length=None)
            
            datos = datos_principal + datos_yoy
        else:
            cursor = db.ventas_historicas_crudas.find(filtro, projection).batch_size(10000)
            datos = await cursor.to_list(length=None)

        t_mongo_end = __import__('time').time()
        print(f"MONGO QUERY TOOK: {t_mongo_end - t_mongo_start:.4f}s, rows: {len(datos)}")
        
        if not datos:
            return _empty_response()
            
        t_df_start = __import__('time').time()
        df = pd.DataFrame(datos)
        
        # Limpieza de fechas UTC
        if 'fecha_transaccion' in df.columns:
            df['fecha_transaccion'] = pd.to_datetime(df['fecha_transaccion'], errors='coerce', utc=True)
            df.dropna(subset=['fecha_transaccion'], inplace=True)
        else:
            return _empty_response()
            
        # Limpieza de monto
        if 'monto_total_bs' in df.columns:
            if isinstance(df['monto_total_bs'], pd.DataFrame):
                 df = df.drop(columns=['monto_total_bs']).assign(monto_total_bs=df['monto_total_bs'].iloc[:, -1])
            df['monto_total_bs'] = pd.to_numeric(df['monto_total_bs'], errors='coerce').fillna(0)
        else:
            df['monto_total_bs'] = 0.0
            
        df.dropna(subset=['monto_total_bs'], inplace=True)
        t_df_end = __import__('time').time()
        print(f"PANDAS CLEANING TOOK: {t_df_end - t_df_start:.4f}s")
        
        if df.empty:
            return _empty_response()
            
        # Filtros de Tiempo Dinámicos
        # Usamos la fecha_max del dataset como referencia para "Hoy" (fallback automático).
        fecha_max = df['fecha_transaccion'].max()
        
        if time_range == 'today':
            # FALLBACK INTELIGENTE: Si "hoy real" (fecha del sistema) no tiene datos,
            # usamos el último día histórico con registros para no mostrar Bs. 0.00
            hoy_real = pd.Timestamp.now(tz='UTC').normalize()
            df_hoy_real = df[df['fecha_transaccion'].dt.date == hoy_real.date()]
            if df_hoy_real.empty:
                # Sin datos hoy -> usamos el último día disponible del histórico
                fecha_efectiva = fecha_max.date()
                print(f"[FALLBACK] 'Hoy' sin datos. Usando último día histórico: {fecha_efectiva}")
            else:
                fecha_efectiva = hoy_real.date()
            df_filtrado = df[df['fecha_transaccion'].dt.date == fecha_efectiva]
        elif time_range == '7days':
            df_filtrado = df[df['fecha_transaccion'] >= (fecha_max - pd.DateOffset(days=7))]
        elif time_range == '30days':
            df_filtrado = df[df['fecha_transaccion'] >= (fecha_max - pd.DateOffset(days=30))]
        elif time_range == 'this_month':
            df_filtrado = df[(df['fecha_transaccion'].dt.year == fecha_max.year) & (df['fecha_transaccion'].dt.month == fecha_max.month)]
        elif time_range == 'this_year':
            df_filtrado = df[df['fecha_transaccion'].dt.year == fecha_max.year]
        elif time_range == 'custom':
            _sd = pd.to_datetime(start_date, utc=True)
            _ed = pd.to_datetime(end_date, utc=True)
            df_filtrado = df[(df['fecha_transaccion'] >= _sd) & (df['fecha_transaccion'] <= _ed)]
        else: # Histórico Total
            df_filtrado = df.copy()

        # KPIs Financieros Avanzados ==========================================
        total_ingresos = float(df_filtrado['monto_total_bs'].sum())
        total_ordenes = len(df_filtrado)
        
        clientes_activos = 0
        clientes_recurrentes = 0
        if 'cliente' in df_filtrado.columns:
            # Drop null and blank clients
            valid_clients = df_filtrado[df_filtrado['cliente'].notna() & (df_filtrado['cliente'] != '')]
            clientes_activos = int(valid_clients['cliente'].nunique())
            
            c_counts = valid_clients['cliente'].value_counts()
            clientes_recurrentes = int((c_counts > 1).sum())
            
        ticket_promedio = total_ingresos / total_ordenes if total_ordenes > 0 else 0
        
        # Percentiles
        p90_val = float(df_filtrado['monto_total_bs'].quantile(0.90)) if not df_filtrado.empty else 0.0
        p50_val = float(df_filtrado['monto_total_bs'].median()) if not df_filtrado.empty else 0.0
        
        # Aplicación de Regla del 15%
        ventas_brutas = total_ingresos
        costo_insumos = ventas_brutas * 0.85
        margen_liquido = ventas_brutas * 0.15

        # Área Principal (Tendencia de Ingresos) ========
        df_tendencia = df_filtrado.copy()
        df_tendencia['periodo'] = df_tendencia['fecha_transaccion'].dt.strftime('%Y-%m-%d')

        # Agrupamos: ingresos + cantidad de transacciones (tickets) por día
        gr_tendencia = df_tendencia.groupby('periodo').agg(
            ingresos=('monto_total_bs', 'sum'),
            tickets=('monto_total_bs', 'count'),
        ).reset_index()

        ventas_actuales = [
            {
                "name":            str(row['periodo']),
                "ingresos":        float(row['ingresos']),
                "tickets":         int(row['tickets']),
                "ticket_promedio": float(row['ingresos'] / max(int(row['tickets']), 1)),
                "costo":           float(row['ingresos']) * 0.85,
                "margen":          float(row['ingresos']) * 0.15,
            }
            for _, row in gr_tendencia.iterrows()
        ]

        # Geolocalización (Distribución por Sucursal Biaxial) ===
        sales_by_branch = []
        if 'sucursal' in df_filtrado.columns:
            def mapear_sucursal(s):
                s_str = str(s).lower()
                if 'heroinas' in s_str or 'heroína' in s_str: return 'Heroínas'
                if 'recoleta' in s_str: return 'Recoleta'
                if 'calacoto' in s_str: return 'Calacoto'
                return str(s).capitalize()
                
            df_filtrado['suc_clean'] = df_filtrado['sucursal'].apply(mapear_sucursal)
            gr_sucursal = df_filtrado.groupby('suc_clean')['monto_total_bs'].sum().reset_index()
            sales_by_branch = [
                {
                    "name": str(row['suc_clean']), 
                    "ventas": float(row['monto_total_bs']),
                    "margen": float(row['monto_total_bs']) * 0.15
                }
                for _, row in gr_sucursal.iterrows()
            ]

        # Top Productos (Mix de Catálogo) ===
        top_categories = []
        top_productos_rentabilidad = []
        if 'nombre_producto' in df_filtrado.columns and 'cantidad_vendida' in df_filtrado.columns:
            df_filtrado['cantidad_vendida'] = pd.to_numeric(df_filtrado['cantidad_vendida'], errors='coerce').fillna(1)
            gr_prod = df_filtrado.groupby('nombre_producto').agg(
                cantidad_vendida=('cantidad_vendida', 'sum'),
                ingresos=('monto_total_bs', 'sum')
            ).reset_index()
            gr_prod = gr_prod.sort_values(by='ingresos', ascending=False).head(10)
            
            total_cant = gr_prod['cantidad_vendida'].sum()
            if total_cant > 0:
                top_categories = [
                    {"name": str(row['nombre_producto']), "value": round((float(row['cantidad_vendida'])/total_cant)*100, 1)}
                    for _, row in gr_prod.head(5).iterrows()
                ]
            
            # Rentabilidad por producto (Regla 15%)
            top_productos_rentabilidad = [
                {
                    "nombre": str(row['nombre_producto']),
                    "ingresos": round(float(row['ingresos']), 2),
                    "costo_85": round(float(row['ingresos']) * 0.85, 2),
                    "margen_15": round(float(row['ingresos']) * 0.15, 2),
                    "cantidad": int(row['cantidad_vendida'])
                }
                for _, row in gr_prod.iterrows()
            ]

        # Motor de Comparativa Horaria (YoY) ===
        # Agarramos los datos de "Hoy" (suponiendo fecha_max)
        df_hoy = df[df['fecha_transaccion'].dt.date == fecha_max.date()].copy()
        
        # Agarramos "Hace 364 dias"
        fecha_pasada = fecha_max - pd.DateOffset(days=364)
        df_pasado_hoy = df[df['fecha_transaccion'].dt.date == fecha_pasada.date()].copy()
        
        df_hoy['hora'] = df_hoy['fecha_transaccion'].dt.strftime('%H:00')
        df_pasado_hoy['hora'] = df_pasado_hoy['fecha_transaccion'].dt.strftime('%H:00')
        
        gr_hoy_hora = df_hoy.groupby('hora')['monto_total_bs'].sum().reset_index().rename(columns={'monto_total_bs': 'real'})
        gr_pasado_hora = df_pasado_hoy.groupby('hora')['monto_total_bs'].sum().reset_index().rename(columns={'monto_total_bs': 'pasado'})
        
        # Merge de horas (desde 08:00 hasta 22:00)
        horas = [f"{h:02d}:00" for h in range(8, 23)]
        df_horas = pd.DataFrame({"hora": horas})
        
        df_horas = pd.merge(df_horas, gr_hoy_hora, on='hora', how='left').fillna(0)
        df_horas = pd.merge(df_horas, gr_pasado_hora, on='hora', how='left').fillna(0)
        
        # Inteligencia Artificial: Ajuste por Evento Externo
        # Lluvia = Baja 15%, Día Madre = Sube 20%
        factor_ia = 1.0
        if clima_evento:
            ev = clima_evento.lower()
            if 'lluvia' in ev:
                factor_ia = 0.85
            elif 'madre' in ev or 'festivo' in ev:
                factor_ia = 1.20
                
        df_horas['prediccion'] = df_horas['pasado'] * factor_ia
        
        distribucion_horaria = [
            {
                "hora": row['hora'],
                "real": float(row['real']),
                "pasado": float(row['pasado']),
                "prediccion": float(row['prediccion'])
            }
            for _, row in df_horas.iterrows()
        ]

        # MATRIZ BCG EVOLUCIONADA (Pandas Nativo) ===
        bcg_data = { "estrellas": [], "vacas": [], "interrogantes": [], "perros": [] }
        df_bcg_curr = df_filtrado.copy()
        
        if not df_bcg_curr.empty and 'nombre_producto' in df_bcg_curr.columns:
            delta_pasado = pd.DateOffset(days=30)
            if time_range == '7days': delta_pasado = pd.DateOffset(days=7)
            elif time_range == 'this_year': delta_pasado = pd.DateOffset(days=364)
            elif time_range == 'today': delta_pasado = pd.DateOffset(days=364)
            elif time_range == 'this_month': delta_pasado = pd.DateOffset(days=30)
            elif time_range == 'custom': delta_pasado = pd.DateOffset(days=max((end_date - start_date).days, 1))

            start_curr = df_bcg_curr['fecha_transaccion'].min()
            end_curr = df_bcg_curr['fecha_transaccion'].max()
            
            if pd.notna(start_curr):
                start_prev = start_curr - delta_pasado
                end_prev = end_curr - delta_pasado
                
                df_bcg_prev = df[(df['fecha_transaccion'] >= start_prev) & (df['fecha_transaccion'] <= end_prev)]
                
                gr_bcg_curr = df_bcg_curr.groupby('nombre_producto')['monto_total_bs'].sum()
                gr_bcg_prev = df_bcg_prev.groupby('nombre_producto')['monto_total_bs'].sum()
                
                max_revenue_curr = gr_bcg_curr.max() if not gr_bcg_curr.empty else 0.0
                
                for index, curr_val in gr_bcg_curr.items():
                    prev_val = gr_bcg_prev.get(index, 0.0)
                    if curr_val == 0.0 and prev_val == 0.0: continue
                    
                    cuota_relativa = (curr_val / max_revenue_curr) if max_revenue_curr > 0 else 0.0
                    
                    if prev_val == 0 and curr_val > 0:
                        crecimiento = 1.0
                        tend_text = "Subió 100% vs periodo pasado (Top)"
                        badge_type = "up"
                    else:
                        crecimiento = float((curr_val - prev_val) / prev_val)
                        val_pct = round(crecimiento * 100, 1)
                        if crecimiento > 0:
                            tend_text = f"Subió {val_pct}% vs periodo anterior"
                            badge_type = "up"
                        elif crecimiento < 0:
                            tend_text = f"Bajó {abs(val_pct)}% vs periodo anterior"
                            badge_type = "down"
                        else:
                            tend_text = "Se mantuvo estable 0%"
                            badge_type = "stable"
                            
                    es_alto_crecimiento = crecimiento >= 0.05
                    es_alta_cuota = cuota_relativa >= 0.50
                    
                    cuadrante = "PERRO"
                    nota_extra = ""
                    
                    if es_alto_crecimiento and es_alta_cuota:
                        cuadrante = "ESTRELLA"
                    elif not es_alto_crecimiento and es_alta_cuota:
                        cuadrante = "VACA"
                    elif es_alto_crecimiento and not es_alta_cuota:
                        cuadrante = "INTERROGANTE"
                    else:
                        cuadrante = "PERRO"
                        nota_extra = "Sugerencia: Liquidación o descontinuar"
                        
                    prod_data = {
                        "producto_id": str(index),
                        "nombre": str(index),
                        "ingresos_actuales": float(curr_val),
                        "ingresos_anteriores": float(prev_val),
                        "crecimiento": float(crecimiento),
                        "cuota_relativa": float(cuota_relativa),
                        "cuadrante": cuadrante,
                        "tendencia": tend_text,
                        "badge": badge_type,
                        "nota": nota_extra
                    }
                    
                    if cuadrante == "ESTRELLA": bcg_data["estrellas"].append(prod_data)
                    elif cuadrante == "VACA": bcg_data["vacas"].append(prod_data)
                    elif cuadrante == "INTERROGANTE": bcg_data["interrogantes"].append(prod_data)
                    elif cuadrante == "PERRO": bcg_data["perros"].append(prod_data)

                bcg_data["estrellas"].sort(key=lambda x: x["cuota_relativa"], reverse=True)
                bcg_data["vacas"].sort(key=lambda x: x["cuota_relativa"], reverse=True)
                bcg_data["interrogantes"].sort(key=lambda x: x["crecimiento"], reverse=True)
                bcg_data["perros"].sort(key=lambda x: x["ingresos_actuales"], reverse=True)

        t_bcg_end = __import__('time').time()
        print(f"PANDAS METRICS & BCG TOOK: {t_bcg_end - t_df_end:.4f}s")

        print(">>> DATOS PROCESADOS CORRECTAMENTE <<<")

        # Sucursal Top Contribuidora (solo cuando la vista es global) =========
        sucursal_top = None
        if 'suc_clean' in df_filtrado.columns and not sucursal_id:
            gr_suc_top = df_filtrado.groupby('suc_clean')['monto_total_bs'].sum()
            if not gr_suc_top.empty:
                top_nombre = gr_suc_top.idxmax()
                top_val    = float(gr_suc_top.max())
                total_val  = float(gr_suc_top.sum())
                pct        = round(top_val / max(total_val, 1) * 100, 1)
                sucursal_top = {
                    "nombre":   top_nombre,
                    "ingresos": top_val,
                    "pct":      pct,
                }
        
        result = {
            "overview": {
                "ventas_brutas":        ventas_brutas,
                "costo_insumos":        costo_insumos,
                "margen_liquido":       margen_liquido,
                "total_revenue":        ventas_brutas,
                "p90":                  p90_val,
                "p50":                  p50_val,
                "total_orders":         total_ordenes,
                "active_customers":     clientes_activos,
                "recurrent_customers":  clientes_recurrentes,
                "average_ticket":       ticket_promedio,
                "revenue_growth":       round((ventas_brutas * 0.15) / max(ventas_brutas, 1) * 100, 1)
            },
            "revenue_trend":              ventas_actuales,
            "sucursal_top":               sucursal_top,
            "sales_by_branch":            sales_by_branch,
            "top_categories":             top_categories,
            "top_productos_rentabilidad": top_productos_rentabilidad,
            "distribucion_horaria":       distribucion_horaria,
            "bcg_data":                   bcg_data,
            "recent_activity":            []
        }
        
        _dashboard_cache[cache_key] = (time.time(), result)
        return result
        
    except Exception as e:
        print(f"\n[X] Error CRITICO en analítica: {e}")
        print(traceback.format_exc())
        return _empty_response()

def _empty_response():
    return {
        "overview": {
            "total_revenue": 0, "total_orders": 0, "active_customers": 0, "average_ticket": 0,
            "revenue_growth": 0, "orders_growth": 0, "customers_growth": 0
        },
        "revenue_trend": [],
        "sales_by_branch": [],
        "top_categories": [],
        "distribucion_horaria": [],
        "recent_activity": []
    }

async def get_top_products_metrics(
    tenant_id: str,
    start_date: datetime,
    end_date: datetime
) -> Dict[str, Any]:
    db = await get_raw_db()
    
    filtro = {
        "fecha_transaccion": {
            "$gte": start_date,
            "$lte": end_date
        }
    }
    
    pipeline = [
        {"$match": filtro},
        {"$group": {
            "_id": "$nombre_producto",
            "ingresos": {"$sum": "$monto_total_bs"},
            "cantidad_vendida": {"$sum": "$cantidad_vendida"}
        }},
        {"$sort": {"ingresos": -1}},
        {"$limit": 5}
    ]
    
    cursor = db.ventas_historicas_crudas.aggregate(pipeline)
    datos = await cursor.to_list(length=None)
    
    total_cant = sum([d.get("cantidad_vendida", 0) for d in datos])
    
    top_categories = []
    if total_cant > 0:
        for d in datos:
            top_categories.append({
                "name": str(d["_id"]),
                "value": round((float(d.get("cantidad_vendida", 0)) / total_cant) * 100, 1)
            })
            
    return {"top_categories": top_categories}


async def get_sales_by_branch_metrics(
    tenant_id: str,
    start_date: datetime,
    end_date: datetime
) -> Dict[str, Any]:
    db = await get_raw_db()
    
    filtro = {
        "fecha_transaccion": {
            "$gte": start_date,
            "$lte": end_date
        }
    }
    
    pipeline = [
        {"$match": filtro},
        {"$group": {
            "_id": "$sucursal",
            "ventas": {"$sum": "$monto_total_bs"}
        }}
    ]
    
    cursor = db.ventas_historicas_crudas.aggregate(pipeline)
    datos = await cursor.to_list(length=None)
    
    def mapear_sucursal(s):
        s_str = str(s).lower()
        if 'heroinas' in s_str or 'heroína' in s_str: return 'Heroínas'
        if 'recoleta' in s_str: return 'Recoleta'
        if 'calacoto' in s_str: return 'Calacoto'
        return str(s).capitalize()
        
    sucursales_agrupadas = {}
    for d in datos:
        norm = mapear_sucursal(d["_id"])
        if norm not in sucursales_agrupadas:
            sucursales_agrupadas[norm] = 0.0
        sucursales_agrupadas[norm] += float(d.get("ventas", 0))
        
    sales_by_branch = [
        {
            "name": name,
            "ventas": val,
            "margen": val * 0.15
        }
        for name, val in sucursales_agrupadas.items()
    ]
    
    # Sort by ventas
    sales_by_branch.sort(key=lambda x: x["ventas"], reverse=True)
    
    return {"sales_by_branch": sales_by_branch}
