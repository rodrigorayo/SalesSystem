import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHistorialCaja, getSucursales } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { 
    Calendar, Loader2, FileDown, 
    LayoutGrid, Store, Info
} from 'lucide-react';
import { getBoliviaTodayISO } from '../utils/dateUtils';
import { descargarPDFVentasCaja } from '../utils/reportPDF';

const formatBs = (num?: number) => `Bs. ${(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CashSalesSummaryView() {
    const { role } = useAuthStore();
    const esMatriz = ['SUPERADMIN', 'ADMIN', 'ADMIN_MATRIZ'].includes(role || '');
    
    // Filters
    const today = getBoliviaTodayISO();
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [selectedSucursal, setSelectedSucursal] = useState('all');

    // Queries
    const { data: sucursales = [] } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales,
        enabled: esMatriz
    });

    const { data: history, isLoading } = useQuery({
        queryKey: ['cash-sales-summary', startDate, endDate, selectedSucursal],
        queryFn: () => getHistorialCaja(startDate, endDate, 1, 1000, selectedSucursal)
    });

    const sessions = history?.items || [];

    const handleDownloadPDF = () => {
        if (!sessions.length) return;
        const sucNombre = selectedSucursal === 'all' ? 'Todas las Sucursales' : (sucursales.find(s => s._id === selectedSucursal)?.nombre || selectedSucursal);
        descargarPDFVentasCaja(sessions, startDate, endDate, sucNombre);
    };

    // Totals
    const totalVentas = sessions.reduce((acc, s) => acc + (s.total_ventas || 0), 0);
    const totalQR = sessions.reduce((acc, s) => acc + (s.total_qr || 0), 0);
    const totalEfectivo = sessions.reduce((acc, s) => acc + (s.total_efectivo + (s.total_ingresos_ef || 0) - s.total_cambio), 0);
    const totalDescuentos = sessions.reduce((acc, s) => acc + (s.total_descuentos || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-gray-900">Ventas por Caja y Día</h2>
                    <p className="text-xs text-gray-500 font-medium">Resumen financiero de sesiones de caja y cobros QR</p>
                </div>
                <button 
                    onClick={handleDownloadPDF}
                    disabled={!sessions.length}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200 disabled:opacity-50"
                >
                    <FileDown size={16} /> Descargar PDF
                </button>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                    <span className="text-gray-400 font-bold">al</span>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                </div>

                {esMatriz && (
                    <div className="flex items-center gap-2">
                        <Store size={16} className="text-gray-400" />
                        <select
                            value={selectedSucursal}
                            onChange={(e) => setSelectedSucursal(e.target.value)}
                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        >
                            <option value="all">Todas las Sucursales</option>
                            <option value="CENTRAL">Central</option>
                            {sucursales.filter(s => s.is_active).map(s => (
                                <option key={s._id} value={s._id}>{s.nombre}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="ml-auto flex items-center gap-3 flex-wrap">
                    <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-[9px] uppercase font-bold text-indigo-400 leading-none mb-1">Ventas Totales</p>
                            <p className="text-sm font-black text-indigo-900 leading-none">{formatBs(totalVentas)}</p>
                        </div>
                    </div>
                    <div className="bg-sky-50 px-4 py-2 rounded-xl border border-sky-100 flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-[9px] uppercase font-bold text-sky-400 leading-none mb-1">Total QR</p>
                            <p className="text-sm font-black text-sky-900 leading-none">{formatBs(totalQR)}</p>
                        </div>
                    </div>
                    <div className="bg-orange-50 px-4 py-2 rounded-xl border border-orange-100 flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-[9px] uppercase font-bold text-orange-500 leading-none mb-1 flex items-center gap-1 justify-end">
                                Descuentos <span title="Total de descuentos aplicados en las ventas"><Info size={9} className="text-orange-300 cursor-help" /></span>
                            </p>
                            <p className="text-sm font-black text-orange-900 leading-none">{formatBs(totalDescuentos)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[32px] border border-gray-100">
                    <Loader2 size={40} className="animate-spin text-indigo-500 mb-4" />
                    <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Cargando datos de caja...</p>
                </div>
            ) : (
                <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Fecha de Apertura</th>
                                    <th className="px-6 py-4">Sucursal</th>
                                    <th className="px-6 py-4">Cajero / Sesión</th>
                                    <th className="px-6 py-4 text-right">Ventas QR</th>
                                    <th className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            Ef. Neto <span title="Ventas Ef. + Ingresos Manuales - Vueltos"><Info size={12} className="text-gray-300 cursor-help" /></span>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            Descuentos <span title="Total de descuentos aplicados en ventas de la sesión"><Info size={12} className="text-gray-300 cursor-help" /></span>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            Total Ventas <span title="Suma de Efectivo, QR y Tarjeta"><Info size={12} className="text-gray-300 cursor-help" /></span>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {sessions.map((s: any) => (
                                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-bold text-gray-800">{new Date(s.abierta_at).toLocaleDateString('es-BO')}</div>
                                            <div className="text-[10px] text-gray-400 font-mono">
                                                {new Date(s.abierta_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-gray-600 uppercase">{sucursales.find(suc => suc._id === s.sucursal_id)?.nombre || s.sucursal_id}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-700">{s.cajero_name}</div>
                                            <div className="text-[10px] text-gray-400">ID: {s.id.slice(-6)}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-sky-600 font-bold">{formatBs(s.total_qr)}</td>
                                        <td className="px-6 py-4 text-right font-mono text-green-600 font-bold">{formatBs(s.total_efectivo + (s.total_ingresos_ef || 0) - s.total_cambio)}</td>
                                        <td className="px-6 py-4 text-right font-mono text-orange-600 font-bold">{formatBs(s.total_descuentos ?? 0)}</td>
                                        <td className="px-6 py-4 text-right font-mono text-indigo-700 font-black">{formatBs(s.total_ventas)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${s.estado === 'ABIERTA' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {s.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {sessions.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-20 text-center text-gray-400 font-medium italic">No se encontraron sesiones en este rango.</td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-gray-900 text-white font-black">
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 text-xs uppercase tracking-widest">Totales del Periodo</td>
                                    <td className="px-6 py-4 text-right font-mono text-sky-400">{formatBs(totalQR)}</td>
                                    <td className="px-6 py-4 text-right font-mono text-green-400">{formatBs(totalEfectivo)}</td>
                                    <td className="px-6 py-4 text-right font-mono text-orange-400">{formatBs(totalDescuentos)}</td>
                                    <td className="px-6 py-4 text-right font-mono text-indigo-300">{formatBs(totalVentas)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* Audit Note */}
            <div className="bg-amber-50 border border-amber-100 p-5 rounded-[24px] flex items-start gap-4">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                    <LayoutGrid size={20} />
                </div>
                <div>
                    <p className="text-xs font-bold text-amber-900 uppercase mb-1">Nota de Conciliación</p>
                    <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                        Este reporte consolida todas las sesiones de caja (abiertas y cerradas). 
                        Las ventas QR se muestran por separado ya que representan ingresos directos a banco que no pasan por el cajón físico, 
                        mientras que el Ef. Neto es el dinero real que entró al cajón (Ventas - Vueltos).
                    </p>
                </div>
            </div>
        </div>
    );
}
