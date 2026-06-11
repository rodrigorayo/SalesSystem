import { useState, useEffect, useCallback, useRef } from 'react';
import { getHourlyMultiyear } from '../api/api';
import {
    ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
    CartesianGrid, Tooltip
} from 'recharts';
import { 
    Activity, Calendar, Loader2, TrendingUp, TrendingDown, Minus, Store, 
    Sparkles, ChevronDown, ChevronUp, Clock, Info, Settings, Trash2, Plus, 
    Heart, Gift, PartyPopper, X, Music, Flame, Star, Flag, Ghost, Sunrise, Map, Check
} from 'lucide-react';
import { useOnClickOutside } from 'usehooks-ts';

const formatBs = (n: number) =>
    `Bs. ${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ───────────────────────────────────────────────────────────────────────────────
// Helpers de Festividades (solo para inicialización)
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
        case "Carnaval (Lunes)": { d = getEasterSundayDate(year); d.setDate(d.getDate() - 48); break; }
        case "Carnaval (Martes)": { d = getEasterSundayDate(year); d.setDate(d.getDate() - 47); break; }
        case "Viernes Santo": { d = getEasterSundayDate(year); d.setDate(d.getDate() - 2); break; }
        case "Pascua": { d = getEasterSundayDate(year); break; }
        case "Corpus Christi": { d = getEasterSundayDate(year); d.setDate(d.getDate() + 60); break; }
        default: d = new Date(year, 0, 1);
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const ICON_MAP: Record<string, any> = {
    Heart, Gift, PartyPopper, Sparkles, Music, Flame, Star, Flag, Ghost, Sunrise, Map, Calendar
};

interface Festividad {
    id: number;
    nombre: string;
    icon: string;
    fechas: {
        current: string;
        past1: string;
        past2: string;
    };
}

// ───────────────────────────────────────────────────────────────────────────────
// Componentes Secundarios
// ───────────────────────────────────────────────────────────────────────────────
const Sparkline = ({ data, dataKey, stroke }: { data: any[], dataKey: string, stroke: string }) => {
    return (
        <div className="w-24 h-10 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                    <defs>
                        <linearGradient id={`color-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={stroke} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={stroke} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={2} fillOpacity={1} fill={`url(#color-${dataKey})`} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

