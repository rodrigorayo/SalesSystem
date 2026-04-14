import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getValuedInventory } from '../api/api';
import { Loader2, Package, Store, AlertTriangle, ChevronDown, ChevronUp, DollarSign, Gem, ShieldCheck, Tag } from 'lucide-react';

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

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-6">
            
            {/* ── KPIs Principales ────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Fábrica */}
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-8 rounded-[32px] text-white shadow-xl shadow-indigo-200">
                    <div className="flex items-center gap-3 mb-2 opacity-80">
                        <ShieldCheck size={24} /> <span className="font-bold uppercase tracking-wider text-xs">Costo Inmovilizado</span>
                    </div>
                    <h2 className="text-4xl font-black mb-2">{formatBs(total_general_fabrica)}</h2>
                    <p className="opacity-90 text-[11px] font-medium leading-tight">Valor real (precio costo) del stock actual que se encuentra guardado o en vitrina.</p>
                </div>

                {/* Cliente / Público */}
                <div className="bg-white border text-gray-800 p-8 rounded-[32px] flex flex-col justify-center relative overflow-hidden group hover:border-gray-300 transition-colors">
                    <div className="absolute -top-6 -right-6 text-gray-50 opacity-40 group-hover:scale-110 transition-transform"><Store size={150} /></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2 text-indigo-600">
                            <DollarSign size={20} className="p-1 bg-indigo-50 text-indigo-600 rounded-full" /> <span className="font-bold uppercase tracking-wider text-[10px] text-gray-500">Valor Esperado Cliente</span>
                        </div>
                        <h2 className="text-3xl font-black mb-1">{formatBs(total_general_publico)}</h2>
                        <p className="text-[11px] text-gray-400 font-bold leading-tight">Si se vende todo el inventario hoy al precio de venta asignado a público.</p>
                    </div>
                </div>

                {/* Ganancia Potencial */}
                <div className="bg-emerald-50 border-2 border-emerald-100 p-8 rounded-[32px] flex flex-col justify-center relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2 text-emerald-700">
                            <Gem size={20} className="p-1 bg-emerald-100 text-emerald-700 rounded-full" /> <span className="font-bold uppercase tracking-wider text-[10px]">Brecha de Ganancia</span>
                        </div>
                        <h2 className="text-3xl font-black mb-1 text-emerald-600">{formatBs(ganancia_potencial)}</h2>
                        <p className="text-[11px] text-emerald-600/70 font-bold leading-tight">Total de Rentabilidad (Público - Costo).</p>
                    </div>
                </div>

            </div>

            {/* ── Lista de Sucursales (Resumida) ───────────────────────── */}
            <div className="space-y-4">
                {por_sucursal.map((sucursal: any, index: number) => {
                    const isExpanded = expandedBranches[sucursal.sucursal_id] || (por_sucursal.length === 1);
                    
                    // Solo mantenemos el TOP 10 de productos más caros dentro del inventario para no saturar.
                    const productosOrdenados = [...sucursal.desglose].sort((a: any, b: any) => b.valor_fabrica - a.valor_fabrica);
                    const topItems = productosOrdenados.slice(0, 15);
                    const hasMore = productosOrdenados.length > 15;

                    return (
                        <div key={index} className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden group">
                            <button
                                onClick={() => toggleBranch(sucursal.sucursal_id)}
                                className="w-full text-left px-8 py-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50/50 transition-colors gap-6"
                            >
                                <div className="flex flex-col">
                                    <h3 className="text-2xl font-black text-gray-900 leading-none mb-2 flex items-center gap-2">
                                        <Store className="text-indigo-400" size={24} /> {sucursal.sucursal_nombre}
                                    </h3>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 inline-flex items-center gap-1.5"><Package size={14}/> {sucursal.total_items} articulos</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 md:gap-8 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100 w-full md:w-auto">
                                    <div className="text-left md:text-right flex-1 md:flex-none">
                                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Base P.Costo</p>
                                        <p className="text-base font-black text-indigo-600">{formatBs(sucursal.valor_total_fabrica_sucursal)}</p>
                                    </div>
                                    <div className="w-px h-8 bg-gray-200 hidden md:block" />
                                    <div className="text-left md:text-right flex-1 md:flex-none">
                                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Base P.Venta</p>
                                        <p className="text-base font-black text-emerald-600">{formatBs(sucursal.valor_total_publico_sucursal)}</p>
                                    </div>
                                    <div className="bg-white border border-gray-200 p-2 rounded-full text-gray-400 shadow-sm group-hover:text-black group-hover:bg-gray-100 transition-colors w-min ml-auto">
                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </div>
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="border-t border-gray-100 bg-white">
                                    <div className="overflow-x-auto p-4 md:p-6 pb-8">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">
                                            <Tag size={14} /> Resumen: TOP {topItems.length} items de mayor valor en esta sucursal
                                        </div>
                                        <div className="border border-gray-100 rounded-2xl overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-50 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-5 py-3">Referencia</th>
                                                        <th className="px-5 py-3 text-center">Unidades</th>
                                                        <th className="px-5 py-3 text-right">P. Costo</th>
                                                        <th className="px-5 py-3 text-right">P. Público</th>
                                                        <th className="px-5 py-3 text-right text-indigo-700 bg-indigo-50/30">Total Costo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {topItems.map((item: any, i: number) => (
                                                        <tr key={i} className="hover:bg-gray-50/50 transition-colors group/row">
                                                            <td className="px-5 py-2.5">
                                                                <p className="font-bold text-gray-800 text-[13px]">{item.producto_nombre}</p>
                                                                <p className="text-[10px] text-gray-400 font-mono mt-0.5">#{item.producto_id.slice(-6).toUpperCase()}</p>
                                                            </td>
                                                            <td className="px-5 py-2.5 text-center">
                                                                <span className="bg-gray-100/80 text-gray-600 px-2.5 py-1 rounded-md font-black text-xs">{item.cantidad}</span>
                                                            </td>
                                                            <td className="px-5 py-2.5 text-right font-medium text-gray-400 text-xs">{formatBs(item.costo_unitario)}</td>
                                                            <td className="px-5 py-2.5 text-right font-medium text-gray-400 text-xs">{formatBs(item.precio_publico_unitario)}</td>
                                                            <td className="px-5 py-2.5 text-right font-black text-indigo-600 bg-indigo-50/10 text-[13px]">{formatBs(item.valor_fabrica)}</td>
                                                        </tr>
                                                    ))}
                                                    {sucursal.desglose.length === 0 && (
                                                        <tr>
                                                            <td colSpan={5} className="px-5 py-8 text-center text-gray-400 italic font-medium">
                                                                Vacío (Sin productos).
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                            {hasMore && (
                                                <div className="bg-gray-50 py-3 text-center text-xs font-bold text-indigo-600 border-t border-gray-100">
                                                    + {productosOrdenados.length - 15} productos de menor valor omitidos del resumen.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                {por_sucursal.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-[40px] border border-gray-100 shadow-sm">
                        <Package size={48} className="mx-auto text-gray-200 mb-4" />
                        <h3 className="font-black text-gray-900 text-xl">Sin inventario</h3>
                        <p className="text-sm font-medium text-gray-400">No hay datos de stock para calcular.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
