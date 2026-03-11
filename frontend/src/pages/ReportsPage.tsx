import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getGeneralReports } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { 
    BarChart3, Loader2, DollarSign, Package, TrendingUp, Calendar, 
    AlertTriangle, ShoppingBag, Store
} from 'lucide-react';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
    Tooltip, BarChart, Bar, Legend
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const formatBs = (num: number) => `Bs. ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ReportsPage() {
    const { role } = useAuthStore();
    const [days, setDays] = useState(30);

    const { data: reporte, isLoading, isError } = useQuery({
        queryKey: ['reports', days],
        queryFn: () => getGeneralReports(days),
        enabled: ['SUPERADMIN', 'ADMIN', 'ADMIN_MATRIZ'].includes(role || '')
    });

    if (!['SUPERADMIN', 'ADMIN', 'ADMIN_MATRIZ'].includes(role || '')) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center">
                <AlertTriangle className="text-amber-500 mb-4" size={48} />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
                <p className="text-gray-500 max-w-md">Solo los administradores generales tienen permisos para acceder al módulo de reportes y analíticas avanzadas.</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-20 md:pb-8">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><BarChart3 size={24} /></div>
                        Reportes General
                    </h1>
                    <p className="text-gray-500 mt-2 text-sm">Resumen de ventas y cálculo de ganancias del sistema.</p>
                </div>
                
                <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-200 w-fit">
                    {[7, 15, 30, 90].map(d => (
                        <button 
                            key={d} 
                            onClick={() => setDays(d)}
                            className={cn(
                                "px-4 py-1.5 text-sm font-bold rounded-lg transition-all",
                                days === d ? "bg-indigo-600 text-white shadow-md" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                            )}>
                            {d} Días
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col justify-center items-center py-32">
                    <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
                    <p className="text-gray-400 font-medium animate-pulse">Analizando transacciones...</p>
                </div>
            ) : isError || !reporte ? (
                <div className="bg-red-50 text-red-600 p-8 rounded-3xl text-center border border-red-100 flex flex-col items-center">
                    <AlertTriangle size={32} className="mb-2" />
                    <h3 className="font-bold">Error al cargar reportes</h3>
                    <p className="text-sm opacity-80">Por favor, intenta nuevamente más tarde.</p>
                </div>
            ) : (
                <>
                    {/* ── KPIs ─────────────────────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200">
                            <div className="flex items-center gap-3 mb-4 opacity-80">
                                <DollarSign size={20} /> <span className="font-bold uppercase tracking-wider text-xs">Ingresos Brutos</span>
                            </div>
                            <h2 className="text-4xl font-black mb-1">{formatBs(reporte.kpis.total_ventas)}</h2>
                            <p className="text-xs opacity-70">Total del ticket cobrado en los últimos {days} días.</p>
                        </div>
                        
                        <div className="bg-white border-2 border-emerald-100 rounded-3xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-4 text-emerald-600">
                                <TrendingUp size={20} /> <span className="font-bold uppercase tracking-wider text-xs">Ganancia Neta (15%)</span>
                            </div>
                            <h2 className="text-4xl font-black text-gray-900 mb-1">{formatBs(reporte.kpis.ganancia)}</h2>
                            <p className="text-xs text-gray-400">Tu ganancia calculada (15% del total de ventas).</p>
                        </div>

                        <div className="bg-white border text-gray-800 rounded-3xl p-6 shadow-sm border-gray-100">
                            <div className="flex items-center gap-3 mb-4 text-orange-500">
                                <ShoppingBag size={20} /> <span className="font-bold uppercase tracking-wider text-xs text-gray-400">Unidades Vendidas</span>
                            </div>
                            <h2 className="text-4xl font-black mb-1 text-gray-900">{reporte.kpis.total_productos.toLocaleString()}</h2>
                            <p className="text-xs text-gray-400">Items físicos entregados o vendidos.</p>
                        </div>
                    </div>

                    {/* ── Gráficos Area ──────────────────────────────────────── */}
                    <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <Calendar size={18} className="text-indigo-500" /> Evolución de Ventas 
                        </h3>
                        {reporte.evolucion_diaria.length > 0 ? (
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={reporte.evolucion_diaria} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorGanancia" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        <XAxis dataKey="fecha" tick={{fontSize: 12, fill: '#9ca3af'}} tickMargin={10} axisLine={false} tickLine={false} />
                                        <YAxis tickFormatter={(val) => `Bs ${val}`} tick={{fontSize: 12, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                                        <Tooltip 
                                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                            formatter={(value: any) => [`Bs. ${Number(value).toFixed(2)}`, '']}
                                            labelStyle={{color: '#374151', fontWeight: 'bold', marginBottom: '4px'}}
                                        />
                                        <Legend iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 'bold'}} />
                                        <Area type="monotone" name="Total Ventas" dataKey="total_ventas" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                                        <Area type="monotone" name="Ganancia (15%)" dataKey="ganancia" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorGanancia)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-72 flex flex-col items-center justify-center text-gray-400 text-sm">
                                <BarChart3 size={32} className="mb-2 opacity-20" />
                                No hay datos de ventas en estas fechas.
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* ── Sucursales Bar Chart ──────────────────────────────── */}
                        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col">
                            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Store size={18} className="text-blue-500" /> Comparativa por Sucursales
                            </h3>
                            <div className="flex-1 min-h-[300px] w-full">
                                {reporte.por_sucursal.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={reporte.por_sucursal} margin={{top: 0, right: 0, left: 10, bottom: 20}}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                            <XAxis dataKey="sucursal" tick={{fontSize: 10, fill: '#6b7280', fontWeight: 'bold'}} axisLine={false} tickLine={false} angle={-45} textAnchor="end" />
                                            <YAxis tickFormatter={(val) => `Bs ${val}`} tick={{fontSize: 11, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                                            <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} formatter={(val: any) => `Bs. ${Number(val).toFixed(2)}`} />
                                            <Legend iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 'bold', paddingTop: '15px'}} />
                                            <Bar dataKey="total_ventas" name="Ventas Brutas" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                            <Bar dataKey="ganancia" name="Ganancia Neta" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="text-center text-gray-400 text-sm py-20">Sin datos de sucursales.</p>
                                )}
                            </div>
                        </div>

                        {/* ── Top Productos List ──────────────────────────────── */}
                        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col">
                            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Package size={18} className="text-amber-500" /> Top {reporte.top_productos.length} Productos Vendidos
                            </h3>
                            <div className="flex-1 space-y-3">
                                {reporte.top_productos.length > 0 ? (
                                    reporte.top_productos.map((prod, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-2xl hover:bg-gray-100 transition-colors">
                                            <div className="flex items-center gap-4 truncate">
                                                <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs">
                                                    #{i + 1}
                                                </div>
                                                <div className="truncate min-w-0">
                                                    <p className="font-bold text-sm text-gray-900 truncate" title={prod.producto}>{prod.producto}</p>
                                                    <p className="text-xs text-gray-500 font-medium">{prod.cantidad_vendida} Unidades</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-4">
                                                <p className="font-black text-sm text-gray-900">Bs. {prod.total_ventas.toFixed(2)}</p>
                                                <p className="text-[10px] font-bold text-emerald-600">+ Bs. {prod.ganancia.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-gray-400 text-sm py-20">Aún no hay productos vendidos.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
