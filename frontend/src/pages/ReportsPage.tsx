import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getGeneralReports } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { 
    BarChart3, Loader2, DollarSign, Package, TrendingUp, Calendar, 
    AlertTriangle, ShoppingBag, Store, Layers, Building2, Wallet
} from 'lucide-react';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
    Tooltip, BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const formatBs = (num?: number) => `Bs. ${(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type TabType = 'general' | 'sucursales' | 'finanzas' | 'canales' | 'fuerza_ventas';

export default function ReportsPage() {
    const { role } = useAuthStore();
    const [days, setDays] = useState(30);
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [selectedSucursal, setSelectedSucursal] = useState<string>('all');

    const { data: reporte, isLoading, isError } = useQuery({
        queryKey: ['reports', days],
        queryFn: () => getGeneralReports(days),
        enabled: ['SUPERADMIN', 'ADMIN', 'ADMIN_MATRIZ'].includes(role || '')
    });

    const sucursalNames = reporte ? Array.from(new Set(reporte.por_sucursal.map(s => s.sucursal))) : [];
    const filteredSucursales = reporte?.por_sucursal.filter(s => 
        selectedSucursal === 'all' || s.sucursal === selectedSucursal
    ) || [];

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
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 pb-20 md:pb-8">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><BarChart3 size={24} /></div>
                        Analítica Avanzada
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

            {/* ── Tabs Navigation ────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
                {[
                    { id: 'general', label: 'Visión General', icon: <TrendingUp size={16} /> },
                    { id: 'sucursales', label: 'Rendimiento Sucursales', icon: <Store size={16} /> },
                    { id: 'finanzas', label: 'Finanzas y Márgenes', icon: <Wallet size={16} /> },
                    { id: 'canales', label: 'Canales de Mercado', icon: <Layers size={16} /> },
                    { id: 'fuerza_ventas', label: 'Fuerza de Ventas', icon: <Building2 size={16} /> },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-xl transition-colors",
                            activeTab === tab.id 
                                ? "bg-white text-indigo-600 border-t border-x border-gray-200 shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)] translate-y-[1px]" 
                                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 border border-transparent"
                        )}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
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
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* =========================================================
                        TAB: VISION GENERAL
                    ========================================================= */}
                    {activeTab === 'general' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 col-span-1 md:col-span-2">
                                    <div className="flex items-center gap-3 mb-4 opacity-80">
                                        <DollarSign size={20} /> <span className="font-bold uppercase tracking-wider text-xs">Ventas Públicas (Bruto)</span>
                                    </div>
                                    <h2 className="text-4xl font-black mb-1">{formatBs(reporte.kpis.total_ventas)}</h2>
                                    <p className="text-xs opacity-70">Dinero total recolectado en las cajas en los últimos {days} días.</p>
                                </div>
                                
                                <div className="bg-white border-2 border-emerald-100 rounded-3xl p-6 shadow-sm">
                                    <div className="flex items-center gap-3 mb-4 text-emerald-600">
                                        <TrendingUp size={20} /> <span className="font-bold uppercase tracking-wider text-xs">Margen Matriz</span>
                                    </div>
                                    <h2 className="text-3xl font-black text-gray-900 mb-1">{formatBs(reporte.kpis.ganancia_matriz)}</h2>
                                    <p className="text-xs text-gray-400 font-medium">Utilidad neta para Distribución central.</p>
                                </div>

                                <div className="bg-white border text-gray-800 rounded-3xl p-6 shadow-sm border-gray-100">
                                    <div className="flex items-center gap-3 mb-4 text-orange-500">
                                        <ShoppingBag size={20} /> <span className="font-bold uppercase tracking-wider text-xs text-gray-400">Items Entregados</span>
                                    </div>
                                    <h2 className="text-3xl font-black mb-1 text-gray-900">{(reporte.kpis.total_productos || 0).toLocaleString()}</h2>
                                    <p className="text-xs text-gray-400 font-medium">Unidades físicas procesadas.</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
                                <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <Calendar size={18} className="text-indigo-500" /> Evolución de Ventas 
                                </h3>
                                {reporte.evolucion_diaria.length > 0 ? (
                                    <div className="w-full">
                                        <ResponsiveContainer width="100%" height={300}>
                                            <AreaChart data={reporte.evolucion_diaria} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
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
                                                <Area type="monotone" name="Ingresos Brutos" dataKey="total_ventas" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="h-72 flex flex-col items-center justify-center text-gray-400 text-sm">
                                        <BarChart3 size={32} className="mb-2 opacity-20" /> No hay datos en estas fechas.
                                    </div>
                                )}
                            </div>

                            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col">
                                <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <Package size={18} className="text-amber-500" /> Top {reporte.top_productos.length} Productos Más Vendidos
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {reporte.top_productos.length > 0 ? (
                                        reporte.top_productos.map((prod, i) => (
                                            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                                                <div className="flex items-center gap-4 truncate">
                                                    <div className="w-10 h-10 shrink-0 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-sm">
                                                        #{i + 1}
                                                    </div>
                                                    <div className="truncate min-w-0">
                                                        <p className="font-bold text-sm text-gray-900 truncate" title={prod.producto}>{prod.producto}</p>
                                                        <p className="text-xs text-gray-500 font-medium">{prod.cantidad_vendida} Unidades • Bruto: Bs. {(prod.total_ventas || 0).toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center text-gray-400 text-sm py-10 col-span-2">Aún no hay productos vendidos.</p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* =========================================================
                        TAB: SUCURSALES
                    ========================================================= */}
                    {activeTab === 'sucursales' && (
                        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <Store size={18} className="text-blue-500" /> Desempeño por Sucursal
                                </h3>
                                
                                <div className="flex flex-wrap gap-2 items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
                                    <button 
                                        onClick={() => setSelectedSucursal('all')}
                                        className={cn(
                                            "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                                            selectedSucursal === 'all' ? "bg-white text-indigo-600 shadow-sm border border-indigo-100" : "text-gray-500 hover:text-gray-900"
                                        )}>
                                        Todas
                                    </button>
                                    {sucursalNames.map(name => (
                                        <button 
                                            key={name}
                                            onClick={() => setSelectedSucursal(name)}
                                            className={cn(
                                                "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                                                selectedSucursal === name ? "bg-white text-indigo-600 shadow-sm border border-indigo-100" : "text-gray-500 hover:text-gray-900"
                                            )}>
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="w-full mt-4">
                                {filteredSucursales.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart data={filteredSucursales} margin={{top: 20, right: 30, left: 20, bottom: 60}}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                            <XAxis dataKey="sucursal" tick={{fontSize: 12, fill: '#4b5563', fontWeight: 'bold'}} axisLine={false} tickLine={false} angle={-45} textAnchor="end" />
                                            <YAxis tickFormatter={(val) => `Bs ${val}`} tick={{fontSize: 11, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                                            <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} formatter={(val: any) => `Bs. ${Number(val).toFixed(2)}`} />
                                            <Legend iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 'bold', paddingTop: '20px'}} />
                                            <Bar dataKey="total_ventas" name="Venta Total al Público" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                            <Bar dataKey="ganancia_matriz" name="Ganancia Matriz Exclusiva" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                            <Bar dataKey="ganancia_sucursal" name="Margen Retenido Sucursal" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="text-center text-gray-400 text-sm py-20">Sin datos de sucursales en este periodo.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* =========================================================
                        TAB: FINANZAS Y MARGENES (ESTADO DE RESULTADOS)
                    ========================================================= */}
                    {activeTab === 'finanzas' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white rounded-3xl p-8 border border-gray-200">
                                    <h3 className="text-lg font-black text-gray-900 mb-6 border-b pb-4">Estado de Resultados (Simulación)</h3>
                                    
                                    <div className="space-y-4 text-sm">
                                        <div className="flex justify-between font-bold text-gray-900 text-base">
                                            <span>(+) Ingresos Brutos (Ventas a Público)</span>
                                            <span>{formatBs(reporte.kpis.total_ventas)}</span>
                                        </div>
                                        <div className="flex justify-between text-red-500 border-b pb-4">
                                            <span>(-) Costo de Mercadería Vendida (Fábrica)</span>
                                            <span>{formatBs((reporte.kpis.total_ventas || 0) - ((reporte.kpis.ganancia_matriz || 0) + (reporte.kpis.ganancia_sucursal || 0)))}</span>
                                        </div>
                                        
                                        <div className="flex justify-between font-bold text-indigo-700 text-base pt-2">
                                            <span>(=) Margen Bruto Global</span>
                                            <span>{formatBs((reporte.kpis.ganancia_matriz || 0) + (reporte.kpis.ganancia_sucursal || 0))}</span>
                                        </div>

                                        <div className="my-6 border-t border-gray-100"></div>
                                        
                                        <h4 className="font-bold text-gray-400 text-xs tracking-wider uppercase mb-2">Distribución de Utilidades</h4>
                                        <div className="flex justify-between text-emerald-600 font-bold bg-emerald-50 p-3 rounded-xl">
                                            <span>🏢 Utilidad retenida matriz (Distribución)</span>
                                            <span>{formatBs(reporte.kpis.ganancia_matriz)}</span>
                                        </div>
                                        <div className="flex justify-between text-blue-600 font-bold bg-blue-50 p-3 rounded-xl mt-2">
                                            <span>🏪 Utilidad retenida local (Sucursales)</span>
                                            <span>{formatBs(reporte.kpis.ganancia_sucursal)}</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-6 mt-4">Nota: Los costos se infieren en base a la escalera de precios B2B y Distribución según proporciones vigentes (Fábrica~72%, Matriz~13%, Sucursal~15%).</p>
                                </div>
                                
                                <div className="bg-white rounded-3xl p-8 border border-gray-200 flex flex-col items-center justify-center">
                                    <h3 className="text-lg font-black text-gray-900 mb-2 text-center w-full">Distribución del Dinero por Venta</h3>
                                    <div className="w-full mt-6">
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Costo Fábrica (Producción)', value: (reporte.kpis.total_ventas || 0) - ((reporte.kpis.ganancia_matriz || 0) + (reporte.kpis.ganancia_sucursal || 0)) },
                                                        { name: 'Utilidad Matriz (Logística)', value: reporte.kpis.ganancia_matriz || 0 },
                                                        { name: 'Utilidad Sucursal (Retail)', value: reporte.kpis.ganancia_sucursal || 0 }
                                                    ]}
                                                    cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                                                >
                                                    <Cell fill="#fca5a5" />
                                                    <Cell fill="#10b981" />
                                                    <Cell fill="#3b82f6" />
                                                </Pie>
                                                <Tooltip formatter={(value) => `Bs. ${Number(value).toFixed(2)}`} />
                                                <Legend wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* =========================================================
                        TAB: CANALES Y FUERZA DE VENTAS (PROXIMAS FASES)
                    ========================================================= */}
                    {(activeTab === 'canales' || activeTab === 'fuerza_ventas') && (
                        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center flex flex-col items-center max-w-2xl mx-auto mt-10">
                            {activeTab === 'canales' ? <Layers size={48} className="text-indigo-300 mb-4" /> : <Building2 size={48} className="text-indigo-300 mb-4" />}
                            <h3 className="text-2xl font-black text-gray-900 mb-2">Módulo en Desarrollo</h3>
                            <p className="text-gray-500 mb-6">
                                {activeTab === 'canales' 
                                    ? "Actualmente todas las ventas históricas fluyen a través de la caja registradora de Tienda Física. Pronto el sistema soportará la facturación separada de Instituciones (B2B) y Colportores, y los verás reflejados aquí."
                                    : "Próximamente podrás visualizar el ranking y cumplimiento de cuotas de cada vendedor de la calle (La Paz) asignado a sus zonas."}
                            </p>
                            <div className="bg-indigo-50 text-indigo-700 px-6 py-3 rounded-full text-sm font-bold flex items-center gap-2">
                                <Loader2 size={16} className="animate-spin" /> Preparando base de datos
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
