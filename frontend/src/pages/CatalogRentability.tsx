import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { getAnalyticsDashboard, getRentabilidadReal, getProducts } from '../api/api';
import {
    AlertTriangle, Loader2, Target, Activity,
    TrendingUp, Package, Calendar, DollarSign,
    Search, FileSpreadsheet, Clock
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import BcgMatrix from '../components/BcgMatrix';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const formatBs = (num?: number) =>
    `Bs. ${(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CatalogRentability() {
    const { role } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [data, setData] = useState<any>(null);
    const [timeRange, setTimeRange] = useState('30days');
    const [searchTerm, setSearchTerm] = useState('');

    // Custom date range state
    const [isCustom, setIsCustom] = useState(false);
    const [customStartDate, setCustomStartDate] = useState('2024-01-01T00:00:00.000Z');
    const [customEndDate, setCustomEndDate] = useState('2026-12-31T23:59:59.000Z');

    // Estado de filtro LOCAL para la tabla de Rentabilidad (independiente del filtro global)
    const [rentRange, setRentRange] = useState('30days');
    const [rentSucursal, setRentSucursal] = useState('');
    const [rentData, setRentData] = useState<any[]>([]);
    const [isRentLoading, setIsRentLoading] = useState(false);
    // Vista semanal / mensual para el gráfico de evolución
    const [chartView, setChartView] = useState<'day' | 'week' | 'month'>('week');
    const [meta, setMeta] = useState<number>(0);

    const [catalogo, setCatalogo] = useState<any[]>([]);

    useEffect(() => {
        getProducts(1, 2000).then(res => {
            setCatalogo(res.items || []);
        }).catch(err => {
            console.error("Error cargando catalogo en CatalogRentability:", err);
        });
    }, []);
    
    const SUCS = [
        { value: '', label: 'Todas las Sucursales' },
        { value: 'Heroinas', label: 'Heroínas' },
        { value: 'Recoleta', label: 'Recoleta' },
        { value: 'Calacoto', label: 'Calacoto' },
    ];

    const rentRangeLabels: Record<string, string> = {
        'today': 'Hoy',
        '7days': '7 Días',
        '30days': '30 Días',
        'this_month': 'Mes Actual',
        'this_year': 'Año Actual',
        'historico': 'Histórico'
    };

    useEffect(() => {
        let isMounted = true;
        const fetchRent = async () => {
            setIsRentLoading(true);
            try {
                // Convertir rentRange a fechas reales
                const now = new Date();
                let start = new Date('2024-01-01T00:00:00.000Z');
                let end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                if (rentRange === 'today') {
                    const startOfToday = new Date();
                    startOfToday.setHours(0, 0, 0, 0);
                    const endOfToday = new Date();
                    endOfToday.setHours(23, 59, 59, 999);
                    start = startOfToday;
                    end = endOfToday;
                } else if (rentRange === '7days') {
                    start = new Date(now); start.setDate(now.getDate() - 7);
                    end   = now;
                } else if (rentRange === '30days') {
                    start = new Date(now); start.setDate(now.getDate() - 30);
                    end   = now;
                } else if (rentRange === 'this_month') {
                    start = new Date(now.getFullYear(), now.getMonth(), 1);
                    end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                } else if (rentRange === 'this_year') {
                    start = new Date(now.getFullYear(), 0, 1);
                    end   = now;
                }
                const res = await getRentabilidadReal(
                    start.toISOString(),
                    end.toISOString(),
                    rentSucursal || undefined,
                    50
                );
                if (isMounted) setRentData(Array.isArray(res) ? res : []);
            } catch (e) {
                if (isMounted) setRentData([]);
            } finally {
                if (isMounted) setIsRentLoading(false);
            }
        };
        fetchRent();
        return () => { isMounted = false; };
    }, [rentRange, rentSucursal]);

    const rangeLabels: Record<string, string> = {
        'today': 'Hoy',
        '7days': 'Últimos 7 Días',
        '30days': 'Últimos 30 Días',
        'this_month': 'Mes Actual',
        'this_year': 'Año Actual',
        'historico': 'Histórico Total'
    };

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            setIsLoading(true);
            setIsError(false);
            try {
                const res = await getAnalyticsDashboard(
                    customStartDate,
                    customEndDate,
                    undefined,
                    isCustom ? undefined : timeRange,
                    ''
                );
                if (isMounted) setData(res);
            } catch (err) {
                console.error("Error cargando Catalogo:", err);
                if (isMounted) setIsError(true);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [timeRange, customStartDate, customEndDate, isCustom]);


    const handlePresetClick = (key: string) => {
        setIsCustom(false);
        setCustomStartDate('2024-01-01T00:00:00.000Z');
        setCustomEndDate('2026-12-31T23:59:59.000Z');
        setTimeRange(key);
    };

    const esAdmin = ['SUPERADMIN', 'ADMIN_MATRIZ', 'ADMIN'].includes(role || '');

    if (!esAdmin) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center">
                <AlertTriangle className="text-amber-500 mb-4" size={48} />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
            </div>
        );
    }

    
    // Filtramos la tendencia por sucursalTrend en el frontend si es que está todo mezclado, 
    // pero idealmente deberíamos re-hacer fetch si sucursal_id cambia.
    // Asumimos que data.revenue_trend trae lo consolidado si no hay filtro global.
    const trendData = (data?.revenue_trend || []).map((t: any) => ({
        name: t.name,
        ingresos: t.ingresos,
        costo: t.costo || t.ingresos * 0.85,
        margen: t.margen || t.ingresos * 0.15,
        tickets: t.tickets || 0,
        ticket_promedio: t.ticket_promedio || 0
    }));

    // ── Agrupación y Lógica de Períodos ──
    const aggregateByPeriod = (data: any[], mode: 'day' | 'week' | 'month') => {
        const buckets: Record<string, { label: string; ingresos: number; costo: number; margen: number; tickets: number; dateKey: string; esCurso: boolean }> = {};
        
        const hoy = new Date();
        const hoyStr = hoy.toISOString().split('T')[0];
        const dow = hoy.getDay();
        const diff = (dow === 0 ? -6 : 1) - dow;
        const monHoy = new Date(hoy);
        monHoy.setDate(hoy.getDate() + diff);
        const semHoyStr = monHoy.toISOString().split('T')[0];
        const mesHoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

        data.forEach(d => {
            const date = new Date(d.name);
            let key: string;
            let esCurso = false;

            if (mode === 'day') {
                key = d.name.slice(0, 10);
                esCurso = key === hoyStr;
            } else if (mode === 'week') {
                const dow = date.getDay();
                const diff = (dow === 0 ? -6 : 1) - dow;
                const mon = new Date(date);
                mon.setDate(date.getDate() + diff);
                key = mon.toISOString().split('T')[0];
                esCurso = key === semHoyStr;
            } else {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                esCurso = key === mesHoyStr;
            }
            
            if (!buckets[key]) {
                let label: string;
                if (mode === 'day') {
                    label = date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
                } else if (mode === 'week') {
                    label = new Date(key).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                } else {
                    label = new Date(key + '-01').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
                }
                buckets[key] = { label, dateKey: key, esCurso, ingresos: 0, costo: 0, margen: 0, tickets: 0 };
            }
            buckets[key].ingresos += d.ingresos;
            buckets[key].costo    += d.costo;
            buckets[key].margen   += d.margen;
            buckets[key].tickets  += d.tickets;
        });
        return Object.entries(buckets)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, v]) => ({
                name:     v.label,
                dateKey:  v.dateKey,
                esCurso:  v.esCurso,
                ingresos: Math.round(v.ingresos),
                costo:    Math.round(v.costo),
                margen:   Math.round(v.margen),
                tickets:  v.tickets,
                ticket_promedio: v.tickets > 0 ? v.ingresos / v.tickets : 0
            }));
    };

    const chartData = aggregateByPeriod(trendData, chartView);
    // Media histórica de ingresos por período (EXCLUYE EL PERÍODO EN CURSO)
    const dataCompletada = chartData.filter(d => !d.esCurso);
    const mediaIngreso = dataCompletada.length
        ? Math.round(dataCompletada.reduce((s, d) => s + d.ingresos, 0) / dataCompletada.length)
        : 0;

    const processedRentData = useMemo(() => {
        // 1. Filtro estricto de Zona Horaria para "today"
        const isTodayFilter = rentRange === 'today';
        const hoyStrBO = new Date().toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' });

        const ventasValidas = rentData.filter((venta: any) => {
            if (venta.estado === 'Cancelado' || venta.estado === 'Borrador' || venta.estado === 'En proceso' || venta.anulada === true) {
                return false;
            }
            if (isTodayFilter && venta.fecha) {
                const ventaDateStrBO = new Date(venta.fecha).toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' });
                if (ventaDateStrBO !== hoyStrBO) {
                    return false;
                }
            }
            return true;
        });

        // 2. Normalización de Clave (La Clave Única)
        const claveUnica = (nombre: string) => String(nombre || '').toLowerCase().replace(/\s+/g, ' ').trim();

        // 3. Agrupación Consolidada
        const mapaProductos = new Map<string, {
            nombreLimpio: string;
            unidades: number;
            ingreso_bruto: number;
        }>();

        ventasValidas.forEach((venta: any) => {
            if (!venta.nombre) return;
            const key = claveUnica(venta.nombre);
            
            if (mapaProductos.has(key)) {
                const existente = mapaProductos.get(key)!;
                existente.unidades += Number(venta.unidades || venta.cantidad || 0);
                existente.ingreso_bruto += Number(venta.ingreso_bruto || venta.ingresos || 0);
            } else {
                mapaProductos.set(key, {
                    nombreLimpio: String(venta.nombre).toUpperCase().trim(),
                    unidades: Number(venta.unidades || venta.cantidad || 0),
                    ingreso_bruto: Number(venta.ingreso_bruto || venta.ingresos || 0)
                });
            }
        });

        const productosFinales = Array.from(mapaProductos.values());

        // 4. Motor de Cálculo Financiero
        return productosFinales.map((group) => {
            const cleanName = group.nombreLimpio;
            const unidades = group.unidades;
            const ingreso_bruto = group.ingreso_bruto;

            // Buscar en el catálogo
            const prodCat = catalogo.find((c: any) => {
                const desc = (c.descripcion || c.nombre || '').toUpperCase().trim();
                return desc === cleanName;
            });

            const proveedor = String(prodCat?.proveedor || '').toLowerCase();
            const costoBase = Number(prodCat?.costo_producto || prodCat?.costo_base || 0);
            const esTaboada = proveedor.includes('taboada');

            let ganancia_matriz = 0;
            let ganancia_sucursal = 0;

            if (esTaboada) {
                const precioMatriz = costoBase * 1.15;
                ganancia_matriz = (precioMatriz - costoBase) * unidades;
                ganancia_sucursal = ingreso_bruto - (precioMatriz * unidades);
            } else {
                ganancia_matriz = 0;
                ganancia_sucursal = ingreso_bruto - (costoBase * unidades);
            }

            const costo_real = costoBase * unidades;
            const margen_pct = ingreso_bruto > 0 ? ((ingreso_bruto - costo_real) / ingreso_bruto) * 100 : 0;
            const precio_venta_retail = unidades > 0 ? (ingreso_bruto / unidades) : 0;

            return {
                nombreLimpio: cleanName,
                unidades,
                ingreso_bruto,
                costo_real,
                ganancia_suc: ganancia_sucursal,
                ganancia_matriz,
                precio_prom: precio_venta_retail,
                costo_prom: costoBase,
                margen_pct
            };
        });
    }, [rentData, catalogo, rentRange]);

    const handleExportCSV = () => {
        const rows = processedRentData.filter((p: any) => p.nombreLimpio.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!rows.length) return;
        const header = ["Producto","Unidades","Ingreso Bruto","Costo Real","Ganancia Sucursal","Ganancia Matriz","% Margen","PR Venta","Costo Unit."];
        const csv = [header.join(","), ...rows.map((p: any) =>
            `"${p.nombreLimpio}",${p.unidades},${p.ingreso_bruto},${p.costo_real},${p.ganancia_suc},${p.ganancia_matriz},${p.margen_pct}%,${p.precio_prom},${p.costo_prom}`
        )].join("\n");
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `Rentabilidad_Real_${rentRange}.csv`; a.click();
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-24">

            {/* Header Premium (Executive Dashboard) */}
            <div className="flex flex-col gap-2 w-full mb-4">
                
                {/* 1. Cabecera y Títulos */}
                <div>
                    <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-700 to-purple-600 bg-clip-text text-transparent">Catálogo y Rentabilidad</h1>
                    <p className="text-sm font-medium text-gray-500 mt-1">Análisis de Rentabilidad, Matriz BCG y evolución de costos por producto.</p>
                </div>

                {/* 2. Filtros de Fecha (Segmented Control / Pills) */}
                <div className="flex flex-wrap bg-gray-100 p-1.5 rounded-2xl gap-1 mt-6 w-fit">
                    {Object.entries(rangeLabels).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => handlePresetClick(key)}
                            className={cn(
                                "px-4 py-2 rounded-xl text-xs transition-all",
                                timeRange === key
                                ? 'font-bold bg-white text-indigo-700 shadow-sm border border-gray-200'
                                : 'font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* 3. Tarjetas KPI "Glassmorphism" */}
                {isLoading ? (
                    <div className="flex flex-col justify-center items-center py-32 space-y-4">
                        <Loader2 size={48} className="animate-spin text-amber-500 mb-2" />
                        <p className="text-amber-900 font-bold tracking-widest text-sm uppercase animate-pulse">
                            Analizando Catálogo y Márgenes...
                        </p>
                    </div>
                ) : isError || !data ? (
                    <div className="bg-red-50 text-red-600 p-8 rounded-3xl text-center border border-red-100 mt-6">
                        <AlertTriangle size={32} className="mx-auto mb-2" />
                        <h3 className="font-bold">Error cargando datos de catálogo</h3>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6 w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
                        {/* Tarjeta Producto Estrella */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-amber-400 flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="bg-amber-100 text-amber-600 p-1.5 rounded-lg">⭐</span>
                                <span className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">Producto Estrella ({rangeLabels[timeRange as keyof typeof rangeLabels] || 'Periodo'})</span>
                            </div>
                            <h3 className="text-base font-black text-gray-800 mt-2 truncate">{data.top_productos_rentabilidad?.[0]?.nombre || 'Sin estrella'}</h3>
                            <p className="text-lg font-bold text-gray-900">
                                {data.top_productos_rentabilidad?.[0] ? formatBs(data.top_productos_rentabilidad[0].ingresos) : 'Bs. 0.00'} 
                                <span className="text-xs font-normal text-gray-500"> en ingresos</span>
                            </p>
                            <p className="text-[11px] font-semibold text-amber-600 mt-1">#1 en rentabilidad del periodo seleccionado</p>
                        </div>

                        {/* Tarjeta Sucursal Top */}
                        {data.sucursal_top && (
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-emerald-500 flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg">🏢</span>
                                    <span className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">Sucursal Top Contribuidora</span>
                                </div>
                                <h3 className="text-base font-black text-gray-800 mt-2 truncate">{data.sucursal_top.nombre}</h3>
                                <p className="text-lg font-bold text-gray-900">{formatBs(data.sucursal_top.ingresos)}</p>
                                <p className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                                    <TrendingUp size={12} className="text-emerald-600"/>
                                    {data.sucursal_top.pct}% del total global
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

                    {/* CAPA 2: Matriz BCG Evolucionada con su propio estado de tiempo */}
                    <div className="min-h-[300px] w-full">
                        <BcgMatrix />
                    </div>

                    {/* CAPA 3: Tabla de Rentabilidad por Producto — DATOS REALES */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
                        {/* Header de la tarjeta con filtros propios */}
                        <div className="mb-6 pb-4 border-b border-gray-50">
                            <div className="flex flex-col gap-4">
                                {/* Título + búsqueda + exportar */}
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><DollarSign size={20} /></div>
                                            Rentabilidad por Producto
                                        </h2>
                                        <p className="text-gray-500 text-sm mt-1">
                                            Costos y márgenes <strong className="text-emerald-600">reales</strong> desde cada venta POS e historial importado.
                                        </p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-center gap-3">
                                        <div className="relative w-full sm:w-64">
                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Buscar producto..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                                            />
                                        </div>
                                        <button
                                            onClick={handleExportCSV}
                                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                                        >
                                            <FileSpreadsheet size={18} />
                                            Exportar CSV
                                        </button>
                                    </div>
                                </div>

                                {/* Filtros de fecha + sucursal */}
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
                                    <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                                        <Calendar size={14} className="text-gray-400 ml-1" />
                                        {Object.keys(rentRangeLabels).map(key => (
                                            <button
                                                key={key}
                                                onClick={() => setRentRange(key)}
                                                className={cn(
                                                    "px-4 py-1.5 rounded-xl text-xs font-black transition-all duration-300",
                                                    rentRange === key
                                                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200 scale-105'
                                                    : 'bg-transparent text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                                                )}
                                            >
                                                {rentRangeLabels[key]}
                                            </button>
                                        ))}
                                        {isRentLoading && <Loader2 size={14} className="animate-spin text-emerald-500 ml-2" />}
                                    </div>
                                    <div className="relative w-full sm:w-auto min-w-[160px]">
                                        <select
                                            value={rentSucursal}
                                            onChange={(e) => setRentSucursal(e.target.value)}
                                            className="w-full pl-4 pr-8 py-2 text-xs font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white appearance-none cursor-pointer transition-all"
                                        >
                                            {SUCS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {(() => {
                            const rows = processedRentData.filter((p: any) =>
                                p.nombreLimpio.toLowerCase().includes(searchTerm.toLowerCase())
                            );
                            const totIngreso   = rows.reduce((s: number, p: any) => s + (p.ingreso_bruto  || 0), 0);
                            const totCosto     = rows.reduce((s: number, p: any) => s + (p.costo_real     || 0), 0);
                            const totGanSuc    = rows.reduce((s: number, p: any) => s + (p.ganancia_suc   || 0), 0);
                            const totGanMat    = rows.reduce((s: number, p: any) => s + (p.ganancia_matriz || 0), 0);
                            const margenTotal  = totIngreso > 0 ? ((totIngreso - totCosto) / totIngreso * 100) : 0;
                            return rows.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-xs text-gray-700 uppercase font-bold">
                                        <tr>
                                            <th className="px-4 py-3">Producto</th>
                                            <th className="px-4 py-3 text-right">Unidades Vendidas</th>
                                            <th className="px-4 py-3 text-right">Ingreso Bruto</th>
                                            <th className="px-4 py-3 text-right">Costo Real</th>
                                            <th className="px-4 py-3 text-right">Ganancia Sucursal</th>
                                            <th className="px-4 py-3 text-right">Ganancia Matriz</th>
                                            <th className="px-4 py-3 text-right">Precio Venta (Retail)</th>
                                            <th className="px-4 py-3 text-right">Costo Unitario</th>
                                            <th className="px-4 py-3 text-right">Margen %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((prod: any, i: number) => {
                                            const margenColor = prod.margen_pct > 15 ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                : prod.margen_pct > 5 ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                : 'bg-red-50 text-red-600 border-red-100';
                                            return (
                                            <tr
                                                key={i}
                                                className={cn(
                                                    "border-b border-gray-50 hover:bg-emerald-50/30 transition-colors group",
                                                    i === 0 ? "bg-amber-50/20" : ""
                                                )}
                                            >
                                                <td className="px-4 py-3 max-w-[220px]">
                                                    <span className="font-bold text-gray-800">{prod.nombreLimpio}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="font-semibold text-gray-600">{(prod.unidades||0).toLocaleString()}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                    Bs. {(prod.ingreso_bruto || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-red-500">
                                                    Bs. {(prod.costo_real || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                                </td>
                                                <td className="px-4 py-3 text-right font-black text-emerald-600 text-base">
                                                    Bs. {(prod.ganancia_suc || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-violet-600">
                                                    Bs. {(prod.ganancia_matriz || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg text-xs">
                                                        Bs. {(prod.precio_prom || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg text-xs">
                                                        Bs. {(prod.costo_prom || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border ${margenColor}`}>
                                                        {(prod.margen_pct||0).toFixed(1)}%
                                                    </span>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50">
                                            <td colSpan={2} className="px-4 py-4 font-black text-gray-700 text-sm uppercase tracking-wider">
                                                TOTAL ({rows.length} productos)
                                            </td>
                                            <td className="px-4 py-4 text-right font-black text-gray-900">Bs. {totIngreso.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                            <td className="px-4 py-4 text-right font-black text-red-500">Bs. {totCosto.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                            <td className="px-4 py-4 text-right font-black text-emerald-600 text-base">Bs. {totGanSuc.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                            <td className="px-4 py-4 text-right font-semibold text-violet-600">Bs. {totGanMat.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                            <td className="px-4 py-4 text-center text-gray-400">-</td>
                                            <td className="px-4 py-4 text-center text-gray-400">-</td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border ${
                                                    margenTotal > 15 ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                    : margenTotal > 5 ? 'bg-amber-100 text-amber-800 border-amber-200'
                                                    : 'bg-red-100 text-red-700 border-red-200'
                                                }`}>
                                                    {margenTotal.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            ) : (
                                <div className="text-center py-12 text-gray-400">
                                    <Package size={40} className="mx-auto mb-3 opacity-40" />
                                    <p className="font-semibold">Sin datos de productos disponibles en este periodo.</p>
                                </div>
                            );
                        })()}
                    </div>

                    {/* CAPA 4: Rendimiento por período vs Media Histórica */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">

                        {/* ── Header ── */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Activity size={20} /></div>
                                    Evolución de Ingresos vs Media Histórica
                                </h2>
                                <p className="text-gray-400 text-sm mt-1 max-w-xl">
                                    Compara cada período contra la <strong className="text-indigo-600">media del rango seleccionado</strong> y opcionalmente contra una <strong className="text-orange-500">meta dinámica</strong>.
                                </p>
                            </div>

                            <div className="flex flex-col items-end gap-2 shrink-0">
                                {/* Toggle Día / Semana / Mes */}
                                <div className="flex bg-gray-100 p-1 rounded-xl">
                                    {([{ v: 'day', l: 'Días' }, { v: 'week', l: 'Semanas' }, { v: 'month', l: 'Meses' }] as const).map(opt => (
                                        <button key={opt.v} onClick={() => setChartView(opt.v)}
                                            className={cn('px-3 py-1.5 rounded-lg text-xs font-black transition-all',
                                                chartView === opt.v ? 'bg-white text-indigo-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-800'
                                            )}>
                                            {opt.l}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Input de Meta */}
                                    <div className="relative">
                                        <Target size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none"/>
                                        <input
                                            type="number"
                                            value={meta || ''}
                                            onChange={e => setMeta(Number(e.target.value))}
                                            placeholder="Meta opcional (Bs)..."
                                            className="w-40 pl-8 pr-3 py-1.5 text-xs font-semibold text-gray-800 bg-orange-50/50 border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white placeholder:text-orange-300"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── KPIs ── */}
                        {chartData.length > 0 && (() => {
                            const tot   = chartData.reduce((s, d) => s + d.ingresos, 0);
                            const marg  = chartData.reduce((s, d) => s + d.margen, 0);
                            const sobre = chartData.filter(d => d.ingresos >= mediaIngreso).length;
                            const best  = [...chartData].sort((a, b) => b.ingresos - a.ingresos)[0];
                            return (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
                                    {[
                                        { label: 'Total Ingresos', val: formatBs(tot),             sub: `${chartData.length} períodos`, bg: 'bg-gray-50',     border: 'border-gray-200',    color: 'text-gray-900' },
                                        { label: 'Margen (15%)',   val: formatBs(marg),            sub: 'Lo que quedó libre',            bg: 'bg-violet-50',   border: 'border-violet-100',  color: 'text-violet-900' },
                                        { label: 'Sobre la media', val: `${sobre}/${chartData.length}`, sub: `${Math.round(sobre/chartData.length*100)}% del período`, bg: sobre >= chartData.length/2 ? 'bg-emerald-50' : 'bg-amber-50', border: sobre >= chartData.length/2 ? 'border-emerald-100' : 'border-amber-100', color: sobre >= chartData.length/2 ? 'text-emerald-900' : 'text-amber-900' },
                                        { label: 'Mejor período', val: best?.name ?? '-',          sub: formatBs(best?.ingresos ?? 0),   bg: 'bg-amber-50',    border: 'border-amber-100',   color: 'text-amber-900' },
                                    ].map(k => (
                                        <div key={k.label} className={cn('rounded-2xl p-4 border', k.bg, k.border)}>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{k.label}</p>
                                            <p className={cn('text-lg font-black', k.color)}>{k.val}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">{k.sub}</p>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}

                        {/* ── Bullet Chart ── */}
                        {chartData.length === 0 ? (
                            <div className="py-10 text-center text-gray-400 text-sm">Sin datos para el período seleccionado.</div>
                        ) : (() => {
                            const maxIngreso = Math.max(...chartData.map(d => d.ingresos));
                            const maxVal = Math.max(maxIngreso, meta) * 1.1; // Espacio extra para visualización
                            const mediaW = maxVal > 0 ? (mediaIngreso / maxVal) * 100 : 0;
                            const metaW = maxVal > 0 && meta > 0 ? (meta / maxVal) * 100 : 0;

                            return (
                                <div className="space-y-3">
                                    {/* Leyenda de columnas */}
                                    <div className="flex items-center gap-3 text-[10px] font-black text-gray-400 uppercase tracking-widest pb-1 border-b border-gray-100">
                                        <div className="w-24 shrink-0">{chartView === 'month' ? 'Mes' : chartView === 'week' ? 'Semana (desde)' : 'Día'}</div>
                                        <div className="flex-1">Ingreso vs Media {meta > 0 && 'y Meta'}</div>
                                        <div className="w-24 text-right">Ingresos</div>
                                        <div className="w-20 text-center">Tickets</div>
                                        <div className="w-24 text-right">Tkt Prom</div>
                                        {meta > 0 && <div className="w-16 text-right">vs Meta</div>}
                                        <div className="w-16 text-right">vs Media</div>
                                    </div>

                                    {chartData.map((d, i) => {
                                        const pctMedia = mediaIngreso > 0 ? ((d.ingresos - mediaIngreso) / mediaIngreso) * 100 : 0;
                                        const pctMeta  = meta > 0 ? ((d.ingresos - meta) / meta) * 100 : 0;
                                        
                                        const aboveMedia = d.ingresos >= mediaIngreso;
                                        const aboveMeta  = meta > 0 ? d.ingresos >= meta : false;
                                        
                                        const barW   = maxVal > 0 ? (d.ingresos / maxVal) * 100 : 0;
                                        
                                        // Visual treatment for 'en curso'
                                        const barColor  = d.esCurso ? 'bg-gray-300' : aboveMedia ? 'bg-emerald-400' : 'bg-red-400';
                                        const badgeMediaBg = d.esCurso ? 'bg-gray-100 text-gray-500' : aboveMedia ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800';
                                        const badgeMetaBg  = d.esCurso ? 'bg-gray-100 text-gray-500' : aboveMeta ? 'bg-orange-100 text-orange-800' : 'bg-red-50 text-red-700 border border-red-100';

                                        return (
                                            <div key={i}
                                                className={cn("group flex items-center gap-3 py-2.5 px-2 rounded-xl transition-all cursor-default", d.esCurso ? 'bg-slate-50' : 'hover:bg-gray-50')}>

                                                {/* Label período */}
                                                <div className="w-24 shrink-0">
                                                    <p className="text-xs font-black text-gray-700 truncate" title={d.name}>{d.name}</p>
                                                    {d.esCurso && <p className="text-[9px] text-gray-400 font-bold flex items-center gap-1 mt-0.5"><Clock size={8}/> En curso</p>}
                                                </div>

                                                {/* Bullet bar track */}
                                                <div className="flex-1 relative h-7 bg-gray-100 rounded-lg overflow-hidden">
                                                    {/* Fondo */}
                                                    <div className="absolute inset-0 bg-gray-100 rounded-lg" />

                                                    {/* Barra de ingreso real */}
                                                    <div
                                                        className={cn('absolute left-0 top-1 bottom-1 rounded-md transition-all duration-700', barColor)}
                                                        style={{ width: `${barW}%` }}
                                                    />

                                                    {/* Línea vertical de MEDIA (Azul) */}
                                                    {mediaIngreso > 0 && (
                                                        <div
                                                            className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 z-10"
                                                            style={{ left: `${mediaW}%` }}
                                                        >
                                                            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                        </div>
                                                    )}
                                                    
                                                    {/* Línea vertical de META (Naranja) */}
                                                    {metaW > 0 && (
                                                        <div
                                                            className="absolute top-0 bottom-0 w-0.5 bg-orange-500 z-20 shadow-sm"
                                                            style={{ left: `${metaW}%` }}
                                                        >
                                                            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-orange-500" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Ingresos */}
                                                <div className="w-24 text-right shrink-0">
                                                    <p className="text-sm font-black text-gray-900">{formatBs(d.ingresos)}</p>
                                                </div>

                                                {/* Tickets */}
                                                <div className="w-20 text-center shrink-0">
                                                    <p className="text-xs font-bold text-gray-600">{d.tickets}</p>
                                                </div>

                                                {/* Ticket Promedio */}
                                                <div className="w-24 text-right shrink-0">
                                                    <p className="text-xs font-black text-indigo-700">{formatBs(d.ticket_promedio)}</p>
                                                </div>

                                                {/* VS Meta */}
                                                {meta > 0 && (
                                                    <div className="w-16 text-right shrink-0">
                                                        <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded-md', badgeMetaBg)}>
                                                            {d.esCurso ? '-' : `${pctMeta > 0 ? '+' : ''}${pctMeta.toFixed(0)}%`}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* VS Media */}
                                                <div className="w-16 text-right shrink-0">
                                                    <span className={cn('text-xs font-black px-2 py-1 rounded-lg', badgeMediaBg)}>
                                                        {d.esCurso ? '-' : `${pctMedia > 0 ? '+' : ''}${pctMedia.toFixed(0)}%`}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Leyenda */}
                                    <div className="flex items-center justify-between gap-5 pt-3 border-t border-gray-100 text-xs font-bold text-gray-500 flex-wrap">
                                        <div className="flex gap-4">
                                            <span className="flex items-center gap-1.5"><span className="w-8 h-2 rounded bg-emerald-400 inline-block" /> Superó la media</span>
                                            <span className="flex items-center gap-1.5"><span className="w-8 h-2 rounded bg-red-400 inline-block" /> Debajo de la media</span>
                                            <span className="flex items-center gap-1.5"><span className="w-8 h-2 rounded bg-gray-300 inline-block" /> Período en curso</span>
                                        </div>
                                        <div className="flex gap-4">
                                            <span className="flex items-center gap-2"><span className="w-0.5 h-4 bg-indigo-500 inline-block rounded" /><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block -ml-1" /> Media ({formatBs(mediaIngreso)})</span>
                                            {meta > 0 && <span className="flex items-center gap-2"><span className="w-0.5 h-4 bg-orange-500 inline-block rounded" /><span className="w-2 h-2 rounded-full bg-orange-500 inline-block -ml-1" /> Meta ({formatBs(meta)})</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
        </div>
    );
}
