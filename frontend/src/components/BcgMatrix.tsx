import { useState, useEffect, useCallback, useRef } from 'react';
import { getBcgMatrix } from '../api/api';
import {
    Target, Star, Package, HelpCircle, ArrowDownCircle,
    TrendingUp, TrendingDown, Minus, AlertTriangle, Search, Store,
    CalendarDays, CalendarRange
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

const fmtBs = (n: number) =>
    `Bs. ${n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

/* ─── Tarjeta de producto ─────────────────────────────────── */
function ProductCard({
    p, accent, highlight
}: {
    p: any;
    accent: { border: string; text: string; pill: string; pillText: string };
    highlight?: boolean;
}) {
    const diff = (p.ingresos_actuales ?? 0) - (p.ingresos_anteriores ?? 0);
    const pct  = p.crecimiento != null ? p.crecimiento * 100 : 0;
    const isUp   = p.badge === 'up';
    const isDown = p.badge === 'down';
    const shareW  = Math.min(Math.round((p.cuota_relativa ?? 0) * 100), 100);
    const growthW = Math.min(Math.abs(pct), 100);

    return (
        <div className={cn(
            'bg-white rounded-2xl border p-3.5 shadow-sm hover:shadow-md transition-all duration-200',
            accent.border,
            highlight && 'ring-2 ring-amber-400 shadow-amber-100 shadow-lg'
        )}>
            <p className="font-black text-gray-800 text-xs leading-tight mb-2.5 line-clamp-2" title={p.nombre}>
                {p.nombre}
            </p>

            {/* Actual vs anterior */}
            <div className="flex items-end justify-between mb-2">
                <div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">Período actual</p>
                    <p className={cn('text-sm font-black', accent.text)}>{fmtBs(p.ingresos_actuales ?? 0)}</p>
                </div>
                <div className="text-right">
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">Anterior</p>
                    <p className="text-xs font-semibold text-gray-400">{fmtBs(p.ingresos_anteriores ?? 0)}</p>
                </div>
            </div>

            {/* Badge de variación */}
            <div className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl mb-2.5 text-[10px] font-black',
                isUp ? 'bg-emerald-50 text-emerald-700' : isDown ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'
            )}>
                {isUp ? <TrendingUp size={10}/> : isDown ? <TrendingDown size={10}/> : <Minus size={10}/>}
                <span>{fmtPct(pct)}</span>
                <span className="font-medium text-[9px] opacity-80">
                    ({diff >= 0 ? '+' : ''}{fmtBs(diff)})
                </span>
            </div>

            {/* Barras */}
            <div className="space-y-1.5 mb-2">
                <div>
                    <div className="flex justify-between text-[8px] font-bold text-gray-400 mb-0.5">
                        <span>Cuota de mercado</span><span>{shareW}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all duration-700', accent.pill)}
                             style={{ width: `${shareW}%` }}/>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-[8px] font-bold text-gray-400 mb-0.5">
                        <span>Crecimiento</span>
                        <span className={isUp ? 'text-emerald-600' : isDown ? 'text-red-500' : ''}>{fmtPct(pct)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all duration-700',
                                isUp ? 'bg-emerald-400' : isDown ? 'bg-red-400' : 'bg-gray-300')}
                             style={{ width: `${growthW}%` }}/>
                    </div>
                </div>
            </div>

            {p.nota && (
                <p className={cn('text-[9px] font-bold flex items-center gap-1 leading-tight mt-1', accent.pillText)}>
                    <AlertTriangle size={8} className="shrink-0"/>{p.nota}
                </p>
            )}
        </div>
    );
}

/* ─── Configuración de cuadrantes ────────────────────────── */
const CATEGORIES = [
    {
        key: 'estrellas', label: '⭐ Estrellas',
        desc: 'Alta cuota · Alto crecimiento',
        bg: 'bg-emerald-50', border: 'border-emerald-200', hdr: 'text-emerald-800',
        icon: <Star fill="currentColor" size={14}/>, iconBg: 'bg-emerald-100 text-emerald-600',
        empty: 'Sin estrellas este período.',
        card: { border: 'border-emerald-100', text: 'text-emerald-700', pill: 'bg-emerald-400', pillText: 'text-emerald-600' }
    },
    {
        key: 'vacas', label: '🐄 Vacas',
        desc: 'Alta cuota · Bajo crecimiento',
        bg: 'bg-blue-50', border: 'border-blue-200', hdr: 'text-blue-800',
        icon: <Package size={14}/>, iconBg: 'bg-blue-100 text-blue-600',
        empty: 'Sin vacas este período.',
        card: { border: 'border-blue-100', text: 'text-blue-700', pill: 'bg-blue-400', pillText: 'text-blue-600' }
    },
    {
        key: 'interrogantes', label: '❓ Interrogantes',
        desc: 'Baja cuota · Alto crecimiento',
        bg: 'bg-purple-50', border: 'border-purple-200', hdr: 'text-purple-800',
        icon: <HelpCircle size={14}/>, iconBg: 'bg-purple-100 text-purple-600',
        empty: 'Sin interrogantes este período.',
        card: { border: 'border-purple-100', text: 'text-purple-700', pill: 'bg-purple-400', pillText: 'text-purple-600' }
    },
    {
        key: 'perros', label: '🐕 Perros',
        desc: 'Baja cuota · Bajo crecimiento',
        bg: 'bg-gray-100', border: 'border-gray-300', hdr: 'text-gray-700',
        icon: <ArrowDownCircle size={14}/>, iconBg: 'bg-gray-200 text-gray-600',
        empty: '¡Catálogo limpio!',
        card: { border: 'border-gray-200', text: 'text-gray-600', pill: 'bg-gray-400', pillText: 'text-red-500' }
    },
];

const SUCS = [
    { value: '', label: 'Todas las Sucursales' },
    { value: 'Heroinas', label: 'Heroínas' },
    { value: 'Recoleta', label: 'Recoleta' },
    { value: 'Calacoto', label: 'Calacoto' },
];

/* ─── Componente principal ───────────────────────────────── */
export default function BcgMatrix() {
    const [mode, setMode] = useState<'today' | 'week' | 'month' | 'year'>('month');
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [selectedYear, setSelectedYear]   = useState(() => String(new Date().getFullYear()));
    const [sucursal, setSucursal] = useState('');
    const [search,   setSearch]   = useState('');
    const [dates, setDates] = useState({ start: '', end: '', startPrev: '', endPrev: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [isError,   setIsError]   = useState(false);
    const [bcg, setBcg] = useState<any>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    /* Calcular fechas */
    useEffect(() => {
        let s = new Date(), e = new Date();
        s.setHours(0,0,0,0); e.setHours(23,59,59,999);
        if (mode === 'week') {
            s.setDate(e.getDate() - 6);
        } else if (mode === 'month') {
            const [y,m] = selectedMonth.split('-');
            s = new Date(+y, +m-1, 1);
            e = new Date(+y, +m, 0); e.setHours(23,59,59,999);
        } else if (mode === 'year') {
            s = new Date(+selectedYear, 0, 1);
            e = new Date(+selectedYear, 11, 31); e.setHours(23,59,59,999);
        }
        const dias = Math.max(Math.round((e.getTime()-s.getTime())/86400000), 1);
        const sp = new Date(s); sp.setDate(s.getDate()-dias);
        const ep = new Date(e); ep.setDate(e.getDate()-dias);
        setDates({ start:s.toISOString(), end:e.toISOString(), startPrev:sp.toISOString(), endPrev:ep.toISOString() });
    }, [mode, selectedMonth, selectedYear]);

    /* Fetch */
    const fetchData = useCallback(async () => {
        if (!dates.start || !dates.end) return;
        setIsLoading(true); setIsError(false);
        try { setBcg(await getBcgMatrix(dates.start, dates.end, sucursal || undefined)); }
        catch { setIsError(true); }
        finally { setIsLoading(false); }
    }, [dates.start, dates.end, sucursal]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const fmt = (iso: string) =>
        iso ? new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }) : '';

    const modeLabel = () => {
        if (mode === 'today') return 'Hoy';
        if (mode === 'week')  return 'Última semana';
        if (mode === 'month') {
            const [y,m] = selectedMonth.split('-');
            return new Date(+y,+m-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'});
        }
        return `Año ${selectedYear}`;
    };

    /* Resultados de búsqueda */
    const searchResults = search.trim().length >= 2
        ? CATEGORIES.flatMap(cat => {
            const items: any[] = bcg?.[cat.key] ?? [];
            return items
                .filter(p => p.nombre.toLowerCase().includes(search.trim().toLowerCase()))
                .map(p => ({ ...p, _cat: cat }));
        })
        : [];

    return (
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">

            {/* ── Header ──────────────────────────────────────────── */}
            <div className="p-8 pb-6 border-b border-gray-50">
                <div className="flex flex-col xl:flex-row xl:items-start gap-6">

                    {/* Columna izquierda */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                            <div className="p-2 bg-rose-50 text-rose-500 rounded-xl shrink-0">
                                <Target size={20}/>
                            </div>
                            <h2 className="text-2xl font-black text-gray-900">Matriz BCG Evolucionada</h2>
                        </div>
                        <p className="text-gray-400 text-sm mb-4 ml-1">
                            Cuota de mercado relativa vs tasa de crecimiento —
                            cada producto muestra su variación exacta respecto al período anterior.
                        </p>

                        {/* Períodos */}
                        <div className="flex flex-wrap gap-2.5">
                            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3.5 py-2.5 rounded-2xl">
                                <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"/>
                                <div>
                                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Período analizado</p>
                                    <p className="text-xs font-black text-indigo-800 capitalize">{modeLabel()}</p>
                                    <p className="text-[10px] text-indigo-400 mt-0.5">{fmt(dates.start)} → {fmt(dates.end)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 px-3.5 py-2.5 rounded-2xl">
                                <div className="w-2 h-2 rounded-full bg-rose-400 shrink-0"/>
                                <div>
                                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Comparado con</p>
                                    <p className="text-xs font-black text-rose-700">Período anterior equivalente</p>
                                    <p className="text-[10px] text-rose-400 mt-0.5">{fmt(dates.startPrev)} → {fmt(dates.endPrev)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Resultados de búsqueda */}
                        {search.trim().length >= 2 && (
                            <div className="mt-3">
                                {searchResults.length === 0 ? (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700 w-fit">
                                        <Search size={11}/> No se encontró «{search}» en la matriz actual.
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {searchResults.map(p => (
                                            <div key={p.producto_id}
                                                className={cn('flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold',
                                                    p._cat.bg, p._cat.border, p._cat.hdr)}
                                                title={p.nombre}>
                                                <span>{p._cat.label.split(' ')[0]}</span>
                                                <span className="truncate max-w-[160px]">{p.nombre}</span>
                                                <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full',
                                                    p.badge==='up' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                                                    {p.badge==='up' ? '↑' : '↓'} {(p.crecimiento*100).toFixed(1)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>
                {/* Fila de controles — horizontal */}
                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-gray-50">

                    {/* Buscador */}
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar producto..."
                            className="w-full pl-8 pr-8 py-2 text-xs font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white focus:border-amber-300 placeholder:text-gray-300 transition-all"
                        />
                        {search && (
                            <button onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 font-black text-xs">✕</button>
                        )}
                    </div>

                    {/* Sucursal */}
                    <div className="relative min-w-[160px]">
                        <Store size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 pointer-events-none"/>
                        <select
                            value={sucursal}
                            onChange={e => setSucursal(e.target.value)}
                            className="w-full pl-8 pr-4 py-2 text-xs font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white appearance-none cursor-pointer transition-all">
                            {SUCS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>

                    {/* Separador */}
                    <div className="h-7 w-px bg-gray-200 mx-1 hidden sm:block"/>

                    {/* Pills de período */}
                    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                        {(['today','week'] as const).map(m => (
                            <button key={m} onClick={() => setMode(m)}
                                className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
                                    mode===m ? 'bg-white text-rose-600 shadow-sm border border-rose-100' : 'text-slate-500 hover:text-slate-700')}>
                                {m==='today' ? 'Hoy' : '1 Sem.'}
                            </button>
                        ))}

                        {/* Mes */}
                        <div className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer',
                            mode==='month' ? 'bg-white shadow-sm border border-rose-100 text-rose-700' : 'text-slate-500 hover:bg-white/60')}
                            onClick={() => setMode('month')}>
                            <CalendarDays size={13} className={mode==='month' ? 'text-rose-500' : 'text-slate-400'}/>
                            <input
                                type="month"
                                value={selectedMonth}
                                onClick={e => { e.stopPropagation(); setMode('month'); }}
                                onChange={e => { setSelectedMonth(e.target.value); setMode('month'); }}
                                className={cn('bg-transparent text-xs outline-none font-bold cursor-pointer w-[90px]',
                                    mode==='month' ? 'text-rose-700' : 'text-slate-600')}/>
                        </div>

                        {/* Año */}
                        <div className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer',
                            mode==='year' ? 'bg-white shadow-sm border border-rose-100' : 'text-slate-500 hover:bg-white/60')}
                            onClick={() => setMode('year')}>
                            <CalendarRange size={13} className={mode==='year' ? 'text-rose-500' : 'text-slate-400'}/>
                            <select
                                value={selectedYear}
                                onClick={e => { e.stopPropagation(); setMode('year'); }}
                                onChange={e => { setSelectedYear(e.target.value); setMode('year'); }}
                                className={cn('bg-transparent text-xs outline-none font-bold cursor-pointer w-[52px]',
                                    mode==='year' ? 'text-rose-700' : 'text-slate-600')}>
                                {['2026','2025','2024','2023'].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                </div>
            </div>

            {/* ── Cuerpo ─────────────────────────────────────────── */}
            <div className="p-8 pt-6">
                {isLoading ? (
                    <div className="flex flex-col justify-center items-center py-20 text-center animate-pulse">
                        <Target size={40} className="text-rose-300 mb-3"/>
                        <p className="font-bold text-rose-400 text-sm">Calculando Cuota de Mercado...</p>
                    </div>
                ) : isError || !bcg ? (
                    <div className="bg-red-50 text-red-600 p-8 rounded-3xl text-center border border-red-100">
                        <AlertTriangle size={32} className="mx-auto mb-2"/>
                        <h3 className="font-bold">Error cargando Matriz BCG</h3>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {CATEGORIES.map(cat => {
                            const items: any[] = bcg?.[cat.key] ?? [];
                            return (
                                <div key={cat.key} className={cn('rounded-3xl p-5 flex flex-col border', cat.bg, cat.border)}>
                                    {/* Cabecera del cuadrante */}
                                    <div className="flex items-start gap-2 mb-1 shrink-0">
                                        <div className={cn('p-2 rounded-full shrink-0', cat.iconBg)}>{cat.icon}</div>
                                        <div>
                                            <h3 className={cn('font-black uppercase text-xs tracking-wide', cat.hdr)}>{cat.label}</h3>
                                            <p className="text-[9px] text-gray-400 font-medium mt-0.5">{cat.desc}</p>
                                        </div>
                                    </div>
                                    <div className={cn('text-[9px] font-black px-2 py-0.5 rounded-full w-fit mb-3 shrink-0', cat.iconBg)}>
                                        {items.length} producto{items.length !== 1 ? 's' : ''}
                                    </div>
                                    {/* Lista */}
                                    <div className="space-y-2.5 overflow-y-auto pr-0.5 flex-1 max-h-[480px]">
                                        {items.length > 0
                                            ? items.map((p: any) => {
                                                const isMatch = search.trim().length >= 2 &&
                                                    p.nombre.toLowerCase().includes(search.trim().toLowerCase());
                                                return <ProductCard key={p.producto_id} p={p} accent={cat.card} highlight={isMatch}/>;
                                            })
                                            : <p className={cn('text-xs text-center py-8 font-medium opacity-50', cat.hdr)}>{cat.empty}</p>
                                        }
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
