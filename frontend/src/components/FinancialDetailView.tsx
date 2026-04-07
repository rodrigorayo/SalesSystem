import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFinancialReport, getSucursales } from '../api/api';
import { 
    Loader2, Calendar, Store, TrendingUp, DollarSign, 
    Download
} from 'lucide-react';
import { getBoliviaTodayISO } from '../utils/dateUtils';

import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
    Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts';

const formatBs = (num?: number) => `Bs. ${(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FinancialDetailView() {
    const today = getBoliviaTodayISO();
    const sevenDaysAgo = (() => {
        const d = new Date(today);
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    })();
    
    const [startDate, setStartDate] = useState(sevenDaysAgo);
    const [endDate, setEndDate] = useState(today);
    const [selectedSucursal, setSelectedSucursal] = useState('all');

    const { data: sucursales } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales
    });

    const { data: report, isLoading, isError } = useQuery({
        queryKey: ['financial-report', startDate, endDate, selectedSucursal],
        queryFn: () => getFinancialReport(startDate, endDate, selectedSucursal),
        enabled: !!startDate && !!endDate
    });

    const totals = report?.reduce((acc: any, curr: any) => ({
        total_publico: acc.total_publico + curr.total_publico,
        total_fabrica: acc.total_fabrica + curr.total_fabrica,
        margen_distribuidor: acc.margen_distribuidor + curr.margen_distribuidor,
        margen_retail: acc.margen_retail + curr.margen_retail,
        margen_total: acc.margen_total + curr.margen_total,
    }), {
        total_publico: 0, total_fabrica: 0, margen_distribuidor: 0, margen_retail: 0, margen_total: 0
    });

    return (
        <div className="space-y-6">
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
                    onClick={() => window.print()}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                    <Download size={18} /> Exportar PDF
                </button>
            </div>

            {isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center bg-white rounded-[32px] border border-gray-100">
                    <Loader2 size={40} className="animate-spin text-indigo-500 mb-4" />
                    <p className="text-gray-400 font-medium animate-pulse">Calculando márgenes detallados...</p>
                </div>
            ) : isError ? (
                <div className="p-10 bg-red-50 text-red-600 rounded-[32px] text-center border border-red-100 italic font-medium">
                    Ocurrió un error al procesar el reporte financiero.
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                    
                    {/* ── KPI Grid Summary ────────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ventas Públicas</p>
                            <h3 className="text-2xl font-black text-gray-900">{formatBs(totals?.total_publico)}</h3>
                        </div>
                        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Comisión Matriz (15%)</p>
                            <h3 className="text-2xl font-black text-emerald-600">{formatBs(totals?.margen_distribuidor)}</h3>
                        </div>
                        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Margen Retail</p>
                            <h3 className="text-2xl font-black text-blue-600">{formatBs(totals?.margen_retail)}</h3>
                        </div>
                        <div className="bg-indigo-600 p-6 rounded-[32px] shadow-xl shadow-indigo-100 text-white">
                            <p className="text-[10px] font-black opacity-80 uppercase tracking-widest mb-1">Margen Neto Total</p>
                            <h3 className="text-2xl font-black">{formatBs(totals?.margen_total)}</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Area Chart: Evolution */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-black text-gray-900 mb-6 flex items-center gap-2">
                                <TrendingUp size={16} className="text-indigo-500" /> Evolución de Márgenes
                            </h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={report}>
                                        <defs>
                                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.1}/>
                                                <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} tickFormatter={(v) => `Bs. ${v}`} />
                                        <Tooltip 
                                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                                            formatter={(value) => `Bs. ${Number(value).toFixed(2)}`}
                                        />
                                        <Legend verticalAlign="top" height={36}/>
                                        <Area type="monotone" dataKey="margen_total" name="Margen Total" stroke="#818cf8" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={3} />
                                        <Area type="monotone" dataKey="margen_distribuidor" name="Comisión Matriz" stroke="#10b981" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Pie Chart: Distribution */}
                        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col items-center">
                            <h3 className="text-sm font-black text-gray-900 mb-6 text-center w-full">Distribución del Dinero</h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Costo Fábrica', value: totals?.total_fabrica || 0 },
                                                { name: 'Utilidad Matriz', value: totals?.margen_distribuidor || 0 },
                                                { name: 'Utilidad Sucursal', value: totals?.margen_retail || 0 }
                                            ]}
                                            cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                                        >
                                            <Cell fill="#fca5a5" />
                                            <Cell fill="#10b981" />
                                            <Cell fill="#3b82f6" />
                                        </Pie>
                                        <Tooltip formatter={(value) => `Bs. ${Number(value).toFixed(2)}`} />
                                        <Legend verticalAlign="bottom" wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* ── Main Data Table ───────────────────────────────────── */}
                    <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                            <h3 className="font-black text-gray-900 flex items-center gap-2">
                                <TrendingUp size={20} className="text-indigo-500" /> Detalle de Utilidades por Jornada
                            </h3>
                            <div className="text-[11px] font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full uppercase">
                                {startDate} al {endDate}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Fecha</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Sucursal</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Venta Cliente</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Costo Fábrica</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-emerald-500 uppercase tracking-widest border-b border-gray-100">Utilidad 15%</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-blue-500 uppercase tracking-widest border-b border-gray-100">Margen Retail</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-900 uppercase tracking-widest border-b border-gray-100">Margen Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report?.map((row: any, i: number) => (
                                        <tr key={i} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-8 bg-gray-200 rounded-full group-hover:bg-indigo-400 transition-colors" />
                                                    <span className="text-sm font-bold text-gray-700">{row.fecha}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-gray-500">{row.sucursal_nombre}</td>
                                            <td className="px-6 py-4 text-right text-sm font-black text-gray-900">{formatBs(row.total_publico)}</td>
                                            <td className="px-6 py-4 text-right text-sm font-bold text-gray-400">{formatBs(row.total_fabrica)}</td>
                                            <td className="px-6 py-4 text-right text-sm font-black text-emerald-600 bg-emerald-50/30">{formatBs(row.margen_distribuidor)}</td>
                                            <td className="px-6 py-4 text-right text-sm font-black text-blue-600 bg-blue-50/30">{formatBs(row.margen_retail)}</td>
                                            <td className="px-6 py-4 text-right text-sm font-black text-indigo-700">{formatBs(row.margen_total)}</td>
                                        </tr>
                                    ))}
                                    {report?.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-20 text-center text-gray-400 italic text-sm">
                                                No se encontraron transacciones para el filtro seleccionado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {report && report.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-900 text-white font-black uppercase tracking-tighter shadow-inner">
                                            <td colSpan={2} className="px-6 py-5 rounded-bl-[32px]">TOTALES DEL PERIODO</td>
                                            <td className="px-6 py-5 text-right">{formatBs(totals?.total_publico)}</td>
                                            <td className="px-6 py-5 text-right text-gray-400 font-bold">{formatBs(totals?.total_fabrica)}</td>
                                            <td className="px-6 py-5 text-right text-emerald-400">{formatBs(totals?.margen_distribuidor)}</td>
                                            <td className="px-6 py-5 text-right text-blue-400">{formatBs(totals?.margen_retail)}</td>
                                            <td className="px-6 py-5 text-right text-indigo-400 rounded-br-[32px]">{formatBs(totals?.margen_total)}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>

                    {/* ── Footer / Printing Disclaimer ──────────────────────── */}
                    <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-center gap-4 text-indigo-700 text-sm italic font-medium">
                        <div className="p-2 bg-white rounded-full"><DollarSign size={20} /></div>
                        El Margen Retail se calcula como: [Venta Público] - ([Costo Fábrica] * 1.15). El Margen Distribuidor es el 15% retenido sobre el precio de fábrica. El Margen Total es la utilidad bruta proyectada del periodo.
                    </div>
                </div>
            )}
        </div>
    );
}
