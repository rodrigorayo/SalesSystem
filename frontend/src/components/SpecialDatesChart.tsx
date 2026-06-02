import { useState, useEffect, useCallback } from 'react';
import { getHourlyMultiyear } from '../api/api';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip
} from 'recharts';
import { Activity, Calendar, Loader2, TrendingUp, TrendingDown, Minus, Store, Sparkles, ChevronDown, ChevronUp, Clock, Info } from 'lucide-react';

const formatBs = (n: number) =>
    `Bs. ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ───────────────────────────────────────────────────────────────────────────────
// Helpers de Festividades
// ───────────────────────────────────────────────────────────────────────────────
const getEasterSundayDate = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = Math.floor((h + l - 7 * m + 114) / 31);
    const p = (h + l - 7 * m + 114) % 31;
    return new Date(year, n - 1, p + 1);
};

const getHolidayDateString = (holidayName: string, year: number): string => {
    let d: Date;
    switch (holidayName) {
        case "Año Nuevo": d = new Date(year, 0, 1); break;
        case "Estado Plurinacional": d = new Date(year, 0, 22); break;
        case "San Valentín": d = new Date(year, 1, 14); break;
        case "Día del Padre": d = new Date(year, 2, 19); break;
        case "Día del Trabajo": d = new Date(year, 4, 1); break;
        case "Día de la Madre": d = new Date(year, 4, 27); break;
        case "Año Nuevo Andino": d = new Date(year, 5, 21); break;
        case "Día de la Patria": d = new Date(year, 7, 6); break;
        case "Todos Santos": d = new Date(year, 10, 2); break;
        case "Navidad": d = new Date(year, 11, 25); break;
        case "Carnaval (Lunes)": {
            d = getEasterSundayDate(year);
            d.setDate(d.getDate() - 48);
            break;
        }
        case "Carnaval (Martes)": {
            d = getEasterSundayDate(year);
            d.setDate(d.getDate() - 47);
            break;
        }
        case "Viernes Santo": {
            d = getEasterSundayDate(year);
            d.setDate(d.getDate() - 2);
            break;
        }
        case "Pascua": {
            d = getEasterSundayDate(year);
            break;
        }
        case "Corpus Christi": {
            d = getEasterSundayDate(year);
            d.setDate(d.getDate() + 60);
            break;
        }
        default: d = new Date(year, 0, 1);
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

// Componente para minigráfico en tarjetas superiores (Sparklines)
const Sparkline = ({ data, dataKey, stroke }: { data: any[], dataKey: string, stroke: string }) => {
    return (
        <div className="w-24 h-10 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                    <Line
                        type="monotone"
                        dataKey={dataKey}
                        stroke={stroke}
                        strokeWidth={2}
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────────
// Tooltip personalizado para el gráfico principal
// ───────────────────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, meta }: any) => {
    if (!active || !payload?.length) return null;

    const real   = payload.find((p: any) => p.dataKey === 'real')?.value ?? null;
    const anio1  = payload.find((p: any) => p.dataKey === 'anio1')?.value ?? null;
    const anio2  = payload.find((p: any) => p.dataKey === 'anio2')?.value ?? null;

    const variacion = (curr: number | null, prev: number | null) => {
        if (curr === null || prev === null || prev === 0) return null;
        return ((curr - prev) / prev * 100).toFixed(1);
    };

    const vVsA1 = variacion(real, anio1);
    const vVsA2 = variacion(real, anio2);

    const BadgeVar = ({ v }: { v: string | null }) => {
        if (v === null) return <span className="text-gray-400 text-xs">—</span>;
        const n = parseFloat(v);
        return (
            <span className={`text-xs font-black flex items-center gap-0.5 ${n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                {n > 0 ? <TrendingUp size={10} /> : n < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                {n > 0 ? '+' : ''}{v}%
            </span>
        );
    };

    return (
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 p-4 min-w-[220px]">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">{label}</p>
            <div className="space-y-2">
                {real !== null && (
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div>
                            <span className="text-xs font-bold text-gray-600">{meta?.real_label || 'Año Base'}</span>
                        </div>
                        <span className="font-black text-gray-900 text-sm">{formatBs(real)}</span>
                    </div>
                )}
                {anio1 !== null && (
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                            <span className="text-xs font-bold text-gray-500">{meta?.anio1_label || 'Año -1'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-700 text-sm">{formatBs(anio1)}</span>
                            <BadgeVar v={vVsA1} />
                        </div>
                    </div>
                )}
                {anio2 !== null && (
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-400"></div>
                            <span className="text-xs font-bold text-gray-500">{meta?.anio2_label || 'Año -2'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-700 text-sm">{formatBs(anio2)}</span>
                            <BadgeVar v={vVsA2} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────────
// Componente principal
// ───────────────────────────────────────────────────────────────────────────────
export default function SpecialDatesChart() {
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [holidayName, setHolidayName] = useState<string>('Viernes Santo');
    const [baseYear, setBaseYear] = useState<number>(2026);
    const [sucursal, setSucursal] = useState<string>('Heroinas');
    const [chartData, setChartData] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);

    const HOLIDAYS = [
        { value: "Viernes Santo", label: "Semana Santa (Viernes Santo)" },
        { value: "Pascua", label: "Pascua (Domingo de Resurrección)" },
        { value: "Carnaval (Lunes)", label: "Carnaval (Lunes)" },
        { value: "Carnaval (Martes)", label: "Carnaval (Martes)" },
        { value: "Corpus Christi", label: "Corpus Christi" },
        { value: "Año Nuevo", label: "Año Nuevo (1 Enero)" },
        { value: "Estado Plurinacional", label: "Día del Estado Plurinacional (22 Ene)" },
        { value: "San Valentín", label: "San Valentín (14 Feb)" },
        { value: "Día del Padre", label: "Día del Padre (19 Mar)" },
        { value: "Día del Trabajo", label: "Día del Trabajo (1 May)" },
        { value: "Día de la Madre", label: "Día de la Madre (27 May)" },
        { value: "Año Nuevo Andino", label: "Año Nuevo Andino (21 Jun)" },
        { value: "Día de la Patria", label: "Día de la Patria / Independencia (6 Ago)" },
        { value: "Todos Santos", label: "Todos Santos (2 Nov)" },
        { value: "Navidad", label: "Navidad (25 Dic)" }
    ];

    const YEARS = [2026, 2025, 2024];

    const SUCURSALES = [
        { value: '', label: 'Todas las Sucursales' },
        { value: 'Heroinas', label: 'Heroínas' },
        { value: 'Recoleta', label: 'Recoleta' },
        { value: 'Calacoto', label: 'Calacoto' },
    ];

    const fetchData = useCallback(async (holiday: string, year: number, suc: string) => {
        setIsLoading(true);
        setIsError(false);
        try {
            const fechaStr = getHolidayDateString(holiday, year);
            const res = await getHourlyMultiyear(fechaStr, suc || undefined);
            setChartData(res.horas || []);
            setMeta(res.meta || null);
        } catch (e) {
            console.error('SpecialDatesChart error:', e);
            setIsError(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isExpanded) {
            fetchData(holidayName, baseYear, sucursal);
        }
    }, [isExpanded, holidayName, baseYear, sucursal, fetchData]);

    // Cálculos estadísticos para las tarjetas y lista de la derecha
    const totalReal = chartData.reduce((sum, h) => sum + h.real, 0);
    const totalAnio1 = chartData.reduce((sum, h) => sum + h.anio1, 0);
    const totalAnio2 = chartData.reduce((sum, h) => sum + h.anio2, 0);

    const averageHourSale = chartData.length > 0 ? totalReal / chartData.length : 0;
    const maxHourSale = chartData.reduce((max, h) => h.real > max ? h.real : max, 0);
    const peakHour = chartData.find(h => h.real === maxHourSale)?.hora || "—";
    const liquidMargin = totalReal * 0.15; // Regla del 15% líquido

    return (
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-sm border border-gray-100 flex flex-col transition-all duration-300">
            
            {/* Header del Acordeón Desplegable */}
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                className={`p-6 sm:p-8 flex items-center justify-between cursor-pointer select-none rounded-[2rem] hover:bg-slate-50/50 transition-colors ${isExpanded ? 'border-b border-gray-100' : ''}`}
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm">
                        <Sparkles size={22} className={isExpanded ? 'animate-pulse' : ''} />
                    </div>
                    <div>
                        <h3 className="text-lg sm:text-xl font-black text-gray-900 flex items-center gap-2">
                            Comparativa de Fechas Especiales y Festividades
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-full shrink-0">
                                Especial
                            </span>
                        </h3>
                        <p className="text-gray-400 text-sm font-medium mt-0.5">
                            Compara el mismo día festivo móvil (Semana Santa, Carnaval) o fijo a través de los años.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!isExpanded && (
                        <span className="hidden sm:inline text-xs font-bold text-gray-400 border border-gray-200 rounded-xl px-3 py-1.5 bg-white shadow-sm">
                            Desplegar para analizar
                        </span>
                    )}
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>
            </div>

            {/* Contenido Desplegable (Animación de altura) */}
            {isExpanded && (
                <div className="p-8 animate-in fade-in slide-in-from-top-4 duration-300 space-y-8">
                    
                    {/* Controls Row */}
                    <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
                        <div className="text-sm font-bold text-gray-500 flex items-center gap-1.5">
                            <Info size={14} className="text-indigo-400" />
                            Ajusta los parámetros para recalcular el análisis temporal
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                            {/* Selector de Festividad */}
                            <div className="relative group flex-1 sm:flex-none">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Calendar size={15} className="text-indigo-400" />
                                </div>
                                <select
                                    value={holidayName}
                                    onChange={(e) => setHolidayName(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 rounded-xl font-bold text-sm text-gray-800 shadow-inner outline-none transition-all cursor-pointer appearance-none"
                                >
                                    {HOLIDAYS.map(h => (
                                        <option key={h.value} value={h.value}>{h.label}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>

                            {/* Selector de Año Base */}
                            <div className="relative group">
                                <select
                                    value={baseYear}
                                    onChange={(e) => setBaseYear(Number(e.target.value))}
                                    className="px-4 py-2 bg-gray-50 border border-gray-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 rounded-xl font-bold text-sm text-gray-800 shadow-inner outline-none transition-all cursor-pointer appearance-none"
                                >
                                    {YEARS.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>

                            {/* Selector de Sucursal */}
                            <div className="relative group flex-1 sm:flex-none">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Store size={15} className="text-indigo-400" />
                                </div>
                                <select
                                    value={sucursal}
                                    onChange={(e) => setSucursal(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 rounded-xl font-bold text-sm text-gray-800 shadow-inner outline-none transition-all cursor-pointer appearance-none"
                                >
                                    {SUCURSALES.map(s => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="h-96 flex flex-col items-center justify-center gap-4 text-indigo-500">
                            <Loader2 size={40} className="animate-spin" />
                            <p className="text-sm font-black tracking-widest uppercase animate-pulse">Alineando registros de festividad...</p>
                        </div>
                    ) : isError ? (
                        <div className="h-96 flex items-center justify-center text-red-400 text-sm font-bold bg-red-50 rounded-2xl border border-red-100">
                            Error cargando datos. Verifica la conexión con el backend o el servidor de base de datos.
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            
                            {/* CAPA SUPERA: 3 Tarjetas de Métricas con Sparklines (Exacto al diseño) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                
                                {/* Card 1: Ventas Año Seleccionado */}
                                <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                                            Ventas {holidayName} {baseYear}
                                        </span>
                                        <div className="flex items-baseline gap-2">
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                                {formatBs(totalReal)}
                                            </h2>
                                            {meta && meta.variacion_vs_anio1 !== null && (
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${meta.variacion_vs_anio1 > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                                    {meta.variacion_vs_anio1 > 0 ? '+' : ''}{meta.variacion_vs_anio1}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Sparkline data={chartData} dataKey="real" stroke="#6366f1" />
                                </div>

                                {/* Card 2: Ventas Año -1 */}
                                <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                                            Ventas {holidayName} {baseYear - 1}
                                        </span>
                                        <h2 className="text-2xl font-black text-slate-700 tracking-tight">
                                            {formatBs(totalAnio1)}
                                        </h2>
                                    </div>
                                    <Sparkline data={chartData} dataKey="anio1" stroke="#f59e0b" />
                                </div>

                                {/* Card 3: Ventas Año -2 */}
                                <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                                            Ventas {holidayName} {baseYear - 2}
                                        </span>
                                        <h2 className="text-2xl font-black text-slate-700 tracking-tight">
                                            {formatBs(totalAnio2)}
                                        </h2>
                                    </div>
                                    <Sparkline data={chartData} dataKey="anio2" stroke="#fb7185" />
                                </div>
                            </div>

                            {/* CAPA INFERIOR: Gráfico Principal (Left) + Acciones y Métricas (Right) */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                
                                {/* Columna Izquierda: LineChart de Ventas Horarias */}
                                <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 flex flex-col shadow-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="text-base font-black text-indigo-950 flex items-center gap-2">
                                            <Activity size={16} className="text-indigo-500" />
                                            Flujo de Ventas Horario Comparativo (YoY)
                                        </h4>
                                        {meta && (
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">{baseYear}</span>
                                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ml-2"></span>
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">{baseYear - 1}</span>
                                                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 ml-2"></span>
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">{baseYear - 2}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="h-[350px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                                                <XAxis 
                                                    dataKey="hora" 
                                                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis 
                                                    tickFormatter={(v) => `Bs ${v.toLocaleString()}`} 
                                                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} 
                                                    axisLine={false}
                                                    tickLine={false}
                                                    width={70}
                                                />
                                                <Tooltip content={<CustomTooltip meta={meta} />} />
                                                
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="anio2" 
                                                    stroke="#fb7185" 
                                                    strokeWidth={2} 
                                                    dot={false}
                                                    connectNulls 
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="anio1" 
                                                    stroke="#f59e0b" 
                                                    strokeWidth={2.5} 
                                                    dot={false}
                                                    connectNulls 
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="real" 
                                                    stroke="#6366f1" 
                                                    strokeWidth={4} 
                                                    dot={false}
                                                    activeDot={{ r: 8, stroke: '#fff', strokeWidth: 3 }}
                                                    connectNulls 
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Columna Derecha: Métricas y KPIs de la Festividad */}
                                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between pb-4 border-b border-gray-50 mb-4">
                                            <h4 className="text-base font-black text-indigo-950">
                                                Métricas de la Festividad
                                            </h4>
                                            <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl">
                                                <Activity size={14} />
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            
                                            {/* Promedio por Hora */}
                                            <div className="flex justify-between items-center py-2.5 border-b border-gray-50/50 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                                                <span className="text-xs font-semibold text-gray-500 flex items-center gap-2">
                                                    <Clock size={13} className="text-gray-400" />
                                                    Venta Promedio Horaria
                                                </span>
                                                <span className="text-sm font-black text-gray-800">
                                                    {formatBs(averageHourSale)}
                                                </span>
                                            </div>

                                            {/* Venta Pico */}
                                            <div className="flex justify-between items-center py-2.5 border-b border-gray-50/50 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                                                <span className="text-xs font-semibold text-gray-500 flex items-center gap-2">
                                                    <TrendingUp size={13} className="text-emerald-500" />
                                                    Venta Pico Máxima
                                                </span>
                                                <span className="text-sm font-black text-emerald-700">
                                                    {formatBs(maxHourSale)}
                                                </span>
                                            </div>

                                            {/* Hora Pico */}
                                            <div className="flex justify-between items-center py-2.5 border-b border-gray-50/50 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                                                <span className="text-xs font-semibold text-gray-500 flex items-center gap-2">
                                                    <Clock size={13} className="text-indigo-500" />
                                                    Hora Pico (Mayor Venta)
                                                </span>
                                                <span className="text-sm font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                                                    {peakHour}
                                                </span>
                                            </div>

                                            {/* Margen Líquido */}
                                            <div className="flex justify-between items-center py-2.5 border-b border-gray-50/50 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                                                <span className="text-xs font-semibold text-gray-500 flex items-center gap-2">
                                                    <Sparkles size={13} className="text-amber-500" />
                                                    Margen Líquido (15%)
                                                </span>
                                                <span className="text-sm font-black text-amber-700">
                                                    {formatBs(liquidMargin)}
                                                </span>
                                            </div>

                                            {/* Desempeño YoY */}
                                            <div className="flex justify-between items-center py-2.5 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                                                <span className="text-xs font-semibold text-gray-500 flex items-center gap-2">
                                                    <TrendingUp size={13} className="text-sky-500" />
                                                    Desempeño vs Hace 2 Años
                                                </span>
                                                {meta && meta.variacion_vs_anio2 !== null ? (
                                                    <span className={`text-sm font-black flex items-center gap-0.5 ${meta.variacion_vs_anio2 > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {meta.variacion_vs_anio2 > 0 ? '+' : ''}{meta.variacion_vs_anio2}%
                                                    </span>
                                                ) : (
                                                    <span className="text-sm font-black text-gray-400">—</span>
                                                )}
                                            </div>

                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-50 border border-gray-100 p-3 rounded-2xl text-[10px] font-bold text-gray-500 mt-6 leading-relaxed flex items-start gap-2">
                                        <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                                        <span>Las festividades móviles se calculan dinámicamente según el Domingo de Pascua de cada año respectivo.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
