import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSales, getSucursales, registrarAbono } from '../api/api';
import { useAuthStore } from '../store/authStore';
import {
    Loader2, Search, CalendarDays, Wallet, User as UserIcon, PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Pagination from '../components/Pagination';

const formatDate = (dateStr: string) => {
    const isoStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    return new Date(isoStr).toLocaleString();
};

export default function CreditosPage() {
    const qc = useQueryClient();
    const { user, role } = useAuthStore();
    const esMatriz = ['ADMIN_MATRIZ', 'ADMIN', 'SUPERADMIN'].includes(role || '');

    const [selectedSucursal, setSelectedSucursal] = useState<string>(esMatriz ? '' : (user?.sucursal_id || ''));
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const limit = 50;
    
    // Modal state for Abono
    const [abonoModal, setAbonoModal] = useState<{
        isOpen: boolean;
        saleId: string | null;
        total: number;
        pagado: number;
        metodo: 'EFECTIVO' | 'QR' | 'TARJETA' | 'TRANSFERENCIA';
        monto: string;
    }>({ isOpen: false, saleId: null, total: 0, pagado: 0, metodo: 'EFECTIVO', monto: '' });

    const { data: sucursales = [] } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales,
        enabled: esMatriz
    });

    const { data: creditosRes, isLoading } = useQuery({
        queryKey: ['sales-credits', selectedSucursal, page],
        queryFn: () => getSales(selectedSucursal || undefined, page, limit, undefined, undefined, undefined, 'DEUDA')
    });

    const creditos = creditosRes?.items || [];

    const abonoMut = useMutation({
        mutationFn: ({ saleId, abono }: { saleId: string, abono: any }) => registrarAbono(saleId, abono),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['sales-credits'] });
            qc.invalidateQueries({ queryKey: ['sales-history'] });
            setAbonoModal({ ...abonoModal, isOpen: false });
        },
        onError: (err: any) => alert(err.message || 'Error al registrar el abono.')
    });

    const handleAbonoSubmit = () => {
        if (!abonoModal.saleId || !abonoModal.monto || parseFloat(abonoModal.monto) <= 0) return;
        abonoMut.mutate({
            saleId: abonoModal.saleId,
            abono: { metodo: abonoModal.metodo, monto: parseFloat(abonoModal.monto) }
        });
    };

    const filteredCreditos = creditos.filter(v => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (v.cliente?.razon_social || '').toLowerCase().includes(search) ||
               (v.cliente?.nit || '').toLowerCase().includes(search) || 
               (v.cashier_name || '').toLowerCase().includes(search);
    });

    return (
        <div className="max-w-7xl mx-auto px-3 py-4 md:p-4 space-y-4 pb-20 md:pb-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Cuentas por Cobrar</h1>
                    <p className="text-gray-500 mt-1 text-sm">Gestiona y amortiza las deudas de tus clientes.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar Cliente o Cajero..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-white text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-lg outline-none text-xs font-medium shadow-sm transition-all"
                        />
                    </div>

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
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
            ) : filteredCreditos.length === 0 ? (
                <div className="text-center py-20 bg-gray-50/50 rounded-2xl border border-gray-100 border-dashed">
                    <Wallet size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">No hay deudas pendientes registradas.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredCreditos.map(venta => {
                            const pagado = venta.pagos.reduce((acc, p) => acc + p.monto, 0);
                            const pendiente = parseFloat(venta.total.toString()) - pagado;

                            return (
                                <div key={venta._id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col items-start h-full">
                                    <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none">
                                        <div className={`absolute top-3 -right-6 transform rotate-45 text-[10px] font-black tracking-widest py-0.5 px-6 text-white uppercase ${venta.estado_pago === 'PENDIENTE' ? 'bg-red-500' : 'bg-amber-500'}`}>
                                            {venta.estado_pago}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 mb-3 max-w-[80%]">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                            <UserIcon size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 leading-tight line-clamp-1">{venta.cliente?.razon_social || 'Desconocido'}</h3>
                                            <p className="text-xs text-gray-500 flex items-center gap-1 font-mono">
                                                NIT: {venta.cliente?.nit || 'N/A'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 w-full text-sm mb-4">
                                        <div className="flex justify-between text-gray-500">
                                            <span>Deuda Inicial</span>
                                            <span className="font-mono font-medium">Bs. {parseFloat(venta.total.toString()).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-500">
                                            <span>Pagado</span>
                                            <span className="font-mono text-green-600 font-medium">Bs. {pagado.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between font-bold border-t border-gray-100 pt-1.5 mt-1">
                                            <span className="text-gray-900">Monto Pendiente</span>
                                            <span className="font-mono text-red-600 text-lg">Bs. {pendiente.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-auto w-full pt-4 border-t border-gray-100 flex items-center justify-between">
                                        <div className="text-[10px] text-gray-400">
                                            <div className="flex items-center gap-1"><CalendarDays size={10} /> {formatDate(venta.created_at)}</div>
                                            <div className="mt-0.5 ml-0.5">Cajero: {venta.cashier_name}</div>
                                        </div>
                                        <button 
                                            onClick={() => setAbonoModal({
                                                isOpen: true, 
                                                saleId: venta._id,
                                                total: parseFloat(venta.total.toString()),
                                                pagado,
                                                metodo: 'EFECTIVO',
                                                monto: pendiente.toFixed(2)
                                            })}
                                            className="px-4 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            <PlusCircle size={14} /> Abonar
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {creditosRes && (
                        <div className="mt-6">
                            <Pagination 
                                currentPage={page}
                                totalPages={creditosRes.pages}
                                onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                totalItems={creditosRes.total}
                                itemsPerPage={limit}
                            />
                        </div>
                    )}
                </>
            )}

            {/* Modal Abonar */}
            <AnimatePresence>
                {abonoModal.isOpen && (
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
                            <h3 className="text-lg font-black text-gray-900 mb-1">Registrar Abono</h3>
                            <p className="text-sm text-gray-500 mb-4">Ingresa el monto para amortizar la deuda.</p>

                            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-4 space-y-1 text-sm">
                                <div className="flex justify-between items-center text-gray-500">
                                    <span>Total Ticket</span>
                                    <span className="font-mono">Bs. {abonoModal.total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-red-600 font-bold border-t border-gray-200 mt-1 pt-1">
                                    <span>Deuda Actual</span>
                                    <span className="font-mono">Bs. {(abonoModal.total - abonoModal.pagado).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Método de Pago</label>
                                    <div className="flex gap-1">
                                        {(['EFECTIVO', 'QR', 'TARJETA', 'TRANSFERENCIA'] as const).map(metodo => (
                                            <button 
                                                key={metodo}
                                                onClick={() => setAbonoModal(m => ({ ...m, metodo }))}
                                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border-2 transition-colors ${abonoModal.metodo === metodo ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white border-gray-200 text-gray-500'}`}
                                            >
                                                {metodo}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Monto a abonar (Bs.)</label>
                                    <input 
                                        type="number" 
                                        step="0.10"
                                        min="0.10"
                                        max={(abonoModal.total - abonoModal.pagado).toFixed(2)}
                                        value={abonoModal.monto}
                                        onChange={e => setAbonoModal(m => ({ ...m, monto: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-lg font-bold font-mono text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Sugerido: cancelación total de la deuda restante.</p>
                                </div>
                            </div>

                            <div className="flex gap-3 w-full mt-6">
                                <button 
                                    onClick={() => setAbonoModal({ ...abonoModal, isOpen: false })}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleAbonoSubmit}
                                    disabled={abonoMut.isPending || !abonoModal.monto || parseFloat(abonoModal.monto) <= 0 || parseFloat(abonoModal.monto) > (abonoModal.total - abonoModal.pagado + 0.01)}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {abonoMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />} 
                                    Abonar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
