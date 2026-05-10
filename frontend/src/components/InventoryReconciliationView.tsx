import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { client, getSucursales } from '../api/api';
import { 
    Loader2, Calendar, Store, Scale, AlertTriangle, Info, TrendingUp, Download
} from 'lucide-react';
import { getBoliviaTodayISO } from '../utils/dateUtils';
import html2canvas from 'html2canvas';

const formatBs = (num?: number) => `Bs. ${(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ReconciliationData {
    ingresos_inventario_costo: number;
    salidas_mermas_costo: number;
    costo_ventas: number;
    ventas_netas: number;
    ganancia_bruta: number;
    inventario_final_costo: number;
}

export default function InventoryReconciliationView() {
    const today = getBoliviaTodayISO();
    const sevenDaysAgo = (() => {
        const d = new Date(today);
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    })();
    
    const [searchParams, setSearchParams] = useSearchParams();
    
    const startDate = searchParams.get('rec_start') || sevenDaysAgo;
    const endDate = searchParams.get('rec_end') || today;
    const selectedSucursal = searchParams.get('rec_sucursal') || 'all';

    const setStartDate = (val: string) => { const p = new URLSearchParams(searchParams); p.set('rec_start', val); setSearchParams(p); };
    const setEndDate = (val: string) => { const p = new URLSearchParams(searchParams); p.set('rec_end', val); setSearchParams(p); };
    const setSelectedSucursal = (val: string) => { const p = new URLSearchParams(searchParams); p.set('rec_sucursal', val); setSearchParams(p); };

    const { data: sucursales } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales
    });

    const { data: report, isLoading, isError } = useQuery({
        queryKey: ['conciliacion', startDate, endDate, selectedSucursal],
        queryFn: () => client<ReconciliationData>(`/reports/conciliacion-inventario?start_date=${startDate}&end_date=${endDate}&sucursal_id=${selectedSucursal}`),
        enabled: !!startDate && !!endDate
    });

    const handleDownloadImg = async () => {
        const el = document.getElementById('conciliacion-card');
        if (!el) return;
        const canvas = await html2canvas(el, { scale: 2 });
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `Auditoria_Inventario_${selectedSucursal}_${today}.png`;
        a.click();
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ── Filter Controls ───────────────────────────────────── */}
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-wrap gap-4 items-end print:hidden">
                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Fecha Inicio</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-gray-50 border border-gray-100 rounded-xl py-2 pl-10 pr-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Fecha Fin</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-gray-50 border border-gray-100 rounded-xl py-2 pl-10 pr-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                </div>

                <div className="space-y-1.5 grow max-w-xs">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Sucursal</label>
                    <div className="relative">
                        <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select 
                            value={selectedSucursal}
                            onChange={(e) => setSelectedSucursal(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-2 pl-10 pr-4 text-sm font-bold text-gray-700 outline-none appearance-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="all">Todas las Sucursales</option>
                            {sucursales?.map((s: any) => (
                                <option key={s._id} value={s._id}>{s.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <button 
                    onClick={handleDownloadImg}
                    className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 ml-auto"
                >
                    <Download size={18} /> Exportar Imagen
                </button>
            </div>

            {isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center bg-white rounded-[32px] border border-gray-100">
                    <Loader2 size={40} className="animate-spin text-indigo-500 mb-4" />
                    <p className="text-gray-400 font-medium animate-pulse">Cruzando bases de datos de inventario y caja...</p>
                </div>
            ) : isError || !report ? (
                <div className="p-10 bg-red-50 text-red-600 rounded-[32px] text-center border border-red-100 italic font-medium">
                    Ocurrió un error al procesar la conciliación. Intenta acortar el rango de fechas.
                </div>
            ) : (
                <div id="conciliacion-card" className="bg-white p-8 rounded-[32px] border border-gray-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                    
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                                <Scale className="text-indigo-600" /> Auditoría: Inventario vs Caja
                            </h2>
                            <p className="text-gray-500 mt-1">Del {startDate} al {endDate}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Sucursal</p>
                            <p className="text-lg font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg inline-block">
                                {selectedSucursal === 'all' ? 'Consolidado Global' : sucursales?.find(s => s._id === selectedSucursal)?.nombre}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* ── Columna 1: Análisis de Inventario ────────────────────────────────── */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-400 uppercase tracking-widest text-xs flex items-center gap-2">
                                <Store size={14} /> 1. Movimientos Físicos (Valor al Costo)
                            </h3>
                            
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600 font-medium">Ingresos a Inventario (Pedidos, Compras)</span>
                                    <span className="font-bold text-gray-900">{formatBs(report.ingresos_inventario_costo)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm text-red-600">
                                    <span className="font-medium flex items-center gap-1">(-) Mermas y Salidas Manuales <div title="Mercadería retirada sin cobrar"><Info size={14} className="opacity-50" /></div></span>
                                    <span className="font-bold">-{formatBs(report.salidas_mermas_costo)}</span>
                                </div>
                                <div className="h-px bg-gray-200 my-2"></div>
                                <div className="flex justify-between items-center text-sm text-indigo-700">
                                    <span className="font-bold">Costo de Ventas (Salió por Caja)</span>
                                    <span className="font-black">-{formatBs(report.costo_ventas)}</span>
                                </div>
                            </div>

                            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex justify-between items-center">
                                <div>
                                    <span className="text-blue-800 font-bold block">Inventario Final Actual</span>
                                    <span className="text-[11px] text-blue-600">Costo total del stock físico hoy</span>
                                </div>
                                <span className="font-black text-blue-900 text-xl">{formatBs(report.inventario_final_costo)}</span>
                            </div>
                        </div>

                        {/* ── Columna 2: Análisis Financiero (Caja) ────────────────────────────── */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-400 uppercase tracking-widest text-xs flex items-center gap-2">
                                <TrendingUp size={14} /> 2. Rendimiento Financiero
                            </h3>

                            <div className="bg-indigo-600 text-white p-5 rounded-2xl shadow-lg shadow-indigo-200">
                                <span className="text-indigo-200 font-bold uppercase tracking-widest text-[10px] block mb-1">Total Ingresos en Caja (Ventas Netas)</span>
                                <span className="font-black text-4xl">{formatBs(report.ventas_netas)}</span>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border-2 border-dashed border-gray-200 space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600 font-bold">Ventas Netas</span>
                                    <span className="font-bold text-gray-900">{formatBs(report.ventas_netas)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm text-red-500">
                                    <span className="font-medium">(-) Costo de la Mercadería Vendida</span>
                                    <span className="font-bold">-{formatBs(report.costo_ventas)}</span>
                                </div>
                                <div className="h-px bg-gray-200 my-2"></div>
                                <div className="flex justify-between items-center text-lg text-emerald-600">
                                    <span className="font-black uppercase tracking-wide">Ganancia Bruta</span>
                                    <span className="font-black">{formatBs(report.ganancia_bruta)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Alertas Automáticas */}
                    {report.salidas_mermas_costo > 0 && (
                        <div className="mt-6 bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 items-start text-amber-800 text-sm">
                            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                            <div>
                                <strong>Atención:</strong> Tuviste salidas de inventario o mermas por un valor al costo de {formatBs(report.salidas_mermas_costo)} que no generaron ingresos en caja. Esta mercadería "perdida" afecta tu rentabilidad final.
                            </div>
                        </div>
                    )}

                    <div className="mt-8 text-center text-xs text-gray-400">
                        * El costo de ventas se calcula basándose en el "Costo Unitario" registrado en el Kárdex al momento exacto de la venta.<br/>
                        Generado el {new Date().toLocaleString()}
                    </div>
                </div>
            )}
        </div>
    );
}
