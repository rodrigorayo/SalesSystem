import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { getAnalyticsDashboard } from '../api/api';
import {
    AlertTriangle, Loader2, Target, Activity,
    TrendingUp, Package, Calendar, DollarSign,
    Search, FileSpreadsheet, Trophy, Clock
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
    const [rentData, setRentData] = useState<any[]>([]);
    const [isRentLoading, setIsRentLoading] = useState(false);
    // Vista semanal / mensual para el grÃ¡fico de evoluciÃ³n
    const [chartView, setChartView] = useState<'day' | 'week' | 'month'>('week');
    const [meta, setMeta] = useState<number>(0);

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
                const res = await getAnalyticsDashboard(
                    '2024-01-01T00:00:00.000Z',
                    '2026-12-31T23:59:59.000Z',
                    undefined,
                    rentRange,
                    ''
                );
                if (isMounted) setRentData(res?.top_productos_rentabilidad || []);
            } catch (e) {
                if (isMounted) setRentData([]);
            } finally {
                if (isMounted) setIsRentLoading(false);
            }
        };
        fetchRent();
        return () => { isMounted = false; };
    }, [rentRange]);

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

    const rentabilidad: any[] = (data?.top_productos_rentabilidad || []).filter((p: any) => 
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
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

    const handleExportCSV = () => {
        if (!rentabilidad.length) return;
        const header = ["Producto", "Unidades", "Ingreso Bruto (Bs)", "Costo 85% (Bs)", "Margen 15% (Bs)", "Precio Prom. PR (Bs)"];
        const csv = [header.join(","), ...rentabilidad.map((p: any) => `"${p.nombre}",${p.cantidad},${p.ingresos},${p.costo_85},${p.margen_15},${(p.ingresos/(p.cantidad||1)).toFixed(2)}`)].join("\n");
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rentabilidad_${timeRange}.csv`;
        a.click();
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-24">

            {/* Header */}
            <div className="space-y-4">
                {/* Título */}
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl shadow-lg shadow-amber-200">
                        <Target size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Catálogo y Rentabilidad</h1>
                        <p className="text-gray-400 text-sm font-medium flex items-center gap-1.5 mt-0.5">
                            <Activity size={13} className="text-amber-500" />
                            Análisis de Rentabilidad, Matriz BCG y evolución de costos por producto.
                        </p>
                    </div>
                </div>

                {/* Pills de rango — debajo del título */}
                <div className="flex flex-wrap items-center gap-1.5 bg-white px-3 py-2 rounded-2xl border border-gray-100 shadow-sm w-fit">
                    {Object.entries(rangeLabels).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => handlePresetClick(key)}
                            className={cn(
                                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap",
                                timeRange === key
                                ? 'bg-amber-500 text-white shadow-sm shadow-amber-200'
                                : 'text-gray-500 hover:bg-amber-50 hover:text-amber-700'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col justify-center items-center py-32 space-y-4">
                    <Loader2 size={48} className="animate-spin text-amber-500 mb-2" />
                    <p className="text-amber-900 font-bold tracking-widest text-sm uppercase animate-pulse">
                        Analizando Catálogo y Márgenes...
                    </p>
                </div>
            ) : isError || !data ? (
                <div className="bg-red-50 text-red-600 p-8 rounded-3xl text-center border border-red-100">
                    <AlertTriangle size={32} className="mx-auto mb-2" />
                    <h3 className="font-bold">Error cargando datos de catálogo</h3>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

                    {/* CAPA 1: KPIs del PerÃ­odo Seleccionado */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {/* Ingresos Brutos del PerÃ­odo */}
                        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-amber-100 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                                    <DollarSign size={22} />
                                </div>
                            </div>
                            <div>
                                <p className="text-gray-500 text-sm font-semibold mb-1">Ingresos Brutos</p>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight">{formatBs(data.overview?.ventas_brutas)}</h2>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-50 bg-amber-50 rounded-lg p-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Total del perÃ­odo</span>
                            </div>
                        </div>

                        {/* Margen LÃ­quido */}
                        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-emerald-100 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                                    <TrendingUp size={22} />
                                </div>
                                <span className="text-xs font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg">15%</span>
                            </div>
                            <div>
                                <p className="text-gray-500 text-sm font-semibold mb-1">Margen LÃ­quido</p>
                                <h2 className="text-3xl font-black text-emerald-900 tracking-tight">{formatBs(data.overview?.margen_liquido)}</h2>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-50 bg-emerald-50 rounded-lg p-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Lo que queda libre</span>
                            </div>
                        </div>

                        {/* Producto Estrella */}
                        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-[2rem] p-6 text-white shadow-lg shadow-amber-200 flex flex-col justify-between">
                            <div className="p-3 bg-white/20 rounded-2xl w-fit mb-4">
                                <Package size={22} />
                            </div>
                            <div>
                                <p className="text-amber-100 text-sm font-semibold mb-1">Producto Estrella</p>
                                <h2 className="text-xl font-black tracking-tight leading-tight">
                                    {data.top_productos_rentabilidad?.[0]?.nombre || 'Sin datos'}
                                </h2>
                                {data.top_productos_rentabilidad?.[0] && (
                                    <p className="text-amber-100 text-xs mt-1">{formatBs(data.top_productos_rentabilidad[0].ingresos)} en ingresos</p>
                                )}
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/20 p-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-200">#1 en rentabilidad</span>
                            </div>
                        </div>

                        {/* Ticket Promedio por Producto */}
                        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                    <Target size={22} />
                                </div>
                            </div>
                            <div>
                                <p className="text-gray-500 text-sm font-semibold mb-1">Ticket Promedio</p>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight">{formatBs(data.overview?.average_ticket)}</h2>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-50 bg-indigo-50 rounded-lg p-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Por transacción</span>
                            </div>
                        </div>

                        {/* Top Sucursal Contribuidora */}
                        {data.sucursal_top && (
                            <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[2rem] p-6 text-white shadow-lg shadow-indigo-200 flex flex-col justify-between lg:col-span-4 mt-2">
                                <div className="flex items-center gap-3 mb-2">
                                    <Trophy size={20} className="text-indigo-200" />
                                    <p className="text-indigo-100 text-sm font-semibold">Sucursal Top Contribuidora</p>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tight leading-tight">
                                            {data.sucursal_top.nombre}
                                        </h2>
                                        <p className="text-indigo-100 text-sm mt-1">{formatBs(data.sucursal_top.ingresos)}</p>
                                    </div>
                                    <div className="bg-white/20 px-3 py-1.5 rounded-xl border border-white/30 backdrop-blur-sm">
                                        <span className="text-sm font-black text-white">{data.sucursal_top.pct}% del total global</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CAPA 2: Matriz BCG Evolucionada con su propio estado de tiempo */}
                    <BcgMatrix />

                    {/* CAPA 3: Tabla de Rentabilidad por Producto */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
                        {/* Header de la tarjeta con filtros propios */}
                        <div className="mb-6 pb-4 border-b border-gray-50">
                            <div className="flex flex-col gap-4">
                                {/* TÃ­tulo + bÃºsqueda + exportar */}
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><DollarSign size={20} /></div>
                                            Rentabilidad por Producto
                                        </h2>
                                        <p className="text-gray-500 text-sm mt-1">
                                            Top productos ordenados por ingresos. Costo al <strong>85%</strong>, Margen al <strong>15%</strong> y columna PR (Precio Promedio).
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

                                {/* Botones de Filtro de Fecha DENTRO de la tarjeta */}
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
                            </div>
                        </div>

                        {(() => {
                            const rentabilidad = rentData.filter((p: any) =>
                                p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
                            );
                            return rentabilidad.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">#</th>
                                            <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">Producto</th>
                                            <th className="text-right py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">Unidades</th>
                                            <th className="text-right py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">Ingreso Bruto</th>
                                            <th className="text-right py-3 px-4 text-xs font-black text-red-400 uppercase tracking-widest">Costo (85%)</th>
                                            <th className="text-right py-3 px-4 text-xs font-black text-emerald-500 uppercase tracking-widest">Margen (15%)</th>
                                            <th className="text-center py-3 px-4 text-xs font-black text-indigo-500 uppercase tracking-widest">PR (Precio Prom.)</th>
                                            <th className="text-center py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">% Margen</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rentabilidad.map((prod, i) => (
                                            <tr
                                                key={i}
                                                className={cn(
                                                    "border-b border-gray-50 hover:bg-amber-50/50 transition-colors group",
                                                    i === 0 ? "bg-amber-50/30" : ""
                                                )}
                                            >
                                                <td className="py-4 px-4">
                                                    <div className={cn(
                                                        "w-7 h-7 rounded-xl font-black flex items-center justify-center text-xs",
                                                        i === 0 ? "bg-amber-400 text-white" :
                                                        i === 1 ? "bg-gray-300 text-white" :
                                                        i === 2 ? "bg-orange-300 text-white" :
                                                        "bg-gray-100 text-gray-500"
                                                    )}>
                                                        {i + 1}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className="font-bold text-gray-800 group-hover:text-amber-700 transition-colors">{prod.nombre}</span>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <span className="font-semibold text-gray-600">{prod.cantidad.toLocaleString()}</span>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <span className="font-bold text-gray-900">{formatBs(prod.ingresos)}</span>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <span className="font-bold text-red-500">{formatBs(prod.costo_85)}</span>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <span className="font-black text-emerald-600 text-base">{formatBs(prod.margen_15)}</span>
                                                </td>
                                                <td className="py-4 px-4 text-center">
                                                    <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">Bs. {(prod.ingresos / (prod.cantidad || 1)).toFixed(2)}</span>
                                                </td>
                                                <td className="py-4 px-4 text-center">
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                        15.0%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50 rounded-b-2xl">
                                            <td colSpan={3} className="py-4 px-4 font-black text-gray-700 text-sm uppercase tracking-wider">
                                                TOTAL (Top {rentabilidad.length})
                                            </td>
                                            <td className="py-4 px-4 text-right font-black text-gray-900">
                                                {formatBs(rentabilidad.reduce((s, p) => s + p.ingresos, 0))}
                                            </td>
                                            <td className="py-4 px-4 text-right font-black text-red-500">
                                                {formatBs(rentabilidad.reduce((s, p) => s + p.costo_85, 0))}
                                            </td>
                                            <td className="py-4 px-4 text-right font-black text-emerald-600 text-base">
                                                {formatBs(rentabilidad.reduce((s, p) => s + p.margen_15, 0))}
                                            </td>
                                            <td className="py-4 px-4 text-center text-gray-400">-</td>
                                            <td className="py-4 px-4 text-center">
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                    15.0%
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
            )}
        </div>
    );
}