const CustomTooltip = ({ active, payload, label, meta, colors }: any) => {
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

    const cReal = colors?.real || "#10b981";
    const cAnio1 = colors?.anio1 || "#64748b";
    const cAnio2 = colors?.anio2 || "#cbd5e1";
    const cPrediccion = "#a855f7"; // Púrpura neón para IA

    const prediccion = payload.find((p: any) => p.dataKey === 'prediccion_ia')?.value ?? null;

    return (
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 p-4 min-w-[220px]">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">{label}</p>
            <div className="space-y-2">
                {prediccion !== null && (
                    <div className="flex items-center justify-between gap-4 border-b border-gray-50 pb-2 mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cPrediccion }}></div>
                            <span className="text-xs font-bold text-gray-500">Predicción IA</span>
                        </div>
                        <span className="font-bold text-gray-600 text-sm">{formatBs(prediccion)}</span>
                    </div>
                )}
                {real !== null && (
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cReal }}></div>
                            <span className="text-xs font-bold text-gray-600">{meta?.real_label || 'Año Base'}</span>
                        </div>
                        <span className="font-black text-gray-900 text-sm">{formatBs(real)}</span>
                    </div>
                )}
                {anio1 !== null && (
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cAnio1 }}></div>
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
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cAnio2 }}></div>
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
    
    // Estado Dinámico de Festividades
    const [festividades, setFestividades] = useState<Festividad[]>([
        { id: 1, nombre: "Viernes Santo", icon: "Sunrise", fechas: { current: getHolidayDateString("Viernes Santo", 2026), past1: getHolidayDateString("Viernes Santo", 2025), past2: getHolidayDateString("Viernes Santo", 2024) } },
        { id: 2, nombre: "Pascua", icon: "Sunrise", fechas: { current: getHolidayDateString("Pascua", 2026), past1: getHolidayDateString("Pascua", 2025), past2: getHolidayDateString("Pascua", 2024) } },
        { id: 3, nombre: "Carnaval (Lunes)", icon: "PartyPopper", fechas: { current: getHolidayDateString("Carnaval (Lunes)", 2026), past1: getHolidayDateString("Carnaval (Lunes)", 2025), past2: getHolidayDateString("Carnaval (Lunes)", 2024) } },
        { id: 4, nombre: "Carnaval (Martes)", icon: "Music", fechas: { current: getHolidayDateString("Carnaval (Martes)", 2026), past1: getHolidayDateString("Carnaval (Martes)", 2025), past2: getHolidayDateString("Carnaval (Martes)", 2024) } },
        { id: 5, nombre: "Corpus Christi", icon: "Sparkles", fechas: { current: getHolidayDateString("Corpus Christi", 2026), past1: getHolidayDateString("Corpus Christi", 2025), past2: getHolidayDateString("Corpus Christi", 2024) } },
        { id: 6, nombre: "Año Nuevo", icon: "Sparkles", fechas: { current: "2026-01-01", past1: "2025-01-01", past2: "2024-01-01" } },
        { id: 7, nombre: "Estado Plurinacional", icon: "Flag", fechas: { current: "2026-01-22", past1: "2025-01-22", past2: "2024-01-22" } },
        { id: 8, nombre: "San Valentín", icon: "Heart", fechas: { current: "2026-02-14", past1: "2025-02-14", past2: "2024-02-14" } },
        { id: 9, nombre: "Día del Padre", icon: "Star", fechas: { current: "2026-03-19", past1: "2025-03-19", past2: "2024-03-19" } },
        { id: 10, nombre: "Día del Trabajo", icon: "Map", fechas: { current: "2026-05-01", past1: "2025-05-01", past2: "2024-05-01" } },
        { id: 11, nombre: "Día de la Madre", icon: "Heart", fechas: { current: "2026-05-27", past1: "2025-05-27", past2: "2024-05-27" } },
        { id: 12, nombre: "Año Nuevo Andino", icon: "Flame", fechas: { current: "2026-06-21", past1: "2025-06-21", past2: "2024-06-21" } },
        { id: 13, nombre: "Día de la Patria", icon: "Flag", fechas: { current: "2026-08-06", past1: "2025-08-06", past2: "2024-08-06" } },
        { id: 14, nombre: "Todos Santos", icon: "Ghost", fechas: { current: "2026-11-02", past1: "2025-11-02", past2: "2024-11-02" } },
        { id: 15, nombre: "Navidad", icon: "Gift", fechas: { current: "2026-12-25", past1: "2025-12-25", past2: "2024-12-25" } }
    ]);

    const [selectedHolidayId, setSelectedHolidayId] = useState<number>(1);
    const [sucursal, setSucursal] = useState<string>('Heroinas');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useOnClickOutside(dropdownRef as any, () => setIsDropdownOpen(false));

    // Estados para la copia local del Modal
    const [tempFestividades, setTempFestividades] = useState<Festividad[]>([]);

    const [chartData, setChartData] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);

    // Colores estáticos definidos por la nueva Arquitectura V2
    const colors = {
        real: "#10b981",   // Verde esmeralda vibrante
        anio1: "#64748b",  // Azul pizarra neutro
        anio2: "#cbd5e1"   // Gris claro
    };

    const selectedHoliday = festividades.find(f => f.id === selectedHolidayId) || festividades[0];

    const SUCURSALES = [
        { value: '', label: 'Todas las Sucursales' },
        { value: 'Heroinas', label: 'Heroínas' },
        { value: 'Recoleta', label: 'Recoleta' },
        { value: 'Calacoto', label: 'Calacoto' },
    ];

    const fetchData = useCallback(async (holiday: Festividad, suc: string) => {
        setIsLoading(true);
        setIsError(false);
        try {
            const res = await getHourlyMultiyear(holiday.fechas.current, suc || undefined, holiday.fechas.past1, holiday.fechas.past2);
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
        if (isExpanded && selectedHoliday) {
            fetchData(selectedHoliday, sucursal);
        }
    }, [isExpanded, selectedHoliday, sucursal, fetchData]);

    // Modal Actions
    const openSettings = () => {
        setTempFestividades(JSON.parse(JSON.stringify(festividades)));
        setIsSettingsOpen(true);
    };

    const saveSettings = () => {
        setFestividades(tempFestividades);
        setIsSettingsOpen(false);
        // Si la festividad seleccionada fue borrada, seleccionar la primera
        if (!tempFestividades.find(f => f.id === selectedHolidayId) && tempFestividades.length > 0) {
            setSelectedHolidayId(tempFestividades[0].id);
        }
    };

    const addFestividad = () => {
        const newId = tempFestividades.length > 0 ? Math.max(...tempFestividades.map(f => f.id)) + 1 : 1;
        setTempFestividades([...tempFestividades, {
            id: newId,
            nombre: "Nueva Festividad",
            icon: "Calendar",
            fechas: { current: "2026-01-01", past1: "2025-01-01", past2: "2024-01-01" }
        }]);
    };

    const removeFestividad = (id: number) => {
        setTempFestividades(tempFestividades.filter(f => f.id !== id));
    };

    const updateFestividad = (id: number, field: string, value: string) => {
        setTempFestividades(tempFestividades.map(f => {
            if (f.id === id) {
                if (field.startsWith('fechas.')) {
                    const dateField = field.split('.')[1];
                    return { ...f, fechas: { ...f.fechas, [dateField]: value } };
                }
                return { ...f, [field]: value };
            }
            return f;
        }));
    };

    // Cálculos estadísticos para las tarjetas (Priorizando métricas del backend V2)
    const totalReal = meta?.total_real ?? chartData.reduce((sum, h) => sum + h.real, 0);
    const totalAnio1 = meta?.total_a1 ?? chartData.reduce((sum, h) => sum + h.anio1, 0);
    const totalAnio2 = meta?.total_a2 ?? chartData.reduce((sum, h) => sum + h.anio2, 0);

    const averageHourSale = meta?.venta_promedio_horaria ?? (chartData.length > 0 ? totalReal / chartData.length : 0);
    const maxHourSale = meta?.venta_pico_maxima ?? chartData.reduce((max, h) => h.real > max ? h.real : max, 0);
    const peakHour = meta?.hora_pico ?? (chartData.find(h => h.real === maxHourSale)?.hora || "—");
    const liquidMargin = meta?.margen_liquido ?? (totalReal * 0.15); // Si no hay backend usa fallback
    const desempenoYoy = meta?.desempeno_yoy ?? (((totalReal - totalAnio1) / totalAnio1) * 100 || 0);

    const SelectedIcon = ICON_MAP[selectedHoliday?.icon] || Calendar;

    return (
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-sm border border-gray-100 flex flex-col transition-all duration-300 relative">
            
            {/* Header del Acordeón Desplegable */}
            <div 
                onClick={() => !isSettingsOpen && setIsExpanded(!isExpanded)}
                className={`p-6 sm:p-8 flex items-center justify-between cursor-pointer select-none rounded-[2rem] hover:bg-slate-50/50 transition-colors ${isExpanded ? 'border-b border-gray-100' : ''}`}
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm">
                        <Sparkles size={22} className={isExpanded ? 'animate-pulse' : ''} />
                    </div>
                    <div>
                        <h3 className="text-lg sm:text-xl font-black text-gray-900 flex items-center gap-2">
                            Comparativa de Fechas Festivas
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-full shrink-0">
                                Especial
                            </span>
                            {/* Botón de Configuración Discreto */}
                            {isExpanded && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); openSettings(); }}
                                    className="ml-2 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                    title="Configurar Fechas"
                                >
                                    <Settings size={20} />
                                </button>
                            )}
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

            {/* Contenido Desplegable */}
            {isExpanded && (
                <div className="p-8 animate-in fade-in slide-in-from-top-4 duration-300 space-y-8">
                    
                    {/* Controls Row Minimalista */}
                    <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
                        <div className="text-sm font-bold text-gray-500 flex items-center gap-1.5">
                            <Info size={14} className="text-indigo-400" />
                            Selecciona una festividad para visualizar su comparativa histórica
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                            
                            {/* Custom Dropdown de Festividades */}
                            <div className="relative group flex-1 sm:flex-none" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="w-full min-w-[200px] flex items-center justify-between gap-3 pl-4 pr-3 py-2.5 bg-white border border-gray-200 hover:border-indigo-300 focus:ring-2 focus:ring-indigo-50 rounded-xl font-bold text-sm text-gray-800 shadow-sm transition-all"
                                >
                                    <div className="flex items-center gap-2">
                                        <SelectedIcon size={16} className="text-indigo-500" />
                                        {selectedHoliday?.nombre || 'Seleccionar...'}
                                    </div>
                                    <ChevronDown size={16} className="text-gray-400" />
                                </button>
                                
                                {isDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-100 shadow-xl rounded-2xl z-50 py-2 max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                                        {festividades.map(f => {
                                            const Icon = ICON_MAP[f.icon] || Calendar;
                                            return (
                                                <button
                                                    key={f.id}
                                                    onClick={() => {
                                                        setSelectedHolidayId(f.id);
                                                        setIsDropdownOpen(false);
                                                    }}
                                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors ${selectedHolidayId === f.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                                                >
                                                    <Icon size={16} className={selectedHolidayId === f.id ? 'text-indigo-500' : 'text-gray-400'} />
                                                    {f.nombre}
                                                    {selectedHolidayId === f.id && <Check size={14} className="ml-auto text-indigo-500" />}
                                                </button>
                                            )
                                        })}
                                        {festividades.length === 0 && (
                                            <div className="px-4 py-3 text-sm text-gray-500 text-center">No hay festividades. Configúralas arriba.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Selector de Sucursal */}
                            <div className="relative group flex-1 sm:flex-none">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Store size={15} className="text-indigo-400" />
                                </div>
                                <select
                                    value={sucursal}
                                    onChange={(e) => setSucursal(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 hover:border-indigo-300 focus:ring-2 focus:ring-indigo-50 rounded-xl font-bold text-sm text-gray-800 shadow-sm outline-none transition-all cursor-pointer appearance-none"
                                >
                                    {SUCURSALES.map(s => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                    <ChevronDown size={14} className="text-gray-400" />
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
                            
                            {/* CAPA SUPERIOR: 3 Tarjetas de Métricas con Sparklines */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                
                                {/* Card 1: Ventas Año Seleccionado */}
                                <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                                            Ventas Actuales
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
                                    <Sparkline data={chartData} dataKey="real" stroke={colors.real} />
                                </div>

                                {/* Card 2: Ventas Año -1 */}
                                <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                                            Ventas Históricas (-1 Año)
                                        </span>
                                        <h2 className="text-2xl font-black text-slate-700 tracking-tight">
                                            {formatBs(totalAnio1)}
                                        </h2>
                                    </div>
                                    <Sparkline data={chartData} dataKey="anio1" stroke={colors.anio1} />
                                </div>

                                {/* Card 3: Ventas Año -2 */}
                                <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                                            Ventas Históricas (-2 Años)
                                        </span>
                                        <h2 className="text-2xl font-black text-slate-700 tracking-tight">
                                            {formatBs(totalAnio2)}
                                        </h2>
                                    </div>
                                    <Sparkline data={chartData} dataKey="anio2" stroke={colors.anio2} />
                                </div>
                            </div>

                            {/* CAPA INFERIOR: Gráfico Principal (Left) + Acciones y Métricas (Right) */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                
                                {/* Columna Izquierda: LineChart de Ventas Horarias */}
                                <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 flex flex-col shadow-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="text-base font-black text-indigo-950 flex items-center gap-2">
                                            <Activity size={16} className="text-indigo-500" />
                                            Flujo de Ventas Horario Comparativo
                                        </h4>
                                        {meta && (
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.real }}></span>
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">Actual</span>
                                                <span className="w-2.5 h-2.5 rounded-full ml-2" style={{ backgroundColor: colors.anio1 }}></span>
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">-1 Año</span>
                                                <span className="w-2.5 h-2.5 rounded-full ml-2" style={{ backgroundColor: colors.anio2 }}></span>
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">-2 Años</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="h-[350px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorRealMain" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={colors.real} stopOpacity={0.4}/>
                                                        <stop offset="95%" stopColor={colors.real} stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
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
                                                <Tooltip content={<CustomTooltip meta={meta} colors={colors} />} />
                                                
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="prediccion_ia" 
                                                    stroke="#a855f7" 
                                                    strokeWidth={2} 
                                                    strokeDasharray="5 5"
                                                    dot={false}
                                                    connectNulls 
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="anio2" 
                                                    stroke={colors.anio2} 
                                                    strokeWidth={2} 
                                                    strokeDasharray="5 5"
                                                    dot={false}
                                                    connectNulls 
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="anio1" 
                                                    stroke={colors.anio1} 
                                                    strokeWidth={2.5} 
                                                    dot={false}
                                                    connectNulls 
                                                />
                                                <Area 
                                                    type="monotone" 
                                                    dataKey="real" 
                                                    stroke={colors.real} 
                                                    fillOpacity={1}
                                                    fill="url(#colorRealMain)"
                                                    strokeWidth={4} 
                                                    activeDot={{ r: 8, stroke: '#fff', strokeWidth: 3 }}
                                                    connectNulls 
                                                />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Columna Derecha: Métricas y KPIs de la Festividad */}
                                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between pb-4 border-b border-gray-50 mb-4">
                                            <h4 className="text-base font-black text-indigo-950 flex items-center gap-2">
                                                <SelectedIcon size={16} className="text-indigo-500" />
                                                Métricas {selectedHoliday?.nombre}
                                            </h4>
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
                                                    Hora Pico
                                                </span>
                                                <span className="text-sm font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                                                    {peakHour}
                                                </span>
                                            </div>

                                            {/* Margen Líquido */}
                                            <div className="flex justify-between items-center py-2.5 border-b border-gray-50/50 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                                                <span className="text-xs font-semibold text-gray-500 flex items-center gap-2">
                                                    <Sparkles size={13} className="text-amber-500" />
                                                    Margen Líquido
                                                </span>
                                                <span className="text-sm font-black text-amber-700">
                                                    {formatBs(liquidMargin)}
                                                </span>
                                            </div>

                                            {/* Desempeño YoY */}
                                            <div className="flex justify-between items-center py-2.5 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                                                <span className="text-xs font-semibold text-gray-500 flex items-center gap-2">
                                                    <TrendingUp size={13} className="text-sky-500" />
                                                    Desempeño YoY
                                                </span>
                                                <span className={`text-sm font-black flex items-center gap-0.5 ${desempenoYoy > 0 ? 'text-emerald-600' : desempenoYoy < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                    {desempenoYoy > 0 ? '+' : ''}{desempenoYoy.toFixed(1)}%
                                                </span>
                                            </div>

                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-50 border border-gray-100 p-3 rounded-2xl text-[10px] font-bold text-gray-500 mt-6 leading-relaxed flex items-start gap-2">
                                        <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                                        <span>Las fechas exactas de comparación para esta festividad pueden ajustarse en la configuración global del panel superior.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL DE CONFIGURACIÓN (Pop-up) */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <Settings size={20} className="text-indigo-500" />
                                Configuración de Fechas Festivas
                            </h2>
                            <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body (Scrollable Table) */}
                        <div className="flex-1 overflow-y-auto p-6 bg-white">
                            <div className="min-w-full inline-block align-middle">
                                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Festividad</th>
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Ícono</th>
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-black text-indigo-500 uppercase tracking-wider">Fecha Actual</th>
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-black text-amber-500 uppercase tracking-wider">Fecha -1 Año</th>
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-black text-rose-500 uppercase tracking-wider">Fecha -2 Años</th>
                                                <th scope="col" className="px-4 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-wider">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {tempFestividades.map((f) => {
                                                const IconRow = ICON_MAP[f.icon] || Calendar;
                                                return (
                                                    <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <input 
                                                                type="text" 
                                                                value={f.nombre}
                                                                onChange={(e) => updateFestividad(f.id, 'nombre', e.target.value)}
                                                                className="w-full text-sm font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none px-1 py-1"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <IconRow size={16} className="text-gray-500" />
                                                                <select 
                                                                    value={f.icon}
                                                                    onChange={(e) => updateFestividad(f.id, 'icon', e.target.value)}
                                                                    className="text-xs font-semibold text-gray-600 bg-transparent outline-none cursor-pointer max-w-[80px]"
                                                                >
                                                                    {Object.keys(ICON_MAP).map(key => (
                                                                        <option key={key} value={key}>{key}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <input 
                                                                type="date" 
                                                                value={f.fechas.current}
                                                                onChange={(e) => updateFestividad(f.id, 'fechas.current', e.target.value)}
                                                                className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-transparent hover:border-indigo-200 focus:ring-2 focus:ring-indigo-100 rounded-lg px-2 py-1 outline-none cursor-text"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <input 
                                                                type="date" 
                                                                value={f.fechas.past1}
                                                                onChange={(e) => updateFestividad(f.id, 'fechas.past1', e.target.value)}
                                                                className="text-xs font-bold text-amber-700 bg-amber-50 border border-transparent hover:border-amber-200 focus:ring-2 focus:ring-amber-100 rounded-lg px-2 py-1 outline-none cursor-text"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <input 
                                                                type="date" 
                                                                value={f.fechas.past2}
                                                                onChange={(e) => updateFestividad(f.id, 'fechas.past2', e.target.value)}
                                                                className="text-xs font-bold text-rose-700 bg-rose-50 border border-transparent hover:border-rose-200 focus:ring-2 focus:ring-rose-100 rounded-lg px-2 py-1 outline-none cursor-text"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                                            <button 
                                                                onClick={() => removeFestividad(f.id)}
                                                                className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                                title="Eliminar festividad"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            {/* Botón Añadir */}
                            <div className="mt-4 flex justify-center">
                                <button 
                                    onClick={addFestividad}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-gray-200 border-dashed rounded-xl text-sm font-bold text-gray-600 hover:text-indigo-600 transition-colors"
                                >
                                    <Plus size={16} />
                                    Añadir nueva festividad
                                </button>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
                            <button 
                                onClick={() => setIsSettingsOpen(false)}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={saveSettings}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all active:scale-95"
                            >
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
