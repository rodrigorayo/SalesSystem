import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { getAnalyticsDashboard } from '../api/api';
import {
    LayoutDashboard, TrendingUp, DollarSign, Users,
    Package, AlertTriangle, Loader2, Target,
    Activity, CheckCircle2, CloudRain, Bot
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import HourlyMultiyearChart from '../components/HourlyMultiyearChart';
import SpecialDatesChart from '../components/SpecialDatesChart';
import RegionalAndProductMix from '../components/RegionalAndProductMix';
import SalesPercentileTracker from '../components/SalesPercentileTracker';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const formatBs = (num?: number) => `Bs. ${(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatRangeLabel = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return "";
    const s = new Date(startStr);
    const e = new Date(endStr);
    return `del ${s.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })} al ${e.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

export default function DashboardMaestro() {
    const { role } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [data, setData] = useState<any>(null);
    const [climaEvento, setClimaEvento] = useState('');

    // NUEVOS ESTADOS DE TIEMPO
    const [timeRange, setTimeRange] = useState('30days'); // 'today', '7days', '30days', 'this_month', 'this_year', 'historico', 'custom_month', 'custom_year'
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
    
    const [dates, setDates] = useState({ start: '2024-01-01T00:00:00.000Z', end: '2026-12-31T23:59:59.000Z' });

    useEffect(() => {
        if (timeRange === 'custom_month') {
            const [y, m] = selectedMonth.split('-');
            const start = new Date(parseInt(y), parseInt(m) - 1, 1);
            const end = new Date(parseInt(y), parseInt(m), 0);
            end.setHours(23, 59, 59, 999);
            setDates({ start: start.toISOString(), end: end.toISOString() });
        } else if (timeRange === 'custom_year') {
            const y = parseInt(selectedYear);
            const start = new Date(y, 0, 1);
            const end = new Date(y, 11, 31);
            end.setHours(23, 59, 59, 999);
            setDates({ start: start.toISOString(), end: end.toISOString() });
        } else {
            setDates({ start: '2024-01-01T00:00:00.000Z', end: '2026-12-31T23:59:59.000Z' });
        }
    }, [timeRange, selectedMonth, selectedYear]);


    const [isBackendOffline, setIsBackendOffline] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            setIsLoading(true);
            setIsError(false);
            setIsBackendOffline(false);
            try {
                const backendTimeRange = timeRange.startsWith('custom') ? 'custom' : timeRange;
                const res = await getAnalyticsDashboard(
                    dates.start,
                    dates.end,
                    undefined,
                    backendTimeRange,
                    climaEvento
                );
                if (isMounted) setData(res);
            } catch (err: any) {
                if (isMounted) {
                    // Detectar si es error de conexión (backend apagado)
                    if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
                        setIsBackendOffline(true);
                    }
                    setIsError(true);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [timeRange, climaEvento, dates]);

    const esAdmin = ['SUPERADMIN', 'ADMIN_MATRIZ', 'ADMIN'].includes(role || '');

    if (!esAdmin) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center">
                <AlertTriangle className="text-amber-500 mb-4" size={48} />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
                <p className="text-gray-500">Solo administradores ejecutivos pueden ver el Dashboard Maestro.</p>
            </div>
        );
    }
    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center p-16 text-center max-w-lg mx-auto mt-12">
                <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center mb-6 border-2 border-red-100">
                    <AlertTriangle className="text-red-400" size={40} />
                </div>
                {isBackendOffline ? (
                    <>
                        <h2 className="text-2xl font-black text-gray-900 mb-3">Servidor Offline</h2>
                        <p className="text-gray-500 mb-2 font-medium">El backend no está corriendo en el puerto <code className="bg-gray-100 px-2 py-0.5 rounded-lg text-indigo-600 font-bold">8000</code>.</p>
                        <p className="text-gray-400 text-sm mb-6">Para iniciar el sistema, haz <strong>doble clic</strong> en el archivo:</p>
                        <div className="bg-slate-900 text-emerald-400 font-mono text-sm px-6 py-4 rounded-2xl w-full mb-8 text-left">
                            <span className="text-slate-500">SalesSystem/</span><span className="font-bold">start.bat</span>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 transition-all hover:scale-105"
                        >
                            <Activity size={18} /> Reintentar conexión
                        </button>
                    </>
                ) : (
                    <>
                        <h2 className="text-2xl font-black text-gray-900 mb-3">Error cargando datos</h2>
                        <p className="text-gray-500 mb-6">Ocurrió un error en el servidor. Revisa la consola del backend.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 transition-all hover:scale-105"
                        >
                            <Activity size={18} /> Reintentar
                        </button>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-24">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
                        <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-2xl shadow-lg shadow-indigo-200">
                            <LayoutDashboard size={28} />
                        </div>
                        Panel General — Día a Día
                    </h1>
                    <p className="text-gray-500 mt-2 text-base font-medium flex flex-wrap items-center gap-2">
                        <Activity size={16} className="text-emerald-500" />
                        <span>Orquestación en tiempo real sobre ~110k Registros Históricos.</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                            Período: {formatRangeLabel(dates.start, dates.end)}
                        </span>
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 w-full lg:w-auto mt-4 md:mt-0">
                    
                    {/* Segmented Control Rango (Estilo Premium) */}
                    <div className="flex bg-gray-100/80 p-1.5 rounded-xl shadow-inner border border-gray-200/60 overflow-x-auto w-full lg:w-auto custom-scrollbar">
                        <button 
                            onClick={() => setTimeRange('today')} 
                            className={cn("px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all", timeRange === 'today' ? "bg-white text-indigo-700 shadow-sm border border-gray-200/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50")}
                        >
                            Hoy
                        </button>
                        <button 
                            onClick={() => setTimeRange('7days')} 
                            className={cn("px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all", timeRange === '7days' ? "bg-white text-indigo-700 shadow-sm border border-gray-200/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50")}
                        >
                            7 Días
                        </button>
                        <button 
                            onClick={() => setTimeRange('30days')} 
                            className={cn("px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all", timeRange === '30days' ? "bg-white text-indigo-700 shadow-sm border border-gray-200/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50")}
                        >
                            30 Días
                        </button>

                        <div className="w-px bg-gray-300 mx-1 my-1"></div>

                        {/* Mes selector seamless */}
                        <div className={cn("flex items-center gap-2 px-3 py-1 rounded-lg transition-all", timeRange === 'custom_month' ? "bg-white shadow-sm border border-gray-200/50" : "hover:bg-gray-200/50")}>
                            <input 
                                type="month" 
                                value={selectedMonth} 
                                onChange={(e) => { setSelectedMonth(e.target.value); setTimeRange('custom_month'); }} 
                                className={cn("bg-transparent text-sm outline-none font-bold cursor-pointer transition-colors w-[120px]", timeRange === 'custom_month' ? "text-indigo-700" : "text-gray-500")}
                            />
                        </div>

                        {/* Año selector seamless */}
                        <div className={cn("flex items-center gap-2 px-3 py-1 rounded-lg transition-all", timeRange === 'custom_year' ? "bg-white shadow-sm border border-gray-200/50" : "hover:bg-gray-200/50")}>
                            <select 
                                value={selectedYear} 
                                onChange={(e) => { setSelectedYear(e.target.value); setTimeRange('custom_year'); }} 
                                className={cn("bg-transparent text-sm outline-none font-bold cursor-pointer transition-colors w-[70px]", timeRange === 'custom_year' ? "text-indigo-700" : "text-gray-500")}
                            >
                                <option value="2026">2026</option>
                                <option value="2025">2025</option>
                                <option value="2024">2024</option>
                                <option value="2023">2023</option>
                            </select>
                        </div>
                    </div>

                    {/* Filtro Clima / Evento AI */}
                    <div className="relative group w-full lg:w-auto">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Bot size={18} className="text-indigo-400 group-focus-within:text-indigo-600 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={climaEvento}
                            onChange={(e) => setClimaEvento(e.target.value)}
                            placeholder="Ajuste AI (Ej: Lluvia)"
                            className="w-full lg:w-56 pl-10 pr-4 py-2.5 bg-white border-2 border-indigo-50/50 hover:border-indigo-200 focus:border-indigo-500 rounded-xl font-bold text-sm text-indigo-950 shadow-sm transition-all outline-none"
                        />
                        {climaEvento && (
                            <span className="absolute -top-2.5 right-2 bg-indigo-600 text-white text-[9px] uppercase font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                                Aplicando
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col justify-center items-center py-32 space-y-4">
                    <Loader2 size={48} className="animate-spin text-indigo-600 mb-2" />
                    <p className="text-indigo-900 font-bold tracking-widest text-sm uppercase animate-pulse">
                        Calculando Métricas Globales...
                    </p>
                </div>
            ) : isError || !data ? (
                <div className="bg-red-50 text-red-600 p-8 rounded-3xl text-center border border-red-100">
                    <AlertTriangle size={32} className="mx-auto mb-2" />
                    <h3 className="font-bold">Error obteniendo métricas ejecutivas</h3>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">

                    {/* CAPA 1: 5 KPIs FINANCIEROS (INCLUYE PREDICCIÓN AI) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6">
                        {/* Ventas Brutas */}
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 relative overflow-hidden group hover:border-indigo-100 transition-all flex flex-col justify-between">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><DollarSign size={80} /></div>
                            <div>
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><DollarSign size={24} /></div>
                                </div>
                                <h3 className="text-gray-500 font-semibold text-sm mb-1 relative z-10">Ventas Brutas</h3>
                                <h2 className="text-3xl xl:text-4xl font-black text-gray-900 tracking-tight relative z-10">{formatBs(data.overview.ventas_brutas)}</h2>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-50 relative z-10 bg-slate-50 p-2 rounded-lg">
                                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-950">Lo que entró</span>
                            </div>
                        </div>

                        {/* Margen Líquido 15% */}
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 relative overflow-hidden group hover:border-emerald-100 transition-all flex flex-col justify-between">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><TrendingUp size={80} /></div>
                            <div>
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><TrendingUp size={24} /></div>
                                    <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-xs font-bold">
                                        <TrendingUp size={12} /> 15%
                                    </span>
                                </div>
                                <h3 className="text-gray-500 font-semibold text-sm mb-1 relative z-10">Margen Líquido</h3>
                                <h2 className="text-3xl xl:text-4xl font-black text-emerald-900 tracking-tight relative z-10">{formatBs(data.overview.margen_liquido)}</h2>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-50 relative z-10 bg-slate-50 p-2 rounded-lg">
                                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-950">Lo que nos queda libre</span>
                            </div>
                        </div>

                        {/* Ticket Promedio */}
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 relative overflow-hidden group flex flex-col justify-between">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Target size={80} /></div>
                            <div>
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="p-3 bg-slate-100 text-slate-800 rounded-2xl"><Target size={24} /></div>
                                </div>
                                <h3 className="text-gray-500 font-semibold text-sm mb-1 relative z-10">Ticket Promedio</h3>
                                <h2 className="text-3xl xl:text-4xl font-black text-gray-900 tracking-tight relative z-10">{formatBs(data.overview.average_ticket)}</h2>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-50 relative z-10 bg-slate-50 p-2 rounded-lg">
                                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-950">Lo que gasta cada uno</span>
                            </div>
                        </div>

                        {/* Clientes Recurrentes */}
                        <div className="bg-white border-gray-100 border rounded-[2rem] p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
                            <div className="absolute top-0 right-0 p-4 opacity-5"><Users size={80} /></div>
                            <div>
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="p-3 bg-pink-50 text-pink-600 rounded-2xl"><Users size={24} /></div>
                                </div>
                                <h3 className="text-gray-500 font-semibold text-sm mb-1 relative z-10">Clientes Frecuentes</h3>
                                <div className="flex items-baseline gap-2 relative z-10">
                                    <h2 className="text-3xl xl:text-4xl font-black text-gray-900 tracking-tight">{data.overview.recurrent_customers}</h2>
                                    <span className="text-gray-500 font-medium">de {data.overview.active_customers}</span>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-50 relative z-10 bg-slate-50 p-2 rounded-lg">
                                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-950">Fidelización</span>
                            </div>
                        </div>

                        {/* RECUADRO NUEVO: Predicción AI Contextual */}
                        <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-[2rem] p-6 shadow-xl border-2 border-indigo-500/30 relative overflow-hidden group flex flex-col justify-between md:col-span-3 xl:col-span-1">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform duration-500"><Bot size={90} className="text-white" /></div>
                            
                            {/* Decorative background grid */}
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none"></div>

                            <div>
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-400/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                                        <Bot size={24} />
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/20 border border-indigo-400/30 backdrop-blur-md rounded-lg shadow-[0_0_10px_rgba(99,102,241,0.1)]">
                                        <CloudRain size={12} className="text-indigo-300" />
                                        <span className="text-[10px] font-black tracking-widest text-indigo-100 uppercase">Impacto AI</span>
                                    </div>
                                </div>
                                <h3 className="text-indigo-200 font-semibold text-sm mb-1 relative z-10">Proyección (Contexto)</h3>
                                <div className="relative z-10 flex items-center gap-2">
                                    <h2 className="text-3xl xl:text-4xl font-black text-white tracking-tight">
                                        {formatBs((data.overview.ventas_brutas || 0) * (climaEvento ? 1.15 : 1.05))}
                                    </h2>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-indigo-500/20 relative z-10 bg-black/20 backdrop-blur-sm p-2.5 rounded-lg flex justify-between items-center">
                                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-300">Meta ajustada</span>
                                {climaEvento && <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"></span>}
                            </div>
                        </div>
                    </div>

                    {/* CAPA 2: Comparativa Dinámica Horaria Multi-Año */}
                    <HourlyMultiyearChart />

                    {/* CAPA 2.5: Comparativa de Fechas Especiales y Festividades */}
                    <SpecialDatesChart />

                    {/* CAPA 2B: Radar de Percentiles con Semáforo */}
                    <SalesPercentileTracker />

                    {/* CAPA 3: Sucursales + Mix Rápido Top 5 con Fechas Independientes */}
                    <RegionalAndProductMix />

                    {/* CAPA 4: Orquestador de Eventos */}
                    {data.recent_activity?.length > 0 && (
                        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
                            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2 mb-6 border-b border-gray-50 pb-4">
                                <Activity className="text-sky-500" /> Orquestador de Eventos en Tiempo Real
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {data.recent_activity.map((act: any) => (
                                    <div key={act.id} className="p-5 rounded-2xl bg-slate-50 border border-gray-100 flex flex-col h-full hover:bg-white hover:shadow-lg transition-all group">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                                                act.type === 'sale' ? 'bg-emerald-100 text-emerald-600' :
                                                act.type === 'inventory' ? 'bg-amber-100 text-amber-600' :
                                                act.type === 'goal' ? 'bg-indigo-100 text-indigo-600' :
                                                'bg-rose-100 text-rose-600'
                                            )}>
                                                {act.type === 'sale' && <DollarSign size={20} />}
                                                {act.type === 'inventory' && <Package size={20} />}
                                                {act.type === 'goal' && <CheckCircle2 size={20} />}
                                                {act.type === 'alert' && <AlertTriangle size={20} />}
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{act.time}</span>
                                        </div>
                                        <p className="text-sm font-bold text-indigo-950 mb-auto leading-tight">{act.msg}</p>
                                        <div className="mt-4 pt-3 border-t border-gray-100 font-black text-base text-indigo-950">{act.val}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}