import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
import { getHourlyMultiyear } from '../api/api';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip
} from 'recharts';
import { Activity, Calendar, Loader2, TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight, Store } from 'lucide-react';
import { useOnClickOutside } from 'usehooks-ts';

// ───────────────────────────────────────────────────────────────────────────────
// Helpers & Festividades
// ───────────────────────────────────────────────────────────────────────────────
const formatBs = (n: number) =>
    `Bs. ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatReadableDate = (dateStr: string) => {
    if (!dateStr || dateStr === "—") return dateStr;
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    return dateObj.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
};

const getTodayDateString = () => {
    const d = new Date();
    // Ajustar a zona horaria local
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const getEasterSunday = (year: number): Date => {
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

const getHolidayInfo = (d: Date) => {
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();

    if (day === 14 && month === 2) return { name: "San Valentín", bg: "bg-red-50 text-red-600 hover:bg-red-100", dot: "bg-red-400" };
    if (day === 19 && month === 3) return { name: "Día del Padre", bg: "bg-blue-50 text-blue-600 hover:bg-blue-100", dot: "bg-blue-400" };
    if (day === 27 && month === 5) return { name: "Día de la Madre", bg: "bg-pink-50 text-pink-600 hover:bg-pink-100", dot: "bg-pink-400" };
    if (day === 1 && month === 5) return { name: "Día del Trabajo", bg: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100", dot: "bg-emerald-400" };
    if (day === 6 && month === 8) return { name: "Día de la Patria", bg: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100", dot: "bg-emerald-400" };
    if (day === 25 && month === 12) return { name: "Navidad", bg: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100", dot: "bg-emerald-400" };
    if (day === 1 && month === 1) return { name: "Año Nuevo", bg: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100", dot: "bg-emerald-400" };

    const easter = getEasterSunday(year);
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);

    if (day === goodFriday.getDate() && month === (goodFriday.getMonth() + 1)) {
        return { name: "Viernes Santo", bg: "bg-amber-50 text-amber-700 hover:bg-amber-100", dot: "bg-amber-400" };
    }
    if (day === easter.getDate() && month === (easter.getMonth() + 1)) {
        return { name: "Pascua", bg: "bg-amber-50 text-amber-700 hover:bg-amber-100", dot: "bg-amber-400" };
    }

    return null;
};

// ───────────────────────────────────────────────────────────────────────────────
// Custom Calendar Picker
// ───────────────────────────────────────────────────────────────────────────────
const CustomDatePicker = ({ fechaRef, setFechaRef }: { fechaRef: string, setFechaRef: (f: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useOnClickOutside(ref as RefObject<HTMLElement>, () => setIsOpen(false));

    // Fecha mostrada en el mes actual del calendario
    const [currentMonth, setCurrentMonth] = useState(() => {
        const [y, m] = fechaRef.split('-');
        return new Date(parseInt(y), parseInt(m) - 1, 1);
    });

    // Actualizar vista del mes cuando cambia la fecha externamente (ej. botón Hoy)
    useEffect(() => {
        if (!isOpen) {
            const [y, m] = fechaRef.split('-');
            setCurrentMonth(new Date(parseInt(y), parseInt(m) - 1, 1));
        }
    }, [fechaRef, isOpen]);

    const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    const selectedDateObj = new Date(fechaRef + 'T00:00:00');
    const selectedHoliday = getHolidayInfo(selectedDateObj);
    const isTodaySelected = fechaRef === getTodayDateString();

    const generateDays = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        // Fill empty days from previous month
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const days = generateDays();
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    return (
        <div className="relative flex items-center gap-2" ref={ref}>
            <div 
                className={`flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border transition-colors rounded-2xl px-4 py-2.5 shadow-inner cursor-pointer ${isOpen ? 'border-indigo-400 ring-2 ring-indigo-50' : 'border-gray-200'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Calendar size={16} className={selectedHoliday ? selectedHoliday.bg.split(' ')[1] : "text-indigo-400 shrink-0"} />
                <span className={`text-sm font-bold ${selectedHoliday ? selectedHoliday.bg.split(' ')[1] : 'text-gray-700'}`}>
                    {selectedDateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {selectedHoliday && (
                    <span className={`ml-1 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${selectedHoliday.bg.split(' ')[0]} ${selectedHoliday.bg.split(' ')[1]}`}>
                        {selectedHoliday.name}
                    </span>
                )}
            </div>

            <button
                onClick={() => setFechaRef(getTodayDateString())}
                className={`text-sm font-bold px-4 py-2.5 rounded-2xl border transition-colors ${
                    isTodaySelected 
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
            >
                Hoy
            </button>

            {isOpen && (
                <div className="absolute top-14 left-0 z-50 bg-white/90 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-3xl p-4 w-[320px] animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={handlePrevMonth} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                        <span className="font-black text-gray-800 text-sm">
                            {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </span>
                        <button onClick={handleNextMonth} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(day => (
                            <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((date, i) => {
                            if (!date) return <div key={i} className="h-8"></div>;
                            
                            const dateStr = [
                                date.getFullYear(),
                                String(date.getMonth() + 1).padStart(2, '0'),
                                String(date.getDate()).padStart(2, '0')
                            ].join('-');
                            
                            const isSelected = dateStr === fechaRef;
                            const isToday = dateStr === getTodayDateString();
                            const holiday = getHolidayInfo(date);
                            const isFuture = date.getTime() > new Date().getTime();

                            return (
                                <button
                                    key={i}
                                    disabled={isFuture}
                                    onClick={() => {
                                        setFechaRef(dateStr);
                                        setIsOpen(false);
                                    }}
                                    className={`relative h-10 w-full rounded-xl flex items-center justify-center text-sm font-semibold transition-all
                                        ${isFuture ? 'text-gray-300 cursor-not-allowed' : 'hover:scale-105 cursor-pointer'}
                                        ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 
                                          holiday ? holiday.bg : 
                                          isToday ? 'bg-gray-100 text-indigo-600' : 'text-gray-700 hover:bg-gray-100'
                                        }
                                    `}
                                >
                                    {date.getDate()}
                                    {holiday && !isSelected && (
                                        <div className={`absolute bottom-1 w-1 h-1 rounded-full ${holiday.dot}`}></div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────────
// Tooltip personalizado
// ───────────────────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, meta }: any) => {
    if (!active || !payload?.length) return null;

    const real   = payload.find((p: any) => p.dataKey === 'real')?.value ?? null;
    const anio1  = payload.find((p: any) => p.dataKey === 'anio1')?.value ?? null;
    const anio2  = payload.find((p: any) => p.dataKey === 'anio2')?.value ?? null;
    const pred   = payload.find((p: any) => p.dataKey === 'prediccion')?.value ?? null;

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
                            <span className="text-xs font-bold text-gray-600">{meta?.real_label || 'Real'}</span>
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
                {pred !== null && pred > 0 && (
                    <div className="flex items-center justify-between gap-4 mt-2 pt-2 border-t border-dashed border-emerald-200">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                            <span className="text-xs font-bold text-emerald-600">Predicción IA</span>
                        </div>
                        <span className="font-black text-emerald-700 text-sm">{formatBs(pred)}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────────
// Componente principal
// ───────────────────────────────────────────────────────────────────────────────
export default function HourlyMultiyearChart() {
    const [fechaRef, setFechaRef] = useState<string>(getTodayDateString());
    const [sucursal, setSucursal] = useState<string>('Heroinas'); // Por defecto: Heroinas
    const [chartData, setChartData] = useState<any[]>([]);
    const [meta, setMeta] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);

    const SUCURSALES = [
        { value: '', label: 'Todas las Sucursales' },
        { value: 'Heroinas', label: 'Heroínas' },
        { value: 'Recoleta', label: 'Recoleta' },
        { value: 'Calacoto', label: 'Calacoto' },
    ];

    const fetchData = useCallback(async (fecha: string, suc: string) => {
        setIsLoading(true);
        setIsError(false);
        try {
            const res = await getHourlyMultiyear(fecha, suc || undefined);
            setChartData(res.horas || []);
            setMeta(res.meta || null);
        } catch (e) {
            console.error('HourlyMultiyear error:', e);
            setIsError(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(fechaRef, sucursal);
    }, [fechaRef, sucursal, fetchData]);

    const hasPrediction = chartData.some((d) => d.prediccion !== undefined && d.prediccion > 0);

    // Calcular estado general del día (Verde, Amarillo, Rojo)
    let insightColor = 'bg-gray-50 text-gray-800 border-gray-100';
    let insightIcon = <Activity size={18} className="shrink-0" />;
    
    if (meta && meta.variacion_vs_anio1 !== null) {
        if (meta.variacion_vs_anio1 > 0) {
            insightColor = 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-100/50';
            insightIcon = <TrendingUp size={20} className="shrink-0 text-emerald-600" />;
        } else if (meta.variacion_vs_anio1 < -5) {
            insightColor = 'bg-red-50 text-red-800 border-red-200 shadow-red-100/50';
            insightIcon = <TrendingDown size={20} className="shrink-0 text-red-600" />;
        } else {
            insightColor = 'bg-amber-50 text-amber-800 border-amber-200 shadow-amber-100/50';
            insightIcon = <Minus size={20} className="shrink-0 text-amber-600" />;
        }
    }

    return (
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-sm border border-gray-100 flex flex-col h-full">

            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
                <div>
                    <h3 className="text-xl font-black text-gray-900 flex items-center gap-2 mb-2">
                        <Activity className="text-indigo-600" />
                        Comparativa Horaria Multi-Año
                    </h3>
                    <p className="text-gray-500 text-sm flex flex-wrap items-center gap-2">
                        <span>Eje temporal forzado <strong>08:00 – 20:00</strong>.</span>
                        <span className="text-gray-300">•</span>
                        {meta ? (
                            <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                                {meta.holiday_name ? `Comparando festividad: ${meta.holiday_name} ` : ''}
                                ({formatReadableDate(meta.real_label)} vs {formatReadableDate(meta.anio1_label)} vs {formatReadableDate(meta.anio2_label)})
                            </span>
                        ) : (
                            <span>Año seleccionado vs −364 días vs −728 días.</span>
                        )}
                        {meta?.es_hoy && (
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 font-black flex items-center gap-1 text-xs">
                                <Activity size={10} /> + Predicción IA activa
                            </span>
                        )}
                    </p>
                </div>

                {/* Controls Row: Branch Selector + Date Picker */}
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 shrink-0">

                    {/* Selector de Sucursal */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Store size={15} className="text-indigo-400" />
                        </div>
                        <select
                            value={sucursal}
                            onChange={(e) => setSucursal(e.target.value)}
                            className="pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 rounded-2xl font-bold text-sm text-gray-800 shadow-inner outline-none transition-all cursor-pointer appearance-none"
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

                    <CustomDatePicker fechaRef={fechaRef} setFechaRef={setFechaRef} />
                </div>
            </div>

            {/* Mini Resumen del Día */}
            {meta && !isLoading && meta.variacion_vs_anio1 !== null && (
                <div className={`mb-8 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border shadow-sm transition-all duration-500 ${insightColor}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/60 rounded-xl shadow-sm">
                            {insightIcon}
                        </div>
                        <div>
                            <p className="text-sm font-bold opacity-80 mb-0.5">Rendimiento General del Día</p>
                            <h4 className="text-lg font-black tracking-tight">
                                {meta.variacion_vs_anio1 > 0 ? 'Superando objetivos' : meta.variacion_vs_anio1 < -5 ? 'Por debajo del año pasado' : 'Manteniendo el nivel'}
                            </h4>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 bg-white/60 px-4 py-2 rounded-xl">
                        <div className="text-right">
                            <p className="text-xs font-bold opacity-70 mb-0.5">Vs Año Pasado</p>
                            <p className="text-base font-black">
                                {meta.variacion_vs_anio1 > 0 ? '+' : ''}{meta.variacion_vs_anio1}%
                            </p>
                        </div>
                        {meta.variacion_vs_anio2 !== null && (
                            <>
                                <div className="w-px h-8 bg-black/10"></div>
                                <div className="text-right">
                                    <p className="text-xs font-bold opacity-70 mb-0.5">Vs Hace 2 Años</p>
                                    <p className="text-base font-black">
                                        {meta.variacion_vs_anio2 > 0 ? '+' : ''}{meta.variacion_vs_anio2}%
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Meta Resumen (Leyendas) */}
            {meta && !isLoading && (
                <div className="flex flex-wrap items-center gap-6 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full bg-indigo-600 shadow-md shadow-indigo-200"></div>
                        <span className="font-black text-gray-800">{formatReadableDate(meta.real_label)}</span>
                        <span className="text-gray-400 text-xs font-semibold">(Real)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm opacity-80 hover:opacity-100 transition-opacity">
                        <div className="w-3 h-3 rounded-full bg-amber-500 shadow-md shadow-amber-200"></div>
                        <span className="font-bold text-gray-600">{formatReadableDate(meta.anio1_label)}</span>
                        <span className="text-gray-400 text-xs font-semibold">({meta.holiday_name ? 'Festividad Año -1' : '−364d'})</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm opacity-80 hover:opacity-100 transition-opacity">
                        <div className="w-3 h-3 rounded-full bg-rose-400 shadow-md shadow-rose-200"></div>
                        <span className="font-bold text-gray-600">{formatReadableDate(meta.anio2_label)}</span>
                        <span className="text-gray-400 text-xs font-semibold">({meta.holiday_name ? 'Festividad Año -2' : '−728d'})</span>
                    </div>
                    {hasPrediction && (
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-4 h-0 border-t-2 border-dashed border-emerald-400"></div>
                            <span className="font-bold text-emerald-600">Predicción IA (+10%)</span>
                        </div>
                    )}
                </div>
            )}

            {/* Gráfico */}
            <div className="h-[500px] w-full mt-8">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-indigo-500">
                        <Loader2 size={40} className="animate-spin" />
                        <p className="text-sm font-black tracking-widest uppercase animate-pulse">Analizando tendencias...</p>
                    </div>
                ) : isError ? (
                    <div className="h-full flex items-center justify-center text-red-400 text-sm font-bold bg-red-50 rounded-2xl border border-red-100">
                        Error cargando datos. Verifica la conexión con el backend.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 40, bottom: 10 }}>
                            <CartesianGrid
                                strokeDasharray="4 4"
                                stroke="#f1f5f9"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="hora"
                                tick={{ fontSize: 12, fill: '#64748b', fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                                dy={10}
                            />
                            <YAxis
                                tickFormatter={(v) => `Bs ${v.toLocaleString()}`}
                                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                axisLine={false}
                                tickLine={false}
                                dx={-4}
                                width={100}
                            />
                            <Tooltip
                                content={<CustomTooltip meta={meta} />}
                                cursor={{ stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '4 4' }}
                            />

                            {/* Línea Año -2 */}
                            <Line
                                type="monotone"
                                dataKey="anio2"
                                stroke="#fb7185"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                                connectNulls
                            />

                            {/* Línea Año -1 */}
                            <Line
                                type="monotone"
                                dataKey="anio1"
                                stroke="#f59e0b"
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                                connectNulls
                            />

                            {/* Línea Real (encima de todas) */}
                            <Line
                                type="monotone"
                                dataKey="real"
                                stroke="#6366f1"
                                strokeWidth={4}
                                dot={false}
                                activeDot={{ r: 8, stroke: '#fff', strokeWidth: 3, fill: '#6366f1' }}
                                connectNulls
                            />

                            {/* Predicción IA */}
                            {hasPrediction && (
                                <Line
                                    type="monotone"
                                    dataKey="prediccion"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    strokeDasharray="6 6"
                                    dot={false}
                                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#10b981' }}
                                    connectNulls
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
