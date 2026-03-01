import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSales, anularSale, getSucursales } from '../api/api';
import { useAuthStore } from '../store/authStore';
import {
    Receipt, Loader2, ChevronRight, ChevronDown,
    Search, Ban, CalendarDays, ScrollText
} from 'lucide-react';

export default function VentasPage() {
    const qc = useQueryClient();
    const { user, role } = useAuthStore();
    const esMatriz = ['ADMIN_MATRIZ', 'ADMIN', 'SUPERADMIN'].includes(role || '');

    // Filtros
    const [selectedSucursal, setSelectedSucursal] = useState<string>(esMatriz ? '' : (user?.sucursal_id || ''));
    const [searchTerm, setSearchTerm] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);

    const { data: sucursales = [] } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales,
        enabled: esMatriz
    });

    const { data: ventas = [], isLoading } = useQuery({
        queryKey: ['sales-history', selectedSucursal],
        queryFn: () => getSales(selectedSucursal || undefined)
    });

    const anularMut = useMutation({
        mutationFn: anularSale,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['sales-history'] });
            qc.invalidateQueries({ queryKey: ['sales-stats-today'] });
            qc.invalidateQueries({ queryKey: ['inventario'] });
        },
        onError: (err: any) => alert(err.message || 'Error al anular la venta.')
    });

    const handleAnular = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('¿Estás seguro de ANULAR esta venta? Esto devolverá el stock y registrará un egreso en la caja abierta. Esta acción NO se puede deshacer.')) {
            anularMut.mutate(id);
        }
    };

    const filteredVentas = ventas.filter(v => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        // search by ticket id or partial cashier name
        return (v._id || '').toLowerCase().includes(search) || (v.cashier_name || '').toLowerCase().includes(search);
    });

    return (
        <div className="max-w-7xl mx-auto p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Historial de Ventas</h1>
                    <p className="text-gray-500 mt-1 text-sm">Consulta y administra tickets emitidos.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    {/* Buscador de #Ticket */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar por ID o Cajero..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-white text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-lg outline-none text-xs font-medium shadow-sm transition-all"
                        />
                    </div>

                    {/* Filtro Sucursal (Matriz) */}
                    {esMatriz && (
                        <select
                            value={selectedSucursal}
                            onChange={(e) => setSelectedSucursal(e.target.value)}
                            className="bg-white border border-gray-200 text-gray-900 text-xs font-semibold rounded-lg px-3 py-1.5 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-sm"
                        >
                            <option value="">Todas las Sucursales</option>
                            {sucursales.map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {/* Lista de Ventas */}
            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
            ) : filteredVentas.length === 0 ? (
                <div className="text-center py-20 bg-gray-50/50 rounded-2xl border border-gray-100 border-dashed">
                    <Receipt size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">No hay ventas registradas.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredVentas.map(venta => {
                        const isOpen = expanded === venta._id;
                        const isAnulado = venta.anulada;
                        const sucursalNombre = sucursales.find(s => s._id === venta.sucursal_id)?.nombre || venta.sucursal_id;

                        return (
                            <div key={venta._id} className={`bg-white border-2 rounded-2xl overflow-hidden transition-shadow ${isAnulado ? 'border-red-200 bg-red-50/30' : (isOpen ? 'border-indigo-200 shadow-md' : 'border-gray-100 shadow-sm hover:shadow-md')} `}>
                                <div
                                    className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 cursor-pointer gap-4"
                                    onClick={() => setExpanded(isOpen ? null : venta._id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isAnulado ? 'bg-red-100 text-red-600' : 'bg-emerald-50 text-emerald-600'} `}>
                                            {isAnulado ? <Ban size={20} /> : <Receipt size={20} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900 text-sm">Ticket #{venta._id.slice(-6).toUpperCase()}</span>
                                                {isAnulado && <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-lg uppercase">Anulado</span>}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                                <span className="flex items-center gap-1"><CalendarDays size={12} /> {new Date(venta.created_at).toLocaleString()}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1"><ScrollText size={12} /> Cajero: {venta.cashier_name}</span>
                                            </div>
                                            {esMatriz && <div className="text-[10px] text-gray-400 mt-0.5">Suc: {sucursalNombre}</div>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                        <div className="text-right">
                                            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Total Pagado</div>
                                            <div className={`text-xl font-black ${isAnulado ? 'text-gray-400 line-through' : 'text-gray-900'} `}>
                                                ${parseFloat(venta.total.toString()).toFixed(2)}
                                            </div>
                                        </div>
                                        <div className="text-gray-300">
                                            {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                        </div>
                                    </div>
                                </div>

                                {isOpen && (
                                    <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Detalle Productos */}
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Artículos</h4>
                                                <div className="space-y-2 bg-white p-3 border border-gray-200 rounded-xl">
                                                    {venta.items.map((it, idx) => (
                                                        <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                                                            <div className="flex items-center gap-2 text-gray-800">
                                                                <span className="font-semibold text-gray-900">{it.cantidad}x</span>
                                                                {it.producto_nombre} <span className="text-gray-400 text-xs">(${it.precio.toFixed(2)})</span>
                                                            </div>
                                                            <div className="font-medium text-gray-900">${(it.subtotal).toFixed(2)}</div>
                                                        </div>
                                                    ))}
                                                    {venta.descuento && (
                                                        <div className="flex justify-between items-center text-sm pt-2 text-indigo-600 font-medium border-t border-gray-100">
                                                            <span>Descuento Aplicado ({venta.descuento.nombre || venta.descuento.tipo})</span>
                                                            <span>- ${venta.descuento.valor.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Pagos / Acciones */}
                                            <div className="flex flex-col justify-between">
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Pagos</h4>
                                                    <div className="space-y-2">
                                                        {venta.pagos.map((p, idx) => (
                                                            <div key={idx} className="flex justify-between items-center text-sm">
                                                                <span className="text-gray-600 capitalize bg-white border border-gray-200 px-2 py-0.5 rounded-md text-xs font-medium">{p.metodo}</span>
                                                                <span className="font-medium font-mono text-gray-900">${p.monto.toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {!isAnulado && (
                                                    <div className="mt-6 flex justify-end">
                                                        <button
                                                            onClick={(e) => handleAnular(venta._id, e)}
                                                            disabled={anularMut.isPending}
                                                            className="flex items-center gap-1.5 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all"
                                                        >
                                                            {anularMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                                                            Anular Venta
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
