import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

import {
    Activity, BarChart3, TrendingUp, DollarSign,
    Package, AlertTriangle, Loader2, Target, Clock,
    Star, HelpCircle, ArrowDownCircle, Coins, PieChart as PieChartIcon
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, Line,
    ComposedChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const formatBs = (num?: number) => `Bs. ${(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AnalyticsDashboard() {
    const { role } = useAuthStore();
    const [dateRange, setDateRange] = useState<'today' | '7days' | '30days'>('today');
    
    const [dashboard, setDashboard] = useState<any>(null);
    const [bcg, setBcg] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        
        const fetchAnalytics = async () => {
            setIsLoading(true);
            setIsError(false);
            
            try {
                // Cálculo de fechas relativas
                const end = new Date();
                const start = new Date();
                if (dateRange === 'today') {
                    start.setHours(0,0,0,0);
                } else if (dateRange === '7days') {
                    start.setDate(start.getDate() - 7);
                } else {
                    start.setDate(start.getDate() - 30);
                }
                
                const startStr = start.toISOString();
                const endStr = end.toISOString();

                // 2. Disparamos Peticiones Reales al Backend simultáneamente
                const token = localStorage.getItem('choco-token') || JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token;
                
                const urlDashboard = `http://127.0.0.1:8001/api/v1/analytics/dashboard?start_date=${startStr}&end_date=${endStr}&time_range=${dateRange}`;
                const resDash = await fetch(urlDashboard, { headers: { 'Authorization': `Bearer ${token}` } });
                
                if (!resDash.ok) throw new Error("Fallo en la red");
                const dashRes = await resDash.json();

                if (isMounted) {
                    setDashboard(dashRes);
                    setBcg(dashRes.bcg_data); // Enlazar al dato pandas combinado nativo
                }
            } catch (err) {
                console.error("Error al cargar Analítica:", err);
                if (isMounted) setIsError(true);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchAnalytics();
        return () => { isMounted = false; };
    }, [dateRange]);

    const esAdmin = ['SUPERADMIN', 'ADMIN_MATRIZ', 'ADMIN'].includes(role || '');

    if (!esAdmin) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center">
                <AlertTriangle className="text-amber-500 mb-4" size={48} />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
                <p className="text-gray-500">Solo administradores pueden ver la analítica de "Chocolates Taboada".</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-amber-100 text-amber-700 rounded-xl"><Activity size={26} /></div>
                        Inteligencia de Negocios
                    </h1>
                    <p className="text-gray-500 mt-2 text-sm font-medium">Panel Gerencial de Rendimiento — Datos en tiempo real de MongoDB.</p>
                </div>
                
                <div className="flex flex-col items-end gap-2 print:hidden">
                    <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-amber-100">
                        {[
                            { id: 'today', label: 'Hoy' },
                            { id: '7days', label: '7 Días' },
                            { id: '30days', label: '30 Días' }
                        ].map(r => (
                            <button
                                key={r.id}
                                onClick={() => setDateRange(r.id as any)}
                                className={cn(
                                    "px-4 py-1.5 text-sm font-bold rounded-lg transition-all",
                                    dateRange === r.id ? "bg-amber-600 text-white shadow-md" : "text-gray-500 hover:text-amber-900 hover:bg-amber-50"
                                )}>
                                {r.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col justify-center items-center py-32">
                    <Loader2 size={48} className="animate-spin text-amber-500 mb-4" />
                    <p className="text-gray-400 font-medium animate-pulse">Sincronizando y ejecutando Motor Matemático en Backend...</p>
                </div>
            ) : isError ? (
                <div className="bg-red-50 text-red-600 p-8 rounded-3xl text-center border border-red-100">
                    <AlertTriangle size={32} className="mx-auto mb-2" />
                    <h3 className="font-bold">No se pudo conectar con el servidor</h3>
                    <p className="text-sm opacity-80 mt-2">Revisa si Uvicorn está corriendo y si CORS está bien configurado.</p>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    
                    {/* Fila 1: KPIs Principales Financieros */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-amber-600 to-orange-700 rounded-3xl p-6 text-white shadow-lg shadow-amber-200">
                            <div className="flex items-center gap-3 mb-4 opacity-90">
                                <DollarSign size={20} /> <span className="font-bold uppercase tracking-wider text-xs">Ventas Brutas</span>
                            </div>
                            <h2 className="text-3xl font-black mb-1">{formatBs(dashboard?.kpis?.total_ventas || 0)}</h2>
                            <p className="text-xs opacity-75">Ingresos directos reportados a caja.</p>
                        </div>
                        
                        <div className="bg-white border-2 border-red-50 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5"><TrendingUp size={80} className="rotate-180" /></div>
                            <div className="flex items-center gap-3 mb-4 text-red-500 relative z-10">
                                <Activity size={20} /> <span className="font-bold uppercase tracking-wider text-xs">Costo Insumos</span>
                            </div>
                            <h2 className="text-3xl font-black text-gray-900 mb-1 relative z-10">{formatBs(dashboard?.kpis?.costo_total || 0)}</h2>
                            <p className="text-xs text-gray-400 font-medium relative z-10">Descuento de materia prima (Cacao).</p>
                        </div>

                        <div className="bg-white border-2 border-emerald-50 rounded-3xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-4 text-emerald-600">
                                <Activity size={20} /> <span className="font-bold uppercase tracking-wider text-xs">Margen de Ganancia</span>
                            </div>
                            <h2 className="text-3xl font-black text-emerald-900 mb-1">{formatBs(dashboard?.kpis?.margen_bruto || 0)}</h2>
                            <p className="text-xs text-emerald-600/60 font-medium">Rentabilidad líquida generada.</p>
                        </div>

                        <div className="bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-800 text-white">
                            <div className="flex items-center gap-3 mb-4 text-indigo-300">
                                <Target size={20} /> <span className="font-bold uppercase tracking-wider text-xs">Ticket Promedio</span>
                            </div>
                            <h2 className="text-3xl font-black mb-1">{formatBs(dashboard?.kpis?.ticket_promedio || 0)}</h2>
                            <p className="text-xs text-slate-400 font-medium">De {dashboard?.kpis?.cantidad_transacciones || 0} transacciones en el periodo.</p>
                        </div>
                    </div>

                    {/* Fila 2: Percentiles y KPIs Avanzados */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-[2rem] p-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">Percentil 90 (Alta Gama)</p>
                                <h3 className="text-xl font-black text-indigo-950">{formatBs(dashboard?.kpis?.percentil_90 || 0)}</h3>
                                <p className="text-[10px] text-indigo-400 mt-1 max-w-[200px] leading-tight">El Top 10% de tus ventas superan esta barrera.</p>
                            </div>
                            <div className="p-3 bg-indigo-100 rounded-full text-indigo-600"><TrendingUp size={24} /></div>
                        </div>

                        <div className="bg-sky-50/50 border border-sky-100 rounded-[2rem] p-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-sky-500 uppercase tracking-wider mb-1">Mediana de Venta (P50)</p>
                                <h3 className="text-xl font-black text-sky-950">{formatBs(dashboard?.kpis?.percentil_50 || 0)}</h3>
                                <p className="text-[10px] text-sky-400 mt-1 max-w-[200px] leading-tight">La mitad de tus clientes compra canastas menores a esto.</p>
                            </div>
                            <div className="p-3 bg-sky-100 rounded-full text-sky-600"><BarChart3 size={24} /></div>
                        </div>

                        <div className="bg-pink-50/50 border border-pink-100 rounded-[2rem] p-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-pink-500 uppercase tracking-wider mb-1">Clientes Recurrentes</p>
                                <h3 className="text-xl font-black text-pink-950">{dashboard?.kpis?.clientes_recurrentes || 0}%</h3>
                                <p className="text-[10px] text-pink-400 mt-1 max-w-[200px] leading-tight">Porcentaje de clientes fidelizados que volvieron.</p>
                            </div>
                            <div className="p-3 bg-pink-100 rounded-full text-pink-600"><Clock size={24} /></div>
                        </div>
                    </div>


                    {/* Fila 3: Gráficas de Barras (Recharts) Mapeo a Esquema Real */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        
                        {/* Rendimiento Matriz vs Sucursal */}
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 xl:col-span-2">
                            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <BarChart3 size={18} className="text-amber-500" /> Comparativa de Tiendas
                            </h3>
                            <div className="h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashboard?.ventas_por_sucursal?.detalle || []} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        {/* Usamos el nuevo esquema: sucursal_id */}
                                        <XAxis dataKey="sucursal_id" tick={{fontSize: 10, fill: '#6b7280', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                                        <YAxis tickFormatter={(val) => `Bs ${val}`} tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{fill: '#fef3c7', opacity: 0.4}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} formatter={(val: any) => `Bs. ${Number(val).toLocaleString()}`} />
                                        <Legend iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 'bold', paddingTop: '10px'}} />
                                        {/* Usamos total_ingresos y total_margen */}
                                        <Bar dataKey="total_ingresos" name="Venta Total (Ingreso)" fill="#d97706" radius={[4, 4, 0, 0]} barSize={28} />
                                        <Bar dataKey="total_margen" name="Margen Rentable (Líquido)" fill="#059669" radius={[4, 4, 0, 0]} barSize={28} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Comparativa Dinámica Horaria YoY */}
                        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 xl:col-span-2">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-6 border-b border-gray-50">
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                        <Activity className="text-indigo-600" /> Comparativa Dinámica Horaria YoY
                                    </h3>
                                    <p className="text-gray-500 text-sm mt-1">Tráfico de la ventana seleccionada vs Exactamente 364 días atrás (1 año atrás mismo día).</p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 mt-4 sm:mt-0">
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
                                        <div className="w-3 h-3 rounded-full shadow-sm" style={{backgroundColor: '#6366f1'}}></div> Real (Hoy)
                                    </div>
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
                                        <div className="w-3 h-0.5 bg-gray-400 border border-dashed border-gray-400"></div> Año Pasado
                                    </div>
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
                                        <div className="w-3 h-3 rounded-full shadow-sm" style={{backgroundColor: '#10b981'}}></div> Margen Proyección
                                    </div>
                                </div>
                            </div>

                            <div className="h-[400px] w-full">
                                {(dashboard?.distribucion_horaria?.length || 0) > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={dashboard?.distribucion_horaria || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorPrediccion2" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                            <XAxis dataKey="hora" tick={{ fontSize: 13, fill: '#6b7280', fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                                            <YAxis tickFormatter={(val) => `Bs ${val}`} tick={{ fontSize: 12, fill: '#9ca3af', fontWeight: 600 }} axisLine={false} tickLine={false} dx={-10} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold', padding: '12px 20px' }}
                                                formatter={(value: any, name: any) => [
                                                    `Bs. ${Number(value).toLocaleString()}`,
                                                    name === 'real' ? 'Real Hoy' : name === 'pasado' ? 'Año Pasado (364d)' : 'Proyección Algorítmica'
                                                ]}
                                            />
                                            <Area type="monotone" dataKey="prediccion" name="prediccion" stroke="none" fillOpacity={1} fill="url(#colorPrediccion2)" />
                                            <Line type="monotone" dataKey="pasado" name="pasado" stroke="#9ca3af" strokeWidth={3} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} />
                                            <Line type="monotone" dataKey="real" name="real" stroke="#6366f1" strokeWidth={4} dot={false} activeDot={{ r: 8, stroke: '#fff', strokeWidth: 3 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">Cargando YoY...</div>
                                )}
                            </div>
                        </div>

                        {/* Mix de Catálogo (Migrado de Maestro) */}
                        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 flex flex-col xl:col-span-2">
                            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2 mb-6 border-b border-gray-50 pb-4">
                                <PieChartIcon className="text-amber-500" /> Mix de Catálogo (Top Familias)
                            </h3>
                            <div className="flex-1 h-[400px] w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={dashboard?.top_categories || []} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                                            {(dashboard?.top_categories || []).map((_: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b'][index % 5]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: any) => [`${value}%`, 'Participación de Transacciones']} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-3xl font-black text-gray-900">100%</span>
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Total Mix</span>
                                </div>
                            </div>
                            <div className="mt-4 space-y-3">
                                {(dashboard?.top_categories || []).map((cat: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                            <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b'][i % 5] }}></div>
                                            <span className="font-semibold text-gray-600 truncate" title={cat.name}>{cat.name}</span>
                                        </div>
                                        <span className="font-black text-gray-900 pl-4">{cat.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Fila 4: Top Productos Real */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 overflow-hidden">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Package size={18} className="text-orange-500" /> Artículos Top Ventas
                        </h3>
                        <div className="space-y-3">
                            {dashboard?.top_productos?.productos?.map((prod: any, i: number) => (
                                <div key={prod.producto_id} className="flex items-center gap-4 p-4 bg-gray-50/50 hover:bg-amber-50 rounded-2xl transition-all border border-transparent hover:border-amber-100 group">
                                    <div className={cn(
                                        "w-12 h-12 shrink-0 rounded-2xl font-black flex items-center justify-center text-sm shadow-sm transition-transform group-hover:scale-110",
                                        i === 0 ? "bg-gradient-to-br from-yellow-300 to-amber-500 text-white shadow-amber-200" : 
                                        i === 1 ? "bg-gradient-to-br from-slate-200 to-slate-400 text-white shadow-slate-200" : 
                                        i === 2 ? "bg-gradient-to-br from-orange-300 to-orange-500 text-white shadow-orange-200" : 
                                        "bg-white text-gray-400 border border-gray-200"
                                    )}>
                                        #{i + 1}
                                    </div>
                                    <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <div>
                                            <p className="font-bold text-gray-900 truncate text-base">{prod.nombre}</p>
                                            <p className="text-xs text-gray-500 font-medium">{prod.cantidad_vendida.toLocaleString()} unidades extraídas del almacén</p>
                                        </div>
                                        <div className="text-left sm:text-right shrink-0">
                                            <p className="text-lg font-black text-amber-600 drop-shadow-sm">{formatBs(prod.ingresos)}</p>
                                            <p className="text-[10px] uppercase font-bold text-gray-400">Retorno Bruto</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>


                    {/* Fila 5: INTERFAZ MATRIZ BCG */}
                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <div className="mb-6 flex flex-col sm:flex-row items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                                    Matriz Analítica BCG 
                                </h2>
                                <p className="text-sm text-gray-500">Evaluación algorítmica de participación de mercado VS Crecimiento de ventas del periodo equivalente anterior.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* ESTRELLAS */}
                            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full"><Star fill="currentColor" size={20}/></div>
                                    <h3 className="font-bold text-emerald-900 uppercase">Productos Estrella</h3>
                                </div>
                                <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                                    {(bcg?.estrellas?.length || 0) > 0 ? bcg?.estrellas.map((p: any) => (
                                        <div key={p.producto_id} className="bg-white p-4 rounded-xl border border-emerald-100">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold text-gray-800 text-sm truncate">{p.nombre}</span>
                                                <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-1 rounded text-[10px] shrink-0 uppercase tracking-widest whitespace-nowrap">Cuota Alta</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap",
                                                    p.badge === 'up' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                                    p.badge === 'down' ? "bg-red-50 text-red-600 border border-red-100" :
                                                    "bg-gray-50 text-gray-600 border border-gray-100"
                                                )}>{p.tendencia}</span>
                                            </div>
                                        </div>
                                    )) : <p className="text-sm text-emerald-600/60 p-2">Vacio en este periodo.</p>}
                                </div>
                            </div>

                            {/* VACAS LECHERAS */}
                            <div className="bg-blue-50 border border-blue-200 rounded-3xl p-5 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-full"><Coins size={20}/></div>
                                    <h3 className="font-bold text-blue-900 uppercase">Vacas Lecheras</h3>
                                </div>
                                <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                                    {(bcg?.vacas?.length || 0) > 0 ? bcg?.vacas.map((p: any) => (
                                        <div key={p.producto_id} className="bg-white p-4 rounded-xl border border-blue-100">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold text-gray-800 text-sm truncate">{p.nombre}</span>
                                                <span className="text-blue-700 font-bold bg-blue-100 px-2 py-1 rounded text-[10px] shrink-0 uppercase tracking-widest">Estable</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap",
                                                    p.badge === 'up' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                                    p.badge === 'down' ? "bg-red-50 text-red-600 border border-red-100" :
                                                    "bg-gray-50 text-gray-600 border border-gray-100"
                                                )}>{p.tendencia}</span>
                                            </div>
                                        </div>
                                    )) : <p className="text-sm text-blue-600/60 p-2">Vacio en este periodo.</p>}
                                </div>
                            </div>

                            {/* INTERROGANTES */}
                            <div className="bg-purple-50 border border-purple-200 rounded-3xl p-5 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-purple-100 text-purple-600 rounded-full"><HelpCircle size={20}/></div>
                                    <h3 className="font-bold text-purple-900 uppercase">Interrogantes</h3>
                                </div>
                                <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                                    {(bcg?.interrogantes?.length || 0) > 0 ? bcg?.interrogantes.map((p: any) => (
                                        <div key={p.producto_id} className="bg-white p-4 rounded-xl border border-purple-100">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold text-gray-800 text-sm truncate">{p.nombre}</span>
                                                <span className="text-purple-700 font-bold bg-purple-100 px-2 py-1 rounded text-[10px] shrink-0 uppercase tracking-widest whitespace-nowrap">Analizar</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap",
                                                    p.badge === 'up' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                                    p.badge === 'down' ? "bg-red-50 text-red-600 border border-red-100" :
                                                    "bg-gray-50 text-gray-600 border border-gray-100"
                                                )}>{p.tendencia}</span>
                                            </div>
                                        </div>
                                    )) : <p className="text-sm text-purple-600/60 p-2">Vacio en este periodo.</p>}
                                </div>
                            </div>

                            {/* PERROS */}
                            <div className="bg-gray-100 border border-gray-300 rounded-3xl p-5 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-gray-200 text-gray-600 rounded-full"><ArrowDownCircle size={20}/></div>
                                    <h3 className="font-bold text-gray-700 uppercase">Artículos Perro</h3>
                                </div>
                                <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                                    {(bcg?.perros?.length || 0) > 0 ? bcg?.perros.map((p: any) => (
                                        <div key={p.producto_id} className="bg-white p-4 rounded-xl border border-gray-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold text-gray-600 text-sm truncate">{p.nombre}</span>
                                                <span className="text-red-700 font-bold bg-red-100 px-2 py-1 rounded text-[10px] shrink-0 uppercase tracking-widest whitespace-nowrap">Depreciado</span>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-md text-xs font-bold w-fit",
                                                    p.badge === 'up' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                                    p.badge === 'down' ? "bg-red-50 text-red-600 border border-red-100" :
                                                    "bg-gray-50 text-gray-600 border border-gray-100"
                                                )}>{p.tendencia}</span>
                                                
                                                {p.nota && (
                                                    <span className="text-[11px] font-bold text-red-500 flex items-center gap-1 border-t border-red-50 pt-2"><AlertTriangle size={12}/> {p.nota}</span>
                                                )}
                                            </div>
                                        </div>
                                    )) : <p className="text-sm text-gray-400 p-2">¡Todo tu catálogo es excelente!</p>}
                                </div>
                            </div>

                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
