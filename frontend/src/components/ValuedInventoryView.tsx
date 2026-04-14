import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getValuedInventory } from '../api/api';
import { Loader2, Package, Store, TrendingUp, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const formatBs = (num?: number) => `Bs. ${(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ValuedInventoryView() {
    const { data: valuatedData, isLoading, isError } = useQuery({
        queryKey: ['valued-inventory'],
        queryFn: getValuedInventory,
        staleTime: 5 * 60 * 1000 // 5 minutes cache since it's a heavy report
    });

    const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({});

    const toggleBranch = (branchId: string) => {
        setExpandedBranches(prev => ({ ...prev, [branchId]: !prev[branchId] }));
    };

    if (isLoading) {
        return (
            <div className="py-20 flex flex-col items-center justify-center bg-white rounded-[32px] border border-gray-100 shadow-sm mt-6">
                <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
                <p className="text-gray-400 font-medium animate-pulse">Calculando inventario valorado (Costo Fábrica)...</p>
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

    const { total_general_valor, por_sucursal } = valuatedData;

    // Chart Data Preparation
    const chartData = por_sucursal.map((s: any) => ({
        name: s.sucursal_nombre,
        valor: s.valor_total_sucursal
    })).sort((a: any, b: any) => b.valor - a.valor);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-6">
            
            {/* ── KPI Principal ────────────────────────────────── */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-8 rounded-[32px] text-white shadow-xl shadow-indigo-200">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                    <Package size={24} /> <span className="font-bold uppercase tracking-wider text-sm">Capital en Stock Físico (P. Fábrica)</span>
                </div>
                <h2 className="text-5xl font-black mb-2">{formatBs(total_general_valor)}</h2>
                <p className="opacity-90 text-sm font-medium">Este es el dinero real inmovilizado en el sistema, calculado siempre a <strong className="text-white bg-indigo-800/50 px-2 py-0.5 rounded ml-1">Costo Unitario de Fábrica</strong>.</p>
            </div>

            {/* ── Gráfico ─────────────────────────────────────── */}
            {chartData.length > 0 && (
                <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <TrendingUp size={18} className="text-indigo-500" /> Capital Inmovilizado por Sucursal
                    </h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4b5563', fontWeight: 'bold' }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" />
                                <YAxis tickFormatter={(val) => `Bs ${val}`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(val: any) => `Bs. ${Number(val).toFixed(2)}`} />
                                <Bar dataKey="valor" name="Valor del Stock" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={60} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ── Lista de Sucursales ───────────────────────── */}
            <div className="space-y-4">
                {por_sucursal.map((sucursal: any, index: number) => {
                    const isExpanded = expandedBranches[sucursal.sucursal_id] || (por_sucursal.length === 1);
                    return (
                        <div key={index} className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                            <button
                                onClick={() => toggleBranch(sucursal.sucursal_id)}
                                className="w-full text-left p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                        <Store size={22} className={isExpanded ? "scale-110 transition-transform" : "transition-transform"} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-gray-900">{sucursal.sucursal_nombre}</h3>
                                        <p className="text-sm font-medium text-gray-400 mt-0.5">{sucursal.total_items} unidades en almacén</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Valorizado</p>
                                        <p className="text-2xl font-black text-indigo-600">{formatBs(sucursal.valor_total_sucursal)}</p>
                                    </div>
                                    <div className="bg-gray-100 p-2 rounded-full text-gray-400">
                                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </div>
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="border-t border-gray-100">
                                    <div className="overflow-x-auto p-4">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-400 font-bold uppercase bg-gray-50/50">
                                                <tr>
                                                    <th className="px-6 py-3 rounded-l-xl">Producto</th>
                                                    <th className="px-6 py-3 text-right">Cant. Física</th>
                                                    <th className="px-6 py-3 text-right">P. Fábrica</th>
                                                    <th className="px-6 py-3 text-right rounded-r-xl">Valor Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {sucursal.desglose.map((item: any, i: number) => (
                                                    <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                                                        <td className="px-6 py-3 font-bold text-gray-700">{item.producto_nombre} <span className="text-xs text-gray-400 ml-2 font-medium">#{item.producto_id.slice(-6).toUpperCase()}</span></td>
                                                        <td className="px-6 py-3 text-right text-gray-900 font-black">{item.cantidad}</td>
                                                        <td className="px-6 py-3 text-right font-medium text-gray-500">{formatBs(item.costo_unitario)}</td>
                                                        <td className="px-6 py-3 text-right font-black text-indigo-700">{formatBs(item.valor_total)}</td>
                                                    </tr>
                                                ))}
                                                {sucursal.desglose.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-10 text-center text-gray-400 italic font-medium">
                                                            No hay productos en el inventario de esta sucursal.
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
                    <div className="text-center py-20 bg-gray-50 rounded-[32px] border border-gray-100">
                        <Package size={40} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="font-bold text-gray-500">No hay datos de inventario.</h3>
                    </div>
                )}
            </div>
        </div>
    );
}
