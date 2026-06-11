import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getBcgMatrix, getProducts, getCategories } from '../api/api';
import {
    Target, Star, Package, HelpCircle, ArrowDownCircle,
    AlertTriangle, Search, Store, Filter
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }


/* ─── Configuración de cuadrantes ────────────────────────── */
const CATEGORIES = [
    {
        key: 'estrellas', label: '⭐ Estrellas',
        desc: 'Alta cuota · Alto crecimiento',
        bg: 'bg-emerald-50/50', border: 'border-emerald-200/50', hdr: 'text-emerald-800',
        icon: <Star fill="currentColor" size={16}/>, iconBg: 'bg-emerald-100 text-emerald-600',
        empty: 'Sin estrellas este período.',
        card: { border: 'border-emerald-200', text: 'text-emerald-700', pill: 'bg-emerald-400', pillText: 'text-emerald-600' }
    },
    {
        key: 'interrogantes', label: '❓ Interrogantes',
        desc: 'Baja cuota · Alto crecimiento',
        bg: 'bg-purple-50/50', border: 'border-purple-200/50', hdr: 'text-purple-800',
        icon: <HelpCircle size={16}/>, iconBg: 'bg-purple-100 text-purple-600',
        empty: 'Sin interrogantes este período.',
        card: { border: 'border-purple-200', text: 'text-purple-700', pill: 'bg-purple-400', pillText: 'text-purple-600' }
    },
    {
        key: 'vacas', label: '🐄 Vacas',
        desc: 'Alta cuota · Bajo crecimiento',
        bg: 'bg-blue-50/50', border: 'border-blue-200/50', hdr: 'text-blue-800',
        icon: <Package size={16}/>, iconBg: 'bg-blue-100 text-blue-600',
        empty: 'Sin vacas este período.',
        card: { border: 'border-blue-200', text: 'text-blue-700', pill: 'bg-blue-400', pillText: 'text-blue-600' }
    },
    {
        key: 'perros', label: '🐕 Perros',
        desc: 'Baja cuota · Bajo crecimiento',
        bg: 'bg-gray-100/50', border: 'border-gray-200/80', hdr: 'text-gray-700',
        icon: <ArrowDownCircle size={16}/>, iconBg: 'bg-gray-200 text-gray-600',
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
    const [mode] = useState<'today' | 'week' | 'month' | 'year'>('month');
    const [selectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [selectedYear]   = useState(() => String(new Date().getFullYear()));
    const [sucursal, setSucursal] = useState('');
    const [search,   setSearch]   = useState('');
    const [dates, setDates] = useState({ start: '', end: '', startPrev: '', endPrev: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [isError,   setIsError]   = useState(false);
    const [rawProducts, setRawProducts] = useState<any[]>([]);
    const searchRef = useRef<HTMLInputElement>(null);

    // Catalog states for Advanced Filters
    const [categories, setCategories] = useState<{_id: string, name: string}[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [catalogo, setCatalogo] = useState<any[]>([]);

    // Cargar Catálogo
    useEffect(() => {
        getCategories().then(cats => setCategories(cats)).catch(console.error);
        getProducts(1, 2000).then(res => {
            setCatalogo(res.items || []);
        }).catch(console.error);
    }, []);

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

    /* Fetch de Datos Crudos de la Matriz */
    const fetchData = useCallback(async () => {
        if (!dates.start || !dates.end) return;
        setIsLoading(true); setIsError(false);
        try { 
            const rawBcg = await getBcgMatrix(dates.start, dates.end, sucursal || undefined); 
            
            const allProducts = [
                ...(rawBcg.estrellas || []),
                ...(rawBcg.vacas || []),
                ...(rawBcg.interrogantes || []),
                ...(rawBcg.perros || [])
            ];
            
            setRawProducts(allProducts);
        }
        catch (e) {
            console.error("Error fetching BCG Matrix:", e);
            setIsError(true);
        }
        finally { setIsLoading(false); }
    }, [dates.start, dates.end, sucursal]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const fmt = (iso: string) =>
        iso ? new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }) : '';

    /* Lógica Estricta de Left Join con Auto-Sanación (Fallback Dinámico) */
    const bcgData = useMemo(() => {
        // 1. Crear un mapa rápido de ventas crudas para búsqueda O(1)
        const salesDict: Record<string, { actual: number, anterior: number }> = {};
        rawProducts.forEach((p: any) => {
            if (!p.nombre) return;
            const norm = p.nombre.toLowerCase().trim();
            if (!salesDict[norm]) {
                salesDict[norm] = { actual: 0, anterior: 0 };
            }
            salesDict[norm].actual += (p.ingresos_actuales || 0);
            salesDict[norm].anterior += (p.ingresos_anteriores || 0);
        });

        // 2. Fallback Dinámico: Si catalogo está vacío, generamos uno virtual
        const baseCatalogo = (catalogo && catalogo.length > 0) 
            ? catalogo 
            : Array.from(new Map(rawProducts.map((item: any) => [
                (item.nombre || '').toLowerCase().trim(), 
                { nombre: item.nombre, categoria_nombre: item.categoria || item.categoria_nombre || 'otros' }
              ])).values());

        // 3. Left Join sobre el catálogo base
        const productosMapeados = baseCatalogo.map((prodCat: any) => {
            const nombreCat = prodCat.descripcion || prodCat.nombre || 'Sin nombre';
            const norm = nombreCat.toLowerCase().trim();
            const venta = salesDict[norm];
            
            const actual = venta ? venta.actual : 0;
            const anterior = venta ? venta.anterior : 0;
            
            // Protección contra división por cero
            let variacion = 0;
            if (anterior > 0) {
                variacion = ((actual - anterior) / anterior) * 100;
            } else if (actual > 0 && anterior === 0) {
                variacion = 100; // Crecimiento infinito (nuevo producto)
            }

            return {
                nombre: nombreCat,
                categoria_nombre: (prodCat.categoria || prodCat.categoria_nombre || prodCat.name || 'otros').toLowerCase().trim(),
                actual,
                anterior,
                variacion
            };
        });

        // 4. Filtrado Seguro por Categoría (Texto exacto)
        const filtered = productosMapeados.filter((p: any) => {
            const catSeleccionada = selectedCategory || 'all';
            const catReal = String(p.categoria_nombre || 'otros').toLowerCase().trim();
            const filtroNormalizado = String(catSeleccionada).toLowerCase().trim();

            const matchCat = filtroNormalizado === 'all' || 
                             filtroNormalizado === 'todas las categorías' || 
                             filtroNormalizado === '' || 
                             catReal === filtroNormalizado || 
                             catReal.includes(filtroNormalizado) || 
                             filtroNormalizado.includes(catReal);
            
            if (!matchCat) return false;

            if (search.trim().length >= 2) {
                if (!p.nombre.toLowerCase().includes(search.trim().toLowerCase())) return false;
            }
            return true;
        });

        // 5. Recálculo del Líder sobre el universo filtrado
        const maxRevenue = filtered.length > 0 ? Math.max(...filtered.map((p: any) => p.actual), 0) : 0;

        const estrellas: any[] = [];
        const vacas: any[] = [];
        const interrogantes: any[] = [];
        const perros: any[] = [];

        // 6. Calcular Cuota y Clasificar
        filtered.forEach((item: any) => {
            const curr = item.actual;
            const prev = item.anterior;

            // Cuota Relativa
            item.cuota = maxRevenue > 0 ? (curr / maxRevenue) * 100 : 0.0;

            const es_alto_crecimiento = item.variacion >= 5.0; // 5%
            const es_alta_cuota = item.cuota >= 50.0; // 50%

            // Si no hay ventas cae en PERRO
            if (curr === 0 && prev === 0) {
                item.cuadrante = "PERRO";
                perros.push(item);
            } else if (es_alto_crecimiento && es_alta_cuota) {
                item.cuadrante = "ESTRELLA";
                estrellas.push(item);
            } else if (!es_alto_crecimiento && es_alta_cuota) {
                item.cuadrante = "VACA";
                vacas.push(item);
            } else if (es_alto_crecimiento && !es_alta_cuota) {
                item.cuadrante = "INTERROGANTE";
                interrogantes.push(item);
            } else {
                item.cuadrante = "PERRO";
                perros.push(item);
            }
        });

        // 7. Ordenar
        estrellas.sort((a, b) => b.cuota - a.cuota);
        vacas.sort((a, b) => b.cuota - a.cuota);
        interrogantes.sort((a, b) => b.variacion - a.variacion);
        perros.sort((a, b) => b.actual - a.actual);

        return { estrellas, vacas, interrogantes, perros, totalCount: filtered.length };
    }, [rawProducts, selectedCategory, search, catalogo]);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 overflow-hidden flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* ── Header ──────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full">

                {/* Lado Izquierdo (Títulos compactos) */}
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 text-rose-500 rounded-lg shrink-0">
                        <Target size={18}/>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 leading-none">Matriz BCG Evolucionada</h2>
                        <p className="text-xs text-gray-500 mt-1">
                            Agrupación inteligente anti-duplicados y cálculos exactos de cuota relativa.
                        </p>
                    </div>
                </div>

                {/* Lado Derecho (Fechas compactas) */}
                <div className="text-right flex flex-col sm:flex-row gap-3 text-[11px] bg-gray-50 border border-gray-100 p-2 rounded-xl">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"/>
                        <div className="text-left">
                            <span className="text-gray-400 font-bold uppercase tracking-wider mr-1 text-[9px]">Período analizado:</span>
                            <span className="font-semibold text-gray-700">{fmt(dates.start)} → {fmt(dates.end)}</span>
                        </div>
                    </div>
                    <div className="hidden sm:block w-px h-4 bg-gray-200"></div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"/>
                        <div className="text-left">
                            <span className="text-gray-400 font-bold uppercase tracking-wider mr-1 text-[9px]">Comparado con:</span>
                            <span className="font-semibold text-gray-700">{fmt(dates.startPrev)} → {fmt(dates.endPrev)}</span>
                        </div>
                    </div>
                </div>

            </div>

            <hr className="border-gray-100" />

            {/* Fila de controles — horizontal */}
            <div className="flex flex-wrap items-center gap-3">

                {/* Filtros Avanzados */}
                <div className="flex flex-1 min-w-[280px] gap-2">
                    {/* Buscador */}
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar producto por nombre..."
                            className="w-full pl-9 pr-8 py-2 text-xs font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white focus:border-amber-300 placeholder:text-gray-400 transition-all shadow-sm"
                        />
                        {search && (
                            <button onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 font-black text-xs">✕</button>
                        )}
                    </div>

                    {/* Dropdown de Categoría */}
                    <div className="relative min-w-[150px]">
                        <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                        <select
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value.toLowerCase().trim())}
                            className="w-full pl-9 pr-4 py-2 text-xs font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white appearance-none cursor-pointer transition-all shadow-sm">
                            <option value="all">Todas las Categorías</option>
                            {categories.map(c => <option key={c._id} value={c.name.toLowerCase().trim()}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Sucursal */}
                <div className="relative min-w-[160px]">
                    <Store size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 pointer-events-none"/>
                    <select
                        value={sucursal}
                        onChange={e => setSucursal(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white appearance-none cursor-pointer transition-all shadow-sm">
                        {SUCS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>



            </div>

            {/* ── Cuerpo ─────────────────────────────────────────── */}
            <div className="mt-2">
                {isLoading ? (
                    <div className="flex flex-col justify-center items-center py-20 text-center animate-pulse">
                        <Target size={40} className="text-rose-300 mb-3"/>
                        <p className="font-bold text-rose-400 text-sm">Calculando Cuota de Mercado...</p>
                    </div>
                ) : isError ? (
                    <div className="bg-red-50 text-red-600 p-8 rounded-3xl text-center border border-red-100">
                        <AlertTriangle size={32} className="mx-auto mb-2"/>
                        <h3 className="font-bold">Error cargando Matriz BCG</h3>
                    </div>
                ) : (
                    // Contenedor Único: 4 Columnas con divide-x
                    <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 border border-gray-200 rounded-xl bg-white overflow-hidden mt-4 shadow-sm">
                        {CATEGORIES.map(cat => {
                            const items = bcgData[cat.key as keyof typeof bcgData] as any[] ?? [];

                            return (
                                <div key={cat.key} className="flex flex-col">
                                    {/* Cabecera del cuadrante */}
                                    <div className={cn('p-4 shrink-0 flex items-start justify-between gap-2 border-b border-gray-100', cat.bg)}>
                                        <div className="flex gap-2.5">
                                            <div className={cn('p-2 rounded-xl shrink-0 shadow-sm border border-white/40', cat.iconBg)}>{cat.icon}</div>
                                            <div>
                                                <h3 className={cn('font-black uppercase text-xs tracking-wide', cat.hdr)}>{cat.label}</h3>
                                                <p className="text-[9px] text-gray-500 font-semibold mt-0.5">{cat.desc}</p>
                                            </div>
                                        </div>
                                        <div className={cn('text-[9px] font-black px-2 py-0.5 rounded-lg shrink-0 border border-white/50 shadow-sm', cat.iconBg)}>
                                            {items.length}
                                        </div>
                                    </div>
                                    
                                    {/* Lista Continua Compacta (Divide-Y) */}
                                    <div className="flex-1 max-h-[500px] overflow-y-auto custom-scrollbar bg-white">
                                        {items.length === 0 ? (
                                            <p className={cn('text-xs text-center py-10 font-medium opacity-50', cat.hdr)}>{cat.empty}</p>
                                        ) : (
                                            <div className="p-2 flex flex-col gap-2.5 bg-gray-50/50">
                                                {items.map((prod: any) => {
                                                    const diferenciaBs = prod.actual - prod.anterior;
                                                    const diffSign = diferenciaBs > 0 ? '+' : '';
                                                    return (
                                                        <div key={prod.nombre || Math.random()} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
                                                            <span className="text-[11px] font-bold text-gray-800 uppercase leading-tight line-clamp-2" title={prod.nombre}>{prod.nombre}</span>
                                                            
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs font-black text-gray-900">Ventas: Bs. {prod.actual.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap shrink-0 ${prod.variacion > 0 ? 'bg-emerald-100 text-emerald-700' : prod.variacion < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                    {prod.variacion > 0 ? '↑' : prod.variacion < 0 ? '↓' : ''} {prod.variacion > 0 ? '+' : ''}{prod.variacion.toFixed(1)}% ({diffSign}Bs. {diferenciaBs.toLocaleString('en-US', {minimumFractionDigits: 2})})
                                                                </span>
                                                            </div>
                                                            
                                                            <span className="text-[10px] text-gray-500">Mes anterior: Bs. {prod.anterior.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                                                            
                                                            <div className="mt-1">
                                                                <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                                                                    <span>Peso frente al líder:</span>
                                                                    <span className="font-bold text-indigo-600">{prod.cuota.toFixed(1)}%</span>
                                                                </div>
                                                                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                                                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(prod.cuota, 100)}%` }}></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
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
