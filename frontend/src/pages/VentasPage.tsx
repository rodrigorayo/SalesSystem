import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSales, anularSale, getSucursales, toggleFacturaEmitida } from '../api/api';
import { useAuthStore } from '../store/authStore';
import {
    Receipt, Loader2, ChevronRight, ChevronDown,
    Search, Ban, CalendarDays, ScrollText, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TicketPrinter } from '../components/TicketPrinter';
import Pagination from '../components/Pagination';
import type { Sale } from '../api/types';

import { formatFullDate as formatDate } from '../utils/dateUtils';


export default function VentasPage() {
    const qc = useQueryClient();
    const { user, role } = useAuthStore();
    const esMatriz = ['ADMIN_MATRIZ', 'ADMIN', 'SUPERADMIN'].includes(role || '');

    // Filtros
    const [selectedSucursal, setSelectedSucursal] = useState<string>(esMatriz ? '' : (user?.sucursal_id || ''));
    const [searchTerm, setSearchTerm] = useState('');
    const [soloFacturas, setSoloFacturas] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [printSale, setPrintSale] = useState<Sale | null>(null);
    const [page, setPage] = useState(1);
    const limit = 50;
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        action: () => void;
        type: 'danger' | 'info' | 'success';
    }>({ isOpen: false, title: '', message: '', action: () => {}, type: 'danger' });

    const { data: sucursales = [] } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales,
        enabled: esMatriz
    });

    const { data: ventasRes, isLoading } = useQuery({
        queryKey: ['sales-history', selectedSucursal, page, soloFacturas],
        queryFn: () => getSales(selectedSucursal || undefined, page, limit, undefined, soloFacturas)
    });

    const ventas = ventasRes?.items || [];

    const anularMut = useMutation({
        mutationFn: anularSale,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['sales-history'] });
            qc.invalidateQueries({ queryKey: ['sales-stats-today'] });
            qc.invalidateQueries({ queryKey: ['inventario'] });
        },
        onError: (err: any) => alert(err.message || 'Error al anular la venta.')
    });

    const facturaMut = useMutation({
        mutationFn: ({ id, emitida }: { id: string, emitida: boolean }) => toggleFacturaEmitida(id, emitida),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-history'] }),
        onError: (err: any) => alert(err.message || 'Error al actualizar el estado de la factura.')
    });

    const handleAnular = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmModal({
            isOpen: true,
            title: 'Anular Venta',
            message: '¿Estás seguro de ANULAR esta venta? Esto devolverá el stock y registrará un egreso en la caja abierta. Esta acción NO se puede deshacer.',
            type: 'danger',
            action: () => anularMut.mutate(id)
        });
    };

    const filteredVentas = ventas.filter(v => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        // search by ticket id or partial cashier name
        return (v._id || '').toLowerCase().includes(search) || (v.cashier_name || '').toLowerCase().includes(search);
    });

    return (
        <div className="max-w-7xl mx-auto px-3 py-4 md:p-4 space-y-4 pb-20 md:pb-4">
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
                            className="bg-white border border-gray-200 text-gray-900 text-xs font-semibold rounded-lg px-3 py-1.5 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-sm h-[32px]"
                        >
                            <option value="">Todas las Sucursales</option>
                            {sucursales.map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                        </select>
                    )}

                    {/* Filtro Sólo Facturas */}
                    <label className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm cursor-pointer hover:bg-gray-50 transition-colors h-[32px] shrink-0">
                        <input 
                            type="checkbox" 
                            checked={soloFacturas} 
                            onChange={e => {
                                setSoloFacturas(e.target.checked);
                                setPage(1);
                            }}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-semibold text-gray-700">Solo Facturas / NIT</span>
                    </label>
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
                <>
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
                                                {(venta.cliente?.nit || venta.cliente?.es_factura) && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg uppercase border border-indigo-200">
                                                        FACTURA
                                                    </span>
                                                )}
                                                {isAnulado && <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-lg uppercase border border-red-200">Anulado</span>}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                                <span className="flex items-center gap-1"><CalendarDays size={12} /> {formatDate(venta.created_at)}</span>
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
                                                Bs. {parseFloat(venta.total.toString()).toFixed(2)}
                                            </div>
                                        </div>
                                        <div className="text-gray-300">
                                            {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                        </div>
                                    </div>
                                </div>

                                {isOpen && (
                                    <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                                        {venta.cliente && (venta.cliente.razon_social || venta.cliente.nit || venta.cliente.email) && (
                                            <div className="mb-4 bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap gap-6 text-sm items-center justify-between">
                                                <div className="flex flex-wrap gap-6">
                                                    {venta.cliente.razon_social && (
                                                        <div><span className="text-gray-400 font-semibold text-[10px] uppercase tracking-wider block mb-0.5">Cliente</span><span className="font-bold text-gray-900">{venta.cliente.razon_social}</span></div>
                                                    )}
                                                    {venta.cliente.nit && (
                                                        <div><span className="text-gray-400 font-semibold text-[10px] uppercase tracking-wider block mb-0.5">NIT / CI</span><span className="font-mono font-medium text-gray-800">{venta.cliente.nit}</span></div>
                                                    )}
                                                    {venta.cliente.email && (
                                                        <div><span className="text-gray-400 font-semibold text-[10px] uppercase tracking-wider block mb-0.5">Correo</span><span className="text-gray-600">{venta.cliente.email}</span></div>
                                                    )}
                                                    {venta.cliente.telefono && (
                                                        <div><span className="text-gray-400 font-semibold text-[10px] uppercase tracking-wider block mb-0.5">Celular</span><span className="text-gray-600 font-medium">{venta.cliente.telefono}</span></div>
                                                    )}
                                                </div>
                                                
                                                {/* Botón confirmación de factura emitida si solicitó Módulo Impuestos */}
                                                {(venta.cliente.nit || venta.cliente.es_factura) && (
                                                    <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-xl flex items-center gap-3 shadow-inner">
                                                        <span className="text-xs font-bold text-gray-700 uppercase tracking-widest flex items-center gap-1.5"><Receipt size={14} className="text-indigo-500" /> Factura Entregada</span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); facturaMut.mutate({ id: venta._id, emitida: !venta.factura_emitida }); }}
                                                            disabled={facturaMut.isPending || isAnulado}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${venta.factura_emitida ? 'bg-indigo-600' : 'bg-gray-300'} ${(facturaMut.isPending || isAnulado) && 'opacity-50 cursor-not-allowed'}`}
                                                        >
                                                            <span className={`${venta.factura_emitida ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out`} />
                                                        </button>
                                                        <span className={`text-xs font-black ${venta.factura_emitida ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                            {venta.factura_emitida ? 'SÍ' : 'NO'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Detalle Productos */}
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Artículos</h4>
                                                <div className="space-y-2 bg-white p-3 border border-gray-200 rounded-xl">
                                                    {venta.items.map((it, idx) => (
                                                        <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                                                            <div className="flex items-center gap-2 text-gray-800">
                                                                <span className="font-semibold text-gray-900">{it.cantidad}x</span>
                                                                {it.descripcion || 'Producto'} <span className="text-gray-400 text-xs">(Bs. {(it.precio_unitario || 0).toFixed(2)})</span>
                                                            </div>
                                                            <div className="font-medium text-gray-900">Bs. {(it.subtotal || 0).toFixed(2)}</div>
                                                        </div>
                                                    ))}
                                                    {venta.descuento && (
                                                        <div className="flex justify-between items-center text-sm pt-2 text-indigo-600 font-medium border-t border-gray-100">
                                                            <span>Descuento Aplicado ({venta.descuento.nombre || venta.descuento.tipo})</span>
                                                            <span>- Bs. {(venta.descuento.valor || 0).toFixed(2)}</span>
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
                                                                <span className="font-medium font-mono text-gray-900">Bs. {p.monto.toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="mt-6 flex justify-end gap-3">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setPrintSale(venta); setTimeout(() => window.print(), 150); }}
                                                        className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all"
                                                    >
                                                        <Receipt size={16} />
                                                        Reimprimir
                                                    </button>
                                                    {!isAnulado && role !== 'CAJERO' && (
                                                        <button
                                                            onClick={(e) => handleAnular(venta._id, e)}
                                                            disabled={anularMut.isPending}
                                                            className="flex items-center gap-1.5 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all"
                                                        >
                                                            {anularMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                                                            Anular Venta
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Pagination UI */}
                {ventasRes && (
                    <Pagination 
                        currentPage={page}
                        totalPages={ventasRes.pages}
                        onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        totalItems={ventasRes.total}
                        itemsPerPage={limit}
                    />
                )}
                </>
            )}

            {/* Confirmation Modal */}
            <AnimatePresence>
                {confirmModal.isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative"
                        >
                            <button onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} className="absolute right-4 top-4 text-gray-400 hover:bg-gray-100 p-1 rounded-lg transition-colors">
                                <span className="text-xl leading-none">&times;</span>
                            </button>
                            
                            <div className="flex flex-col items-center text-center">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 
                                    ${confirmModal.type === 'danger' ? 'bg-red-100 text-red-600' :
                                      confirmModal.type === 'success' ? 'bg-green-100 text-green-600' :
                                      'bg-blue-100 text-blue-600'}`}
                                >
                                    {confirmModal.type === 'danger' ? <AlertTriangle size={32} /> : 
                                     confirmModal.type === 'success' ? <Receipt size={32} /> : 
                                     <ScrollText size={32} />}
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
                                <p className="text-sm text-gray-600 mb-6 px-2">{confirmModal.message}</p>
                                
                                <div className="flex gap-3 w-full">
                                    <button 
                                        onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        onClick={() => {
                                            confirmModal.action();
                                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                        }}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-colors
                                            ${confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700' :
                                              confirmModal.type === 'success' ? 'bg-green-600 hover:bg-green-700' :
                                              'bg-blue-600 hover:bg-blue-700'}`}
                                    >
                                        Confirmar
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Hidden Ticket Wrapper for Re-printing */}
            <div className="print-only">
                {printSale && <TicketPrinter sale={printSale} tenantName={user?.tenant_id || "Mi Tienda"} />}
            </div>
        </div>
    );
}
