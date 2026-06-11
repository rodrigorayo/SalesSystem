import { useState, useEffect, useCallback } from 'react';
import { getSalesByBranch, getTopProducts } from '../api/api';
import {
    ResponsiveContainer, Tooltip as RechartsTooltip, PieChart, Pie, Cell,
} from 'recharts';
import { MapPin, Loader2, AlertTriangle, Inbox } from 'lucide-react';

const PRODUCT_COLORS = [
    '#4F46E5', // Indigo
    '#06B6D4', // Cyan
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EC4899', // Pink
];

const BADGE_BG_COLORS = [
    'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-50/10 dark:text-indigo-400 dark:border-indigo-900/30',
    'bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-50/10 dark:text-cyan-400 dark:border-cyan-900/30',
    'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-50/10 dark:text-emerald-400 dark:border-emerald-900/30',
    'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-50/10 dark:text-amber-400 dark:border-amber-900/30',
    'bg-pink-50 text-pink-700 border-pink-100 dark:bg-pink-50/10 dark:text-pink-400 dark:border-pink-900/30',
];

const BRANCH_THEMES: Record<string, { bar: string, text: string, bg: string, ring: string }> = {
    'Heroínas': { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-100' },
    'Calacoto': { bar: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50', ring: 'ring-indigo-100' },
    'Recoleta': { bar: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', ring: 'ring-rose-100' }
};

const getBranchTheme = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('heroinas') || n.includes('heroína')) return BRANCH_THEMES['Heroínas'];
    if (n.includes('calacoto')) return BRANCH_THEMES['Calacoto'];
    if (n.includes('recoleta')) return BRANCH_THEMES['Recoleta'];
    return { bar: 'bg-slate-500', text: 'text-slate-700', bg: 'bg-slate-50', ring: 'ring-slate-100' };
};

const formatBs = (value: number) => {
    const num = typeof value === 'number' ? value : 0;
    return `Bs. ${num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
};

export default function RegionalAndProductMix() {
    // ─────────────────────────────────────────────────────────────────
    // Estados y Tiempo
    // ─────────────────────────────────────────────────────────────────
    const [mode, setMode] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('today');
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());

    const [dates, setDates] = useState({ start: '', end: '' });

    // Calcula start_date y end_date según el modo seleccionado
    useEffect(() => {
        let start = new Date();
        let end = new Date();
        
        // Ajuste de timezone local para fechas exactas
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        if (mode === 'today') {
            // Ya es hoy
        } else if (mode === 'week') {
            start.setDate(end.getDate() - 6);
        } else if (mode === 'month') {
            const [y, m] = selectedMonth.split('-');
            start = new Date(parseInt(y), parseInt(m) - 1, 1);
            end = new Date(parseInt(y), parseInt(m), 0);
            end.setHours(23, 59, 59, 999);
        } else if (mode === 'year') {
            const y = parseInt(selectedYear);
            start = new Date(y, 0, 1);
            end = new Date(y, 11, 31);
            end.setHours(23, 59, 59, 999);
        }

        setDates({
            start: start.toISOString(),
            end: end.toISOString()
        });
    }, [mode, selectedMonth, selectedYear]);

    // ─────────────────────────────────────────────────────────────────
    // Data Fetching
    // ─────────────────────────────────────────────────────────────────
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [branchData, setBranchData] = useState<any[]>([]);
    const [topData, setTopData] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setIsError(false);
        try {
            const time_range = (mode === 'today' || mode === 'week' || mode === 'month' || mode === 'year') ? mode : undefined;
            
            // Si el modo es 'today', delegamos la fecha entera al backend en Python
            const isToday = mode === 'today';
            const startParam = isToday ? undefined : dates.start;
            const endParam = isToday ? undefined : dates.end;

            const results = await Promise.allSettled([
                getSalesByBranch(startParam, endParam, time_range),
                getTopProducts(startParam, endParam, time_range)
            ]);
            
            if (results[0].status === 'fulfilled') {
                setBranchData(results[0].value.sales_by_branch || []);
            } else {
                console.error("Error fetching sales by branch:", results[0].reason);
                setBranchData([]);
            }
            
            if (results[1].status === 'fulfilled') {
                setTopData(results[1].value.top_categories || []);
            } else {
                console.error("Error fetching top products:", results[1].reason);
                setTopData([]);
            }

            if (results[0].status === 'rejected' && results[1].status === 'rejected') {
                setIsError(true);
            }
        } catch (e) {
            console.error("Error fetching regional/top mix:", e);
            setIsError(true);
        } finally {
            setIsLoading(false);
        }
    }, [dates, mode]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const maxVentas = branchData.length > 0 ? Math.max(...branchData.map(b => b.ventas), 1) : 1;
    const totalBranchSales = branchData.reduce((acc, curr) => acc + (curr.ventas || 0), 0);
    const isEmpty = totalBranchSales === 0;

    // ─────────────────────────────────────────────────────────────────
    // Formateadores de fecha para la cabecera dinámica
    // ─────────────────────────────────────────────────────────────────
    const formatLocalDateInSpanish = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const day = date.getDate();
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();
        return `${day} de ${month} de ${year}`;
    };

    const formatWeekRange = (startStr: string, endStr: string) => {
        if (!startStr || !endStr) return '';
        const startDate = new Date(startStr);
        const endDate = new Date(endStr);
        
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        
        const startDay = startDate.getDate();
        const startMonth = monthNames[startDate.getMonth()];
        const startYear = startDate.getFullYear();
        
        const endDay = endDate.getDate();
        const endMonth = monthNames[endDate.getMonth()];
        const endYear = endDate.getFullYear();
        
        if (startYear !== endYear) {
            return `Semana: ${startDay} de ${startMonth} de ${startYear} al ${endDay} de ${endMonth} de ${endYear}`;
        } else if (startMonth !== endMonth) {
            return `Semana: ${startDay} de ${startMonth} al ${endDay} de ${endMonth} de ${endYear}`;
        } else {
            return `Semana: ${startDay} al ${endDay} de ${endMonth} de ${endYear}`;
        }
    };

    const formatMonthInSpanish = (selectedMonthStr: string) => {
        if (!selectedMonthStr) return '';
        const [y, m] = selectedMonthStr.split('-');
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const monthName = monthNames[parseInt(m) - 1];
        return `Mes: ${monthName} de ${y}`;
    };

    const getPeriodText = () => {
        if (mode === 'today') {
            return `Mostrando datos para: ${formatLocalDateInSpanish(dates.start)}`;
        } else if (mode === 'week') {
            return formatWeekRange(dates.start, dates.end);
        } else if (mode === 'month') {
            return formatMonthInSpanish(selectedMonth);
        } else if (mode === 'year') {
            return `Año: ${selectedYear}`;
        }
        return '';
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header de la sección y Filtro independiente */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                        <MapPin className="text-rose-500" />
                        Análisis Regional y de Producto
                    </h3>
                    <p className="text-xs text-indigo-600 font-extrabold tracking-wide uppercase mt-1">
                        {getPeriodText()}
                    </p>
                </div>
                
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <button onClick={() => setMode('today')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${mode==='today'?'bg-indigo-600 text-white':'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                        Hoy
                    </button>
                    <button onClick={() => setMode('week')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${mode==='week'?'bg-indigo-600 text-white':'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                        Semana Actual
                    </button>
                    
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors ${mode==='month'?'border-indigo-500 bg-indigo-50/30':'border-gray-200 bg-white hover:bg-gray-50'}`}>
                        <label className="flex items-center gap-2 cursor-pointer" onClick={() => setMode('month')}>
                            <input type="radio" checked={mode==='month'} readOnly className="text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"/>
                            <span className="text-sm font-bold text-gray-700">Mes</span>
                        </label>
                        <input type="month" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setMode('month'); }} className="bg-transparent text-sm outline-none font-semibold text-indigo-900 cursor-pointer w-[120px]" />
                    </div>

                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors ${mode==='year'?'border-indigo-500 bg-indigo-50/30':'border-gray-200 bg-white hover:bg-gray-50'}`}>
                        <label className="flex items-center gap-2 cursor-pointer" onClick={() => setMode('year')}>
                            <input type="radio" checked={mode==='year'} readOnly className="text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"/>
                            <span className="text-sm font-bold text-gray-700">Año</span>
                        </label>
                        <select value={selectedYear} onChange={(e) => { setSelectedYear(e.target.value); setMode('year'); }} className="bg-transparent text-sm outline-none font-semibold text-indigo-900 cursor-pointer w-[70px]">
                            <option value="2026">2026</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                            <option value="2023">2023</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Sutil línea divisoria entre los filtros y el grid */}
            <hr className="border-gray-100" />

            {/* Contenedor de Gráficos */}
            {isLoading ? (
                <div className="flex flex-col justify-center items-center py-20 space-y-4 bg-gray-50/50 rounded-2xl border border-gray-50">
                    <Loader2 size={36} className="animate-spin text-indigo-500" />
                    <p className="text-indigo-900 font-bold tracking-widest text-sm uppercase animate-pulse">Cargando datos regionales...</p>
                </div>
            ) : isError ? (
                <div className="bg-red-50 text-red-600 p-8 rounded-2xl text-center border border-red-100">
                    <AlertTriangle size={32} className="mx-auto mb-2" />
                    <h3 className="font-bold">Error obteniendo datos regionales</h3>
                </div>
            ) : isEmpty ? (
                <div className="flex flex-col items-center justify-center py-20 px-6 bg-gray-50/30 rounded-2xl border border-gray-100 text-center">
                    <div className="bg-gray-50 p-6 rounded-full border border-gray-100 mb-4 animate-bounce">
                        <Inbox className="w-14 h-14 text-gray-300" />
                    </div>
                    <h3 className="text-base font-black text-gray-800 mb-1">
                        Sin transacciones
                    </h3>
                    <p className="text-sm text-gray-500 max-w-sm">
                        Aún no hay transacciones registradas para este período.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Aportación Geográfica (Premium Bars) */}
                    <div className="flex flex-col">
                        <div className="flex items-center justify-between mb-4 pb-2">
                            <h3 className="text-base font-black text-gray-800">Aportación Geográfica</h3>
                        </div>
                        
                        <div className="flex-1 w-full relative">
                            <div className="space-y-4 w-full">
                                <div className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">Ventas por Sucursal</div>
                                {branchData.map((branch, i) => {
                                    const theme = getBranchTheme(branch.name);
                                    const pct = totalBranchSales > 0 ? ((branch.ventas / totalBranchSales) * 100).toFixed(1) : '0';
                                    return (
                                        <div key={i} className="bg-gray-50/50 hover:bg-gray-50 transition-all border border-gray-100 p-4 rounded-2xl flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-black text-gray-800 flex items-center gap-1.5">
                                                    <span className={`w-2 h-2 rounded-full ${theme.bar}`} />
                                                    {branch.name}
                                                </span>
                                                <span className="text-sm font-extrabold text-gray-900">
                                                    {formatBs(branch.ventas)}
                                                </span>
                                            </div>
                                            <div className="relative w-full h-6 bg-gray-100 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full ${theme.bar} rounded-full transition-all duration-500 flex items-center justify-end pr-3 min-w-[35px]`}
                                                    style={{ width: `${(branch.ventas / maxVentas) * 100}%` }}
                                                >
                                                    <span className="text-[10px] font-black text-white select-none">
                                                        {pct}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Mix Top 5 (Premium Grid) */}
                    <div className="flex flex-col">
                        <div className="flex items-center justify-between mb-4 pb-2">
                            <h3 className="text-base font-black text-gray-800">Mix Top 5 de Productos</h3>
                        </div>
                        
                        <div className="flex-1 w-full relative">
                            <div className="flex flex-col sm:flex-row items-center gap-6 h-full mt-2">
                                {/* Left: Donut Chart */}
                                <div className="w-full sm:w-[45%] h-[180px] min-h-[180px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie 
                                                data={topData} 
                                                cx="50%" cy="50%" 
                                                innerRadius={45} 
                                                outerRadius={75} 
                                                paddingAngle={3} 
                                                dataKey="value" 
                                                stroke="none"
                                            >
                                                {topData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={PRODUCT_COLORS[index % PRODUCT_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip 
                                                contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                formatter={(value: any) => [`${value}%`, 'Mix']} 
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                
                                {/* Right: Legend List */}
                                <div className="w-full sm:w-[55%] flex flex-col justify-center gap-3">
                                    <div className="flex text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 border-b border-gray-50 pb-2">
                                        <span className="flex-1 ml-6">Producto</span>
                                        <span className="text-right pr-2">Mix</span>
                                    </div>
                                    <div className="space-y-3 w-full">
                                        {topData.map((cat: any, i: number) => {
                                            const color = PRODUCT_COLORS[i % PRODUCT_COLORS.length];
                                            const badgeClass = BADGE_BG_COLORS[i % BADGE_BG_COLORS.length];
                                            const ingresos = cat.ingresos || 0;
                                            
                                            return (
                                                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50/80 transition-all border border-transparent hover:border-gray-100">
                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-bold text-gray-800 truncate" title={cat.name}>
                                                                {cat.name}
                                                            </p>
                                                            <p className="text-[11px] font-semibold text-gray-500 mt-0.5">
                                                                {formatBs(ingresos)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="ml-4 shrink-0">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black border ${badgeClass}`}>
                                                            {cat.value}%
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
