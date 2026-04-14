import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getValuedInventory } from '../api/api';
import { Loader2, Package, Store, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, DollarSign, Gem, ShieldCheck } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const formatBs = (num?: number) => `Bs. ${(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ValuedInventoryView() {
    const { data: valuatedData, isLoading, isError } = useQuery({
        queryKey: ['valued-inventory'],
        queryFn: getValuedInventory,
        staleTime: 5 * 60 * 1000 // 5 minutes cache
    });

    const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({});

    const toggleBranch = (branchId: string) => {
        setExpandedBranches(prev => ({ ...prev, [branchId]: !prev[branchId] }));
    };

    if (isLoading) {
        return (
            <div className="py-32 flex flex-col items-center justify-center bg-white rounded-[32px] border border-gray-100 shadow-sm mt-6">
                <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
                <p className="text-gray-400 font-bold animate-pulse uppercase tracking-widest text-sm">Escaneando inventario y precios reales...</p>
            </div>
        );
    }

    if (isError || !valuatedData) {
        return (
            <div className="p-10 bg-red-50 text-red-600 rounded-[32px] text-center border border-red-100 italic font-medium mt-6 flex flex-col items-center justify-center">
                <AlertTriangle size={32} className="mb-2" />
                Ocurrió un error al procesar el reporte de inventario valorado.
            </div>
        );
    }

    const { total_general_fabrica, total_general_publico, ganancia_potencial, por_sucursal } = valuatedData;

    // Chart Data Preparation
    const chartData = por_sucursal.map((s: any) => ({
        name: s.sucursal_nombre,
        valorF: s.valor_total_fabrica_sucursal,
        valorP: s.valor_total_publico_sucursal
    })).sort((a: any, b: any) => b.valorF - a.valorF);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-6">
            
            {/* ── KPIs Principales ────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Fábrica */}
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-8 rounded-[32px] text-white shadow-xl shadow-indigo-200">
                    <div className="flex items-center gap-3 mb-2 opacity-80">
                        <ShieldCheck size={24} /> <span className="font-bold uppercase tracking-wider text-xs">Alineado a Costo Fábrica</span>
                    </div>
                    <h2 className="text-4xl font-black mb-2">{formatBs(total_general_fabrica)}</h2>
                    <p className="opacity-90 text-sm font-medium">Costo real de adquisición o producción. Este es tu verdadero "capital congelado".</p>
                </div>

                {/* Cliente / Público */}
                <div className="bg-white border-2 border-indigo-100 p-8 rounded-[32px] flex flex-col justify-center relative overflow-hidden group hover:border-indigo-300 transition-colors">
                    <div className="absolute -top-10 -right-10 text-indigo-50 opacity-50 group-hover:scale-110 transition-transform"><Store size={150} /></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2 text-indigo-600">
                            <DollarSign size={20} className="p-0.5 bg-indigo-100 rounded-full" /> <span className="font-bold uppercase tracking-wider text-xs text-gray-500">Valor Potencial Cliente</span>
                        </div>
                        <h2 className="text-3xl font-black mb-1 text-gray-900">{formatBs(total_general_publico)}</h2>
                        <p className="text-xs text-gray-400 font-bold">Si se vende todo, esto ingresaría a caja.</p>
                    </div>
                </div>

                {/* Ganancia Potencial */}
                <div className="bg-emerald-50 border-2 border-emerald-200 p-8 rounded-[32px] flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2 text-emerald-700">
                        <Gem size={20} className="p-0.5 bg-emerald-100 rounded-full" /> <span className="font-bold uppercase tracking-wider text-xs">Ganancia Proyectada</span>
                    </div>
                    <h2 className="text-3xl font-black mb-1 text-emerald-600">{formatBs(ganancia_potencial)}</h2>
                    <p className="text-xs text-emerald-600/70 font-bold">Diferencia neta (Público - Fábrica).</p>
                </div>

            </div>

            {/* ── Gráfico Comparativo ─────────────────────────────────────── */}
            {chartData.length > 0 && (
                <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm w-full overflow-hidden">
                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 px-2">
                        <TrendingUp size={18} className="text-indigo-500" /> Comparativa Costo vs Público (por Sucursal)
                    </h3>
                    <div className="h-[350px] w-full min-w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 'bold' }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" />
                                <YAxis tickFormatter={(val) => `Bs ${val}`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={100} />
                                <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 10px 20px -5px rgb(0 0 0 / 0.1)' }} formatter={(val: any) => `Bs. ${Number(val).toFixed(2)}`} />
                                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 'bold' }} />
                                <Bar dataKey="valorF" name="Costo (Fábrica)" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="valorP" name="Potencial (Público)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ── Lista de Sucursales ───────────────────────── */}
            <div className="space-y-6">
                <h3 className="font-black text-gray-900 text-xl pl-2">Desglose Detallado</h3>
                {por_sucursal.map((sucursal: any, index: number) => {
                    const isExpanded = expandedBranches[sucursal.sucursal_id] || (por_sucursal.length === 1);
                    return (
                        <div key={index} className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden group">
                            <button
                                onClick={() => toggleBranch(sucursal.sucursal_id)}
                                className="w-full text-left p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50/50 transition-colors gap-6"
                            >
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 rounded-[22px] bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-inner">
                                        <Store size={28} className={isExpanded ? "scale-110 transition-transform" : "transition-transform"} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-900 leading-none mb-1.5">{sucursal.sucursal_nombre}</h3>
                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md inline-block">{sucursal.total_items} items físicos en Almacén</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 md:gap-8 bg-gray-50 p-4 rounded-3xl border border-gray-100 w-full md:w-auto">
                                    <div className="text-left md:text-right flex-1 md:flex-none">
                                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">A Precio Fábrica</p>
                                        <p className="text-xl font-black text-indigo-600">{formatBs(sucursal.valor_total_fabrica_sucursal)}</p>
                                    </div>
                                    <div className="w-px h-10 bg-gray-200 hidden md:block" />
                                    <div className="text-left md:text-right flex-1 md:flex-none">
                                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">A Precio Público</p>
                                        <p className="text-xl font-black text-emerald-600">{formatBs(sucursal.valor_total_publico_sucursal)}</p>
                                    </div>
                                    <div className="bg-white border border-gray-200 p-2.5 rounded-full text-gray-400 shadow-sm group-hover:text-black transition-colors w-min ml-auto">
                                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </div>
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="border-t border-gray-100 bg-white">
                                    <div className="overflow-x-auto p-4">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-[10px] text-gray-500 font-bold uppercase tracking-widest bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-4 rounded-l-2xl">Producto</th>
                                                    <th className="px-6 py-4 text-center">Cant. Física</th>
                                                    <th className="px-6 py-4 text-right">P. Fábrica</th>
                                                    <th className="px-6 py-4 text-right">P. Público</th>
                                                    <th className="px-6 py-4 text-right bg-indigo-50/50 text-indigo-700">Total Fábrica</th>
                                                    <th className="px-6 py-4 text-right bg-emerald-50/50 text-emerald-700 rounded-r-2xl">Total Público</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {sucursal.desglose.map((item: any, i: number) => (
                                                    <tr key={i} className="hover:bg-gray-50/80 transition-colors group/row">
                                                        <td className="px-6 py-4">
                                                            <p className="font-bold text-gray-900 group-hover/row:text-indigo-600 transition-colors">{item.producto_nombre}</p>
                                                            <p className="text-xs text-gray-400 font-mono mt-0.5">#{item.producto_id.slice(-6).toUpperCase()}</p>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-black text-xs">{item.cantidad}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-medium text-gray-400">{formatBs(item.costo_unitario)}</td>
                                                        <td className="px-6 py-4 text-right font-medium text-gray-400">{formatBs(item.precio_publico_unitario)}</td>
                                                        <td className="px-6 py-4 text-right font-black text-indigo-600 bg-indigo-50/10">{formatBs(item.valor_fabrica)}</td>
                                                        <td className="px-6 py-4 text-right font-black text-emerald-600 bg-emerald-50/10">{formatBs(item.valor_publico)}</td>
                                                    </tr>
                                                ))}
                                                {sucursal.desglose.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic font-medium">
                                                            No hay stock físico registrado en esta sucursal actual.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                {por_sucursal.length === 0 && (
                    <div className="text-center py-32 bg-white rounded-[40px] border border-gray-100 shadow-sm">
                        <Package size={64} className="mx-auto text-gray-200 mb-6" />
                        <h3 className="font-black text-gray-900 text-2xl mb-2">Sin inventario físico</h3>
                        <p className="text-sm font-medium text-gray-400">No hay datos de stock en las bases de datos para analizar.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
