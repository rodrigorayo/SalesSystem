import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getAnulacionesReport, getSucursales } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { 
    Ban, CalendarDays, Loader2, Search, Store, ArrowRight, ShieldAlert,
    AlertTriangle, ScrollText
} from 'lucide-react';
import { formatFullDate as formatDate } from '../utils/dateUtils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const MOTIVOS: Record<string, string> = {
    'ERROR_COBRO': 'Error de método de cobro',
    'DEVOLUCION_CLIENTE': 'Devolución de cliente',
    'PRODUCTO_DEFECTUOSO': 'Producto defectuoso',
    'VENTA_DUPLICADA': 'Venta duplicada',
    'OTRO': 'Otro motivo'
};

export default function AnulacionesReportView() {
    const navigate = useNavigate();
    const { role, user } = useAuthStore();
    const esMatriz = ['SUPERADMIN', 'ADMIN', 'ADMIN_MATRIZ'].includes(role || '');

    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedSucursal, setSelectedSucursal] = useState<string>(esMatriz ? 'all' : (user?.sucursal_id || 'all'));
    const [searchTerm, setSearchTerm] = useState('');

    const { data: sucursales = [] } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales,
        enabled: esMatriz
    });

    const { data: anulaciones, isLoading } = useQuery({
        queryKey: ['reporte-anulaciones', startDate, endDate, selectedSucursal],
        queryFn: () => getAnulacionesReport(startDate, endDate, selectedSucursal),
        enabled: !!startDate && !!endDate
    });

    const filteredData = (anulaciones || []).filter((item: any) => 
        item._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.cashier_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.motivo_anulacion || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalAnulaciones = filteredData.length;
    const montoTotal = filteredData.reduce((sum: number, item: any) => sum + item.total, 0);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Filtros */}
            <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100">
                <div className="flex flex-col lg:flex-row gap-4 items-end justify-between">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                <CalendarDays size={12} /> Rango de Fechas
                            </label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="date" 
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl px-3 py-2 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all"
                                />
                                <span className="text-gray-400 font-bold uppercase text-[10px]">AL</span>
                                <input 
                                    type="date" 
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl px-3 py-2 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all"
                                />
                            </div>
                        </div>

                        {esMatriz && (
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                    <Store size={12} /> Sucursal
                                </label>
                                <select
                                    value={selectedSucursal}
                                    onChange={e => setSelectedSucursal(e.target.value)}
                                    className="bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl px-3 py-2.5 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all min-w-[160px]"
                                >
                                    <option value="all">Todas las Sucursales</option>
                                    <option value="CENTRAL">Almacén Central</option>
                                    {sucursales.map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                                </select>
                            </div>
                        )}
                        
                        <div className="w-full lg:w-64 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar ticket, cajero o motivo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 text-gray-900 border border-gray-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 rounded-xl outline-none text-sm font-medium transition-all"
                            />
                        </div>
                    </div>
                    
                    <div className="flex gap-4 text-right">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Tickets</p>
                            <p className="text-xl font-black text-gray-900">{totalAnulaciones}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Monto Revertido</p>
                            <p className="text-xl font-black text-red-600">Bs. {montoTotal.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col justify-center items-center py-20">
                        <Loader2 size={40} className="animate-spin text-red-500 mb-4" />
                        <p className="text-gray-400 font-medium animate-pulse">Recopilando registros de auditoría...</p>
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50/50">
                        <ShieldAlert size={48} className="mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500 font-medium">No se encontraron ventas anuladas en este periodo.</p>
                        <p className="text-xs text-gray-400 mt-2">¡Todo parece estar en orden!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100">
                                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ticket</th>
                                    {esMatriz && <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sucursal</th>}
                                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cajero / Autorizador</th>
                                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Motivo de Anulación</th>
                                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Monto (Bs)</th>
                                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredData.map((item: any) => (
                                    <tr key={item._id} className="hover:bg-red-50/30 transition-colors group">
                                        <td className="p-4 align-top">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                                    <Ban size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">#{item._id.slice(-6).toUpperCase()}</p>
                                                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(item.created_at)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {esMatriz && (
                                            <td className="p-4 align-top">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-[11px] font-bold uppercase tracking-wider">
                                                    <Store size={10} /> {item.sucursal_nombre}
                                                </span>
                                            </td>
                                        )}
                                        <td className="p-4 align-top">
                                            <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                                                <ScrollText size={12} className="text-gray-400" /> {item.cashier_name}
                                            </p>
                                            <p className="text-[10px] font-bold text-red-600 mt-1 uppercase tracking-wider flex items-center gap-1">
                                                <AlertTriangle size={10} /> Autorizó: {item.anulada_por_nombre}
                                            </p>
                                        </td>
                                        <td className="p-4 align-top max-w-[250px]">
                                            <p className="text-sm font-bold text-gray-900">{MOTIVOS[item.motivo_anulacion] || item.motivo_anulacion}</p>
                                            {item.notas_anulacion && (
                                                <p className="text-[11px] text-gray-500 mt-1 leading-snug line-clamp-2 group-hover:line-clamp-none transition-all">
                                                    "{item.notas_anulacion}"
                                                </p>
                                            )}
                                        </td>
                                        <td className="p-4 align-top text-right">
                                            <p className="text-sm font-black text-gray-900">{(item.total || 0).toFixed(2)}</p>
                                        </td>
                                        <td className="p-4 align-top text-center">
                                            <button
                                                onClick={() => navigate(`/ventas?search=${item._id}`)}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-[11px] uppercase tracking-wider hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 shadow-sm transition-all active:scale-95"
                                            >
                                                Inspeccionar <ArrowRight size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
