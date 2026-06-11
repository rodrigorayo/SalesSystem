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
    
    # Incluir la fecha local Bolivia en la clave para 'today' — invalida automáticamente al cambiar de día
    _local_date_today = pd.Timestamp.now(tz='America/La_Paz').strftime('%Y-%m-%d')
    if time_range != 'custom':
        cache_key = f"{tenant_id}_{sucursal_id}_{time_range}_{clima_evento}"
        if time_range == 'today':
            cache_key = f"{tenant_id}_{sucursal_id}_{time_range}_{_local_date_today}_{clima_evento}"
    else:
        cache_key = f"{tenant_id}_{sucursal_id}_{time_range}_{start_date.date()}_{end_date.date()}_{clima_evento}"

    # TTL: 60s para 'today' (datos frescos), 300s para el resto
    cache_ttl = 60 if time_range == 'today' else 300
        
    if cache_key in _dashboard_cache:
        cached_time, cached_data = _dashboard_cache[cache_key]
        if time.time() - cached_time < cache_ttl:
            print(f">>> RETORNANDO DATOS DE CACHE PARA {cache_key} <<<")
            return cached_data
        
    if cache_key not in _dashboard_locks:
        _dashboard_locks[cache_key] = asyncio.Lock()
        
    async with _dashboard_locks[cache_key]:
        if cache_key in _dashboard_cache:
            cached_time, cached_data = _dashboard_cache[cache_key]
            if time.time() - cached_time < cache_ttl:
                return cached_data
            
        t_start = __import__('time').time()
        print("\n" + "="*50)
        print(">>> INICIANDO PROCESAMIENTO ANALÍTICO EJECUTIVO <<<")
    
    try:
        db = await get_raw_db()
        
        filtro = {"tenant_id": tenant_id}
        if sucursal_id:
            suc_pattern = sucursal_id.strip()
            if suc_pattern.lower() == "heroinas":
                suc_pattern = "Hero[íi]nas"
            filtro["sucursal"] = {"$regex": suc_pattern, "$options": "i"}
            
        # OPTIMIZACIÓN: Obtener la fecha máxima directamente desde MongoDB
        max_doc = await db.ventas_historicas_crudas.find_one(filtro, sort=[("fecha_transaccion", -1)])
        if not max_doc or "fecha_transaccion" not in max_doc:
            return _empty_response()
            
        fecha_max_db = pd.to_datetime(max_doc["fecha_transaccion"], utc=True)
        
        # Zona horaria local de Bolivia
        LOCAL_TZ = 'America/La_Paz'
        
        # Calcular fecha mínima para evitar cargar toda la base de datos
        delta_pasado = pd.DateOffset(days=30)
        start_curr = fecha_max_db - pd.DateOffset(days=30)
        
        if time_range == '7days': 
            delta_pasado = pd.DateOffset(days=7)
            start_curr = fecha_max_db - pd.DateOffset(days=7)
            end_curr = None
        elif time_range == 'this_year': 
            delta_pasado = pd.DateOffset(days=364)
            start_curr = pd.to_datetime(datetime(fecha_max_db.year, 1, 1), utc=True)
            end_curr = None
        elif time_range == 'today': 
            delta_pasado = pd.DateOffset(days=364)
            # Usar medianoche en hora Bolivia (UTC-4), no UTC
            hoy_local = pd.Timestamp.now(tz=LOCAL_TZ).normalize()  # 2026-06-09 00:00:00-04:00
            start_curr = hoy_local.tz_convert('UTC')               # = 2026-06-09 04:00:00+00:00
            end_curr = (hoy_local + pd.Timedelta(days=1)).tz_convert('UTC') # = 2026-06-10 04:00:00+00:00
        elif time_range == 'yesterday': 
            delta_pasado = pd.DateOffset(days=364)
            ayer_local = pd.Timestamp.now(tz=LOCAL_TZ).normalize() - pd.Timedelta(days=1)
            start_curr = ayer_local.tz_convert('UTC')
            end_curr = (ayer_local + pd.Timedelta(days=1)).tz_convert('UTC')
        elif time_range == 'this_month': 
            delta_pasado = pd.DateOffset(days=30)
            start_curr = pd.to_datetime(datetime(fecha_max_db.year, fecha_max_db.month, 1), utc=True)
            end_curr = None
        elif time_range == 'custom':
            start_curr = pd.to_datetime(start_date, utc=True)
            dias_diff = (end_date - start_date).days
            delta_pasado = pd.DateOffset(days=max(dias_diff, 1))
            end_curr = pd.to_datetime(end_date, utc=True)
        else:
            end_curr = None
            
        fecha_minima_periodo = start_curr - delta_pasado
        
        if time_range != 'all':
            # OPTIMIZACIÓN EXTREMA: En lugar de traer todo el año, solo pedimos
            # 1. El periodo actual y previo (desde fecha_minima_periodo hasta hoy)
            # 2. El día específico de hace 1 año para la comparativa horaria YoY
            
            rango_principal = {
                "fecha_transaccion": {"$gte": fecha_minima_periodo.to_pydatetime()},
                "tenant_id": tenant_id
            }
            if end_curr is not None:
                rango_principal["fecha_transaccion"]["$lt"] = end_curr.to_pydatetime()
            
            # El YoY compara el día de fecha_max con hace 364 días
            fecha_yoy = fecha_max_db - pd.DateOffset(days=364)
            inicio_yoy = pd.to_datetime(fecha_yoy.date(), utc=True)
            fin_yoy = inicio_yoy + pd.DateOffset(days=1)
            
            rango_yoy = {
                "fecha_transaccion": {
                    "$gte": inicio_yoy.to_pydatetime(),
                    "$lt": fin_yoy.to_pydatetime()
                },
                "tenant_id": tenant_id
            }
            
            if sucursal_id:
                suc_pattern = sucursal_id.strip()
                if suc_pattern.lower() == "heroinas":
                    suc_pattern = "Hero[íi]nas"
                filtro_suc = {"$regex": suc_pattern, "$options": "i"}
                rango_principal["sucursal"] = filtro_suc
                rango_yoy["sucursal"] = filtro_suc
                
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
            "cliente": 1,
            "estado": 1
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
            
        if 'monto_total_bs' in df.columns:
            if isinstance(df['monto_total_bs'], pd.DataFrame):
                 df = df.drop(columns=['monto_total_bs']).assign(monto_total_bs=df['monto_total_bs'].iloc[:, -1])
            df['monto_total_bs'] = pd.to_numeric(df['monto_total_bs'], errors='coerce').fillna(0)
        else:
            df['monto_total_bs'] = 0.0
            
        df.dropna(subset=['monto_total_bs'], inplace=True)
        
        # Filtro de estados de ticket: Excluir estrictamente "Anulado"
        if 'estado' in df.columns:
            df = df[df['estado'].str.lower() != 'anulado']
        t_df_end = __import__('time').time()
        print(f"PANDAS CLEANING TOOK: {t_df_end - t_df_start:.4f}s")
        
        if df.empty:
            return _empty_response()
        
        # CONVERTIR TODAS LAS FECHAS A HORA LOCAL BOLIVIA para comparaciones correctas
        df['fecha_local'] = df['fecha_transaccion'].dt.tz_convert(LOCAL_TZ)
        df['fecha_solo_local'] = df['fecha_local'].dt.date
            
        # Filtros de Tiempo Dinámicos usando FECHA ESTRICTAMENTE LOCAL (UTC-4)
        fecha_max_local = df['fecha_local'].max()

        
        if time_range == 'today':
            # "Hoy" = fecha actual en Bolivia desde 00:00 hasta 23:59 (sin offset de negocio)
            hoy_local_date = pd.Timestamp.now(tz=LOCAL_TZ).date()
            print(f"[TODAY] Filtrando por fecha estricta Bolivia: {hoy_local_date}")
            df_filtrado = df[df['fecha_solo_local'] == hoy_local_date]
        elif time_range == 'yesterday':
            ayer_local_date = (pd.Timestamp.now(tz=LOCAL_TZ) - pd.Timedelta(days=1)).date()
            print(f"[YESTERDAY] Filtrando por fecha estricta Bolivia: {ayer_local_date}")
            df_filtrado = df[df['fecha_solo_local'] == ayer_local_date]
        elif time_range == '7days':
            df_filtrado = df[df['fecha_local'] >= (fecha_max_local - pd.DateOffset(days=7))]
        elif time_range == '30days':
            df_filtrado = df[df['fecha_local'] >= (fecha_max_local - pd.DateOffset(days=30))]
        elif time_range == 'this_month':
            df_filtrado = df[(df['fecha_local'].dt.year == fecha_max_local.year) & (df['fecha_local'].dt.month == fecha_max_local.month)]
        elif time_range == 'this_year':
            df_filtrado = df[df['fecha_local'].dt.year == fecha_max_local.year]
        elif time_range == 'custom':
            sd_date = pd.to_datetime(start_date).date()
            ed_date = pd.to_datetime(end_date).date()
            df_filtrado = df[(df['fecha_solo_local'] >= sd_date) & (df['fecha_solo_local'] <= ed_date)]
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
        tickets_cliente = total_ordenes
        
        # Percentiles
        p90_val = float(df_filtrado['monto_total_bs'].quantile(0.90)) if not df_filtrado.empty else 0.0
        p50_val = float(df_filtrado['monto_total_bs'].median()) if not df_filtrado.empty else 0.0
        
        # Aplicación de Regla del 15%
        ventas_brutas = total_ingresos
        costo_insumos = ventas_brutas * 0.85
        margen_liquido = ventas_brutas * 0.15
        total_margen_retail = 0.0
        total_comision_matriz = 0.0
        total_margen_neto_global = margen_liquido

        # Área Principal (Tendencia de Ingresos) ========
        df_tendencia = df_filtrado.copy()
        # Usar fecha local Bolivia para el agrupado de tendencias
        df_tendencia['periodo'] = df_tendencia['fecha_local'].dt.strftime('%Y-%m-%d')

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
            gr_sucursal = df_filtrado.groupby('suc_clean').agg(
                monto_total_bs=('monto_total_bs', 'sum'),
                tickets_cliente=('monto_total_bs', 'count')
            ).reset_index()
            sales_by_branch = [
                {
                    "name": str(row['suc_clean']), 
                    "ventas": float(row['monto_total_bs']),
                    "margen": float(row['monto_total_bs']) * 0.15,
                    "tickets_cliente": int(row['tickets_cliente'])
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

        # Motor de Comparativa Horaria (YoY) — usar fecha NEGOCIO Bolivia
        hoy_date_local = (pd.Timestamp.now(tz=LOCAL_TZ) - pd.Timedelta(hours=4)).date()
        df_hoy = df[df['fecha_solo_local'] == hoy_date_local].copy()
        
        # Si no hay datos hoy negocio, usamos el último día con datos (para el gráfico YoY)
        if df_hoy.empty:
            ultimo_dia_local = df['fecha_solo_local'].max()
            df_hoy = df[df['fecha_solo_local'] == ultimo_dia_local].copy()
            print(f"[YoY] Sin datos hoy negocio. Usando último día: {ultimo_dia_local}")
        
        # Hace 364 días respecto al día real de hoy local
        fecha_pasada_local = (pd.Timestamp(hoy_date_local, tz=LOCAL_TZ) - pd.DateOffset(days=364)).date()
        df_pasado_hoy = df[df['fecha_solo_local'] == fecha_pasada_local].copy()
        
        # Horas en hora local Bolivia
        df_hoy['hora'] = df_hoy['fecha_local'].dt.strftime('%H:00')
        df_pasado_hoy['hora'] = df_pasado_hoy['fecha_local'].dt.strftime('%H:00')
        
        gr_hoy_hora = df_hoy.groupby('hora')['monto_total_bs'].sum().reset_index().rename(columns={'monto_total_bs': 'real'})
        gr_pasado_hora = df_pasado_hoy.groupby('hora')['monto_total_bs'].sum().reset_index().rename(columns={'monto_total_bs': 'pasado'})
        
        # Merge de horas (desde 08:00 hasta 21:00 según solicitud del usuario)
        horas = [f"{h:02d}:00" for h in range(8, 22)]
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
                
        # =========================================================================
        # ARQUITECTURA SEPARADA V2 - OVERRIDE OBLIGATORIO PARA HOY Y AYER
        # =========================================================================
        if time_range in ['today', 'yesterday']:
            print(f">>> INYECTANDO ARQUITECTURA V2 PARA {time_range.upper()} <<<")
            
            # 1. Definir rango horario estricto America/La_Paz (00:00 a 23:59)
            hoy_local = pd.Timestamp.now(tz=LOCAL_TZ).normalize()
            if time_range == 'yesterday':
                target_local = hoy_local - pd.Timedelta(days=1)
            else:
                target_local = hoy_local
                
            start_hoy_utc = target_local.tz_convert('UTC').to_pydatetime()
            end_hoy_utc = (target_local + pd.Timedelta(days=1)).tz_convert('UTC').to_pydatetime()
            
            # =========================================================
            # 2. MAPEO DINÁMICO Y SEGURO DE SUCURSALES (LISTA BLANCA)
            # =========================================================
            cursor_sucursales = db.sucursales.find({"tenant_id": tenant_id})
            suc_id_to_name = {}
            async for s in cursor_sucursales:
                nombre = str(s.get("nombre", "")).strip()
                n_lower = nombre.lower()
                
                # Ignorar explícitamente sucursales basura de la DB
                if any(bad in n_lower for bad in ["fexco", "distribucion", "vendedores", "sucre", "mayorista"]):
                    continue
                    
                nombre_real = None
                if "heroinas" in n_lower or "heroína" in n_lower:
                    nombre_real = "Heroínas"
                elif "calacoto" in n_lower:
                    nombre_real = "Calacoto"
                elif "recoleta" in n_lower:
                    nombre_real = "Recoleta"
                
                # Solo guardar en el mapa las sucursales oficiales de la Lista Blanca
                if nombre_real:
                    suc_id_to_name[str(s["_id"])] = nombre_real
                    
            print(f">>> Mapeo dinámico generado: {suc_id_to_name}")
            
            # =========================================================
            # 2.B. DICCIONARIO DEL CATÁLOGO EN MEMORIA (COSTO BASE MATRIZ)
            # =========================================================
            cursor_productos = db.products.find({"tenant_id": tenant_id})
            catalogo_dict = {}
            async for p in cursor_productos:
                p_id = str(p["_id"])
                costo_base = float(str(p.get("costo_producto", 0)))
                catalogo_dict[p_id] = round(costo_base, 2)
            print(f">>> Catálogo cargado con {len(catalogo_dict)} productos para cálculo de margen.")
            
            # 3. Consultar directamente a la colección operativa (db.sales)
            filtro_sales = {
                "tenant_id": tenant_id,
                "created_at": {"$gte": start_hoy_utc, "$lt": end_hoy_utc},
                "anulada": {"$ne": True}
            }
            cursor_sales = db.sales.find(filtro_sales, {"_id": 1, "sucursal_id": 1, "created_at": 1, "total": 1, "anulada": 1, "items": 1})
            
            suc_totales = {
                "Heroínas": {"ventas": 0.0, "tickets": 0, "productos": 0, "margen": 0.0, "margen_retail": 0.0, "comision_matriz": 0.0},
                "Calacoto": {"ventas": 0.0, "tickets": 0, "productos": 0, "margen": 0.0, "margen_retail": 0.0, "comision_matriz": 0.0},
                "Recoleta": {"ventas": 0.0, "tickets": 0, "productos": 0, "margen": 0.0, "margen_retail": 0.0, "comision_matriz": 0.0}
            }
            ventas_brutas_reales = 0.0
            total_ordenes_reales = 0
            
            total_margen_retail = 0.0
            total_comision_matriz = 0.0
            total_margen_neto_global = 0.0
            
            async for v in cursor_sales:
                sale_suc_id = str(v.get("sucursal_id", "")).strip()
                
                # El corazón de la seguridad: Si el ID real de la venta NO está
                # en nuestro mapa validado por la Lista Blanca, se ignora completamente.
                if sale_suc_id not in suc_id_to_name:
                    continue
                    
                nombre_real = suc_id_to_name[sale_suc_id]
                
                # Cálculo dinámico del Margen Líquido Ítem por Ítem
                margen_venta_actual = 0.0
                margen_retail_venta_actual = 0.0
                comision_matriz_venta_actual = 0.0
                productos_venta_actual = 0
                items = v.get("items", [])
                
                for item in items:
                    prod_id = str(item.get("producto_id", "")).strip()
                    cantidad = float(str(item.get("cantidad", 1)))
                    productos_venta_actual += int(cantidad)
                    
                    precio_venta = float(str(item.get("precio_unitario", 0)))
                    subtotal_item = float(str(item.get("subtotal", 0)))
                    if cantidad > 0 and subtotal_item > 0 and precio_venta == 0:
                        precio_venta = subtotal_item / cantidad
                        
                    costo_base = catalogo_dict.get(prod_id)
                    if costo_base is None or costo_base == 0.0:
                        costo_base = precio_venta * 0.85
                    
                    # Lógica Matemática de Negocio
                    margen_retail = (precio_venta - costo_base) * cantidad
                    comision_matriz = (costo_base * cantidad) * 0.15
                    margen_neto_item = margen_retail + comision_matriz
                    
                    total_margen_retail += margen_retail
                    total_comision_matriz += comision_matriz
                    total_margen_neto_global += margen_neto_item
                    
                    margen_venta_actual += margen_neto_item
                    margen_retail_venta_actual += margen_retail
                    comision_matriz_venta_actual += comision_matriz
                
                # Reglas estrictas de parseo de monto (forzar string y luego float para soportar Decimal128)
                monto = float(str(v.get("total", 0)))
                monto = round(monto, 2)
                
                suc_totales[nombre_real]["ventas"] += monto
                suc_totales[nombre_real]["tickets"] += 1
                suc_totales[nombre_real]["productos"] += productos_venta_actual
                suc_totales[nombre_real]["margen"] += margen_venta_actual
                
                # Desglose de márgenes por sucursal para el nuevo frontend UI
                suc_totales[nombre_real]["margen_retail"] += margen_retail_venta_actual
                suc_totales[nombre_real]["comision_matriz"] += comision_matriz_venta_actual
                
                ventas_brutas_reales += monto
                total_ordenes_reales += 1
                
            # Reemplazar métricas globales
            ventas_brutas = round(ventas_brutas_reales, 2)
            costo_insumos = round(ventas_brutas - total_margen_neto_global, 2) # Costo = Bruto - Margen
            margen_liquido = round(total_margen_neto_global, 2)
            total_ordenes = total_ordenes_reales
            ticket_promedio = round(ventas_brutas / total_ordenes, 2) if total_ordenes > 0 else 0
            tickets_cliente = total_ordenes
            
            # Regenerar Desglose de Ingresos para que solo muestre la Lista Blanca
            sales_by_branch = [
                {
                    "name": name,
                    "ventas": round(data["ventas"], 2),
                    "margen": round(data["margen"], 2),
                    "margen_retail": round(data["margen_retail"], 2),
                    "comision_matriz": round(data["comision_matriz"], 2),
                    "tickets_cliente": data["tickets"]
                }
                for name, data in suc_totales.items()
            ]
            sales_by_branch.sort(key=lambda x: x["ventas"], reverse=True)
            
            # Forzar también que sucursal_top tome el top de nuestra nueva lista
            if not sucursal_id and sales_by_branch and sales_by_branch[0]["ventas"] > 0:
                top = sales_by_branch[0]
                sucursal_top = {
                    "nombre": top["name"],
                    "ingresos": top["ventas"],
                    "pct": round(top["ventas"] / max(ventas_brutas, 1) * 100, 1)
                }
        
        result = {
            "overview": {
                "ventas_brutas":        ventas_brutas,
                "costo_insumos":        costo_insumos,
                "margen_liquido":       round(total_margen_neto_global, 2),
                "comision_matriz":      round(total_comision_matriz, 2),
                "margen_retail":        round(total_margen_retail, 2),
                "total_revenue":        ventas_brutas,
                "p90":                  p90_val,
                "p50":                  p50_val,
                "total_orders":         tickets_cliente,
                "active_customers":     clientes_activos,
                "recurrent_customers":  clientes_recurrentes,
                "average_ticket":       ticket_promedio,
                "ticket_medio":         ticket_promedio,
                "revenue_growth":       round((margen_liquido / max(ventas_brutas, 1)) * 100, 1)
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

import pytz

async def get_top_products_metrics(
    tenant_id: str,
    start_date: datetime,
    end_date: datetime,
    time_range: str = None
) -> Dict[str, Any]:
    if time_range == 'today':
        tz = pytz.timezone('America/La_Paz')
        now_tz = datetime.now(tz)
        start_date = now_tz.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now_tz.replace(hour=23, minute=59, second=59, microsecond=999999)

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
                "value": round((float(d.get("cantidad_vendida", 0)) / total_cant) * 100, 1),
                "ingresos": float(d.get("ingresos", 0))
            })
    else:
        # Prevención de división por cero - array vacío (o dummy según se requiera, el front maneja array vacío)
        pass
            
    return {"top_categories": top_categories}


async def get_sales_by_branch_metrics(
    tenant_id: str,
    start_date: datetime,
    end_date: datetime,
    time_range: str = None
) -> Dict[str, Any]:
    if time_range == 'today':
        tz = pytz.timezone('America/La_Paz')
        now_tz = datetime.now(tz)
        start_date = now_tz.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now_tz.replace(hour=23, minute=59, second=59, microsecond=999999)

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
        return None
        
    sucursales_agrupadas = {}
    for d in datos:
        norm = mapear_sucursal(d["_id"])
        if not norm:
            continue # Ignorar sucursales basura
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
    
    sales_by_branch.sort(key=lambda x: x["ventas"], reverse=True)
    
    return {"sales_by_branch": sales_by_branch}
