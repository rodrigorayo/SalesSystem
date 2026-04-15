import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCuentasCredito, getDeudasPorCuenta, getTransaccionesCuenta, registrarAbonosMultiple } from '../api/api';
import { Loader2, Search, Wallet, User as UserIcon, PlusCircle, X, History, FileText, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Pagination from '../components/Pagination';

const formatDate = (dateStr: string) => {
    const isoStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    return new Date(isoStr).toLocaleString();
};

export default function CreditosPage() {
    const qc = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const limit = 20;

    // Side panel state
    const [selectedCuenta, setSelectedCuenta] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'DEUDAS' | 'HISTORIAL'>('DEUDAS');

    // Drawer Queries
    const { data: deudas = [], isLoading: loadingDeudas } = useQuery({
        queryKey: ['deudas', selectedCuenta?.id],
        queryFn: () => getDeudasPorCuenta(selectedCuenta?.id),
        enabled: !!selectedCuenta
    });

    const { data: transacciones = [], isLoading: loadingHistorial } = useQuery({
        queryKey: ['transacciones', selectedCuenta?.id],
        queryFn: () => getTransaccionesCuenta(selectedCuenta?.id),
        enabled: !!selectedCuenta && activeTab === 'HISTORIAL'
    });

    const { data: creditosRes, isLoading } = useQuery({
        queryKey: ['cuentas-credito', page, searchTerm],
        queryFn: () => getCuentasCredito(searchTerm || undefined, undefined, page, limit)
    });

    const cuentas = creditosRes?.items || [];

    // Abono UI State
    const [abonoDrawer, setAbonoDrawer] = useState<{isOpen: boolean, cuenta: any, deudaId?: string}>({ isOpen: false, cuenta: null });
    const [pagosIn, setPagosIn] = useState<Array<{metodo: 'EFECTIVO'|'QR'|'TARJETA'|'TRANSFERENCIA', monto: string, qrRef?: string}>>([
        { metodo: 'EFECTIVO', monto: '' }
    ]);

    const abonoMut = useMutation({
        mutationFn: (data: any) => registrarAbonosMultiple(abonoDrawer.cuenta.id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['cuentas-credito'] });
            qc.invalidateQueries({ queryKey: ['deudas'] });
            qc.invalidateQueries({ queryKey: ['transacciones'] });
            setAbonoDrawer({ isOpen: false, cuenta: null });
            if (selectedCuenta) {
                // update local balance hack or just refetch
                setSelectedCuenta({ ...selectedCuenta, saldo_total: selectedCuenta.saldo_total - getTotalAbono()});
            }
        },
        onError: (err: any) => alert(err.message || 'Error al registrar el abono.')
    });

    const getTotalAbono = () => pagosIn.reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0);

    const handleAbonoSubmit = () => {
        const total = getTotalAbono();
        if (total <= 0) return alert("Ingrese un monto válido");
        
        const payloadPagos = pagosIn.filter(p => parseFloat(p.monto) > 0).map(p => ({
            metodo: p.metodo,
            monto: parseFloat(p.monto),
            referencia: p.qrRef || undefined
        }));

        abonoMut.mutate({
            pagos: payloadPagos,
            deuda_id: abonoDrawer.deudaId
        });
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 pb-20 md:pb-6 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Créditos de Clientes</h1>
                    <p className="text-gray-500 mt-1">Gestión profesional de cuentas por cobrar e historial de pagos.</p>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por Nombre / CI..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl outline-none text-sm font-medium shadow-sm transition-all"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
            ) : cuentas.length === 0 ? (
                <div className="text-center py-20 bg-white/50 backdrop-blur-sm rounded-3xl border border-gray-100 border-dashed shadow-sm">
                    <Wallet size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 font-medium tracking-wide">No se encontraron cuentas de crédito.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {cuentas.map(cuenta => (
                            <motion.div 
                                whileHover={{ scale: 1.01 }}
                                key={cuenta.id} 
                                onClick={() => setSelectedCuenta(cuenta)}
                                className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
                                    <div className={`absolute top-4 -right-8 transform rotate-45 text-[9px] font-black tracking-widest py-1 px-10 text-white uppercase shadow-md ${cuenta.estado_cuenta === 'MOROSO' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                                        {cuenta.estado_cuenta === 'MOROSO' ? 'MOROSO' : 'AL DÍA'}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4 mb-5">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <UserIcon size={24} />
                                    </div>
                                    <div className="pr-8">
                                        <h3 className="font-bold text-gray-900 text-lg leading-tight line-clamp-1">{cuenta.cliente_nombre || 'Desconocido'}</h3>
                                        <p className="text-xs text-gray-500 font-mono mt-1">CI/NIT: {cuenta.cliente_nit || 'N/A'}</p>
                                    </div>
                                </div>

                                <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100">
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Deuda Total</span>
                                        <span className={`text-2xl font-black font-mono ${cuenta.saldo_total > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                                            Bs. {cuenta.saldo_total.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xs font-bold text-indigo-600">Ver Detalles</span>
                                    <ChevronRight size={16} className="text-indigo-600" />
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {creditosRes && (
                        <div className="mt-8 flex justify-center">
                            <Pagination 
                                currentPage={page}
                                totalPages={creditosRes.pages}
                                onPageChange={setPage}
                                totalItems={creditosRes.total}
                                itemsPerPage={limit}
                            />
                        </div>
                    )}
                </>
            )}

            {/* Account Details Drawer overlay */}
            <AnimatePresence>
                {selectedCuenta && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => { setSelectedCuenta(null); setAbonoDrawer({isOpen:false, cuenta:null}); }}
                            className="fixed inset-0 z-[60] bg-gray-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-[70] flex flex-col"
                        >
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-4 items-center">
                                        <div className="h-16 w-16 bg-white border border-gray-200 rounded-full flex items-center justify-center text-indigo-600 shadow-sm">
                                            <UserIcon size={32} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-gray-900">{selectedCuenta.cliente_nombre}</h2>
                                            <p className="text-sm font-mono text-gray-500 mt-1">NIT: {selectedCuenta.cliente_nit || 'N/A'} | Tel: {selectedCuenta.cliente_telefono || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedCuenta(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                                        <X size={24} />
                                    </button>
                                </div>
                                <div className="mt-6 flex gap-4">
                                    <div className="flex-1 bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex justify-between items-center">
                                        <span className="text-sm font-bold text-gray-500">Saldo Total</span>
                                        <span className="text-xl font-black font-mono text-rose-600">Bs. {selectedCuenta.saldo_total.toFixed(2)}</span>
                                    </div>
                                    <button 
                                        onClick={() => { setPagosIn([{metodo:'EFECTIVO', monto: ''}]); setAbonoDrawer({isOpen: true, cuenta: selectedCuenta}); }}
                                        disabled={selectedCuenta.saldo_total <= 0}
                                        className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-2xl font-bold transition-colors flex items-center gap-2 shadow-md shadow-indigo-200"
                                    >
                                        <PlusCircle size={20} /> Abonar General
                                    </button>
                                </div>
                            </div>

                            <div className="flex border-b border-gray-200 bg-white px-6 gap-6">
                                <button 
                                    onClick={() => setActiveTab('DEUDAS')}
                                    className={`py-4 font-bold text-sm tracking-wide border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'DEUDAS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                                >
                                    <FileText size={16} /> Estado de Cuenta
                                </button>
                                <button 
                                    onClick={() => setActiveTab('HISTORIAL')}
                                    className={`py-4 font-bold text-sm tracking-wide border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'HISTORIAL' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                                >
                                    <History size={16} /> Historial de Pagos
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                                {activeTab === 'DEUDAS' && (
                                    <div className="space-y-4">
                                        {loadingDeudas ? <Loader2 className="animate-spin text-indigo-500 mx-auto mt-10" /> : 
                                         deudas.length === 0 ? <p className="text-center text-gray-500 mt-10">No hay deudas registradas.</p> :
                                         deudas.map((d: any) => (
                                            <div key={d.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="font-bold text-gray-900">Venta #{d.sale_id_corto}</span>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${d.estado === 'PAGADA' ? 'bg-emerald-100 text-emerald-700' : d.estado === 'PARCIAL' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                                            {d.estado}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1.5"><History size={12}/> {formatDate(d.fecha_emision)}</p>
                                                </div>
                                                <div className="flex flex-col sm:items-end gap-1">
                                                    <div className="text-sm text-gray-500">Monto: Bs. {d.monto_original.toFixed(2)}</div>
                                                    <div className="font-black font-mono text-rose-600">Pendiente: Bs. {d.saldo_pendiente.toFixed(2)}</div>
                                                </div>
                                            </div>
                                         ))}
                                    </div>
                                )}

                                {activeTab === 'HISTORIAL' && (
                                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                                        {loadingHistorial ? <Loader2 className="animate-spin text-indigo-500 mx-auto mt-10" /> : 
                                         transacciones.length === 0 ? <p className="text-center text-gray-500 mt-10">No hay historial.</p> :
                                         transacciones.map((t: any) => (
                                            <div key={t.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-gray-50 bg-white text-gray-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                                    {t.tipo === 'ABONO' ? <CheckCircle2 className="text-emerald-500" size={18} /> : <FileText className="text-rose-500" size={18} />}
                                                </div>
                                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-gray-200 shadow-sm bg-white">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className={`font-bold text-sm ${t.tipo==='ABONO' ? 'text-emerald-600':'text-rose-600'}`}>{t.tipo === 'ABONO' ? 'Pago Recibido' : 'Nueva Deuda'}</span>
                                                        <span className="text-[10px] text-gray-400">{formatDate(t.created_at).split(',')[0]}</span>
                                                    </div>
                                                    <div className="font-black font-mono text-gray-900 text-lg mb-2">Bs. {t.monto.toFixed(2)}</div>
                                                    {t.tipo === 'ABONO' && t.pagos && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {t.pagos.map((p:any, i:number) => (
                                                                <span key={i} className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200 flex items-center gap-1">
                                                                    {p.metodo} • Bs. {p.monto.toFixed(2)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {t.notas && <p className="mt-2 text-xs text-gray-500 italic">{t.notas}</p>}
                                                </div>
                                            </div>
                                         ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Abono Modal */}
            <AnimatePresence>
                {abonoDrawer.isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl relative"
                        >
                            <h3 className="text-2xl font-black text-gray-900 mb-1">Registrar Pago</h3>
                            <p className="text-sm text-gray-500 mb-6">Amortización a cuenta de {abonoDrawer.cuenta?.cliente_nombre}</p>

                            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-6 flex justify-between items-center">
                                <span className="font-bold text-rose-800">Deuda Restante</span>
                                <span className="font-black font-mono text-2xl text-rose-600">Bs. {abonoDrawer.cuenta?.saldo_total.toFixed(2)}</span>
                            </div>

                            <div className="space-y-4 max-h-[40vh] overflow-y-auto px-1">
                                {pagosIn.map((pago, index) => (
                                    <div key={index} className="p-4 rounded-2xl border border-gray-200 bg-gray-50 relative">
                                        {pagosIn.length > 1 && (
                                            <button onClick={() => setPagosIn(pagosIn.filter((_, i) => i !== index))} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                                                <X size={16} />
                                            </button>
                                        )}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Método</label>
                                                <select 
                                                    value={pago.metodo} 
                                                    onChange={e => {
                                                        const newP = [...pagosIn];
                                                        newP[index].metodo = e.target.value as any;
                                                        setPagosIn(newP);
                                                    }}
                                                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                >
                                                    <option value="EFECTIVO">EFECTIVO</option>
                                                    <option value="QR">QR</option>
                                                    <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                                                    <option value="TARJETA">TARJETA</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Monto a Abonar</label>
                                                <input 
                                                    type="number" step="0.1" min="0" placeholder="0.00"
                                                    value={pago.monto}
                                                    onChange={e => {
                                                        const newP = [...pagosIn];
                                                        newP[index].monto = e.target.value;
                                                        setPagosIn(newP);
                                                    }}
                                                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                                                />
                                            </div>
                                        </div>
                                        {(pago.metodo === 'QR' || pago.metodo === 'TRANSFERENCIA') && (
                                            <div className="mt-3">
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cód. Referencia</label>
                                                <input 
                                                    type="text" placeholder="Ref. Transferencia..."
                                                    value={pago.qrRef || ''}
                                                    onChange={e => {
                                                        const newP = [...pagosIn];
                                                        newP[index].qrRef = e.target.value;
                                                        setPagosIn(newP);
                                                    }}
                                                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            <button 
                                onClick={() => setPagosIn([...pagosIn, {metodo:'QR', monto:''}])}
                                className="mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                            >
                                <PlusCircle size={14} /> Añadir Método Mixto
                            </button>

                            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                                <div>
                                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Total a Abonar</span>
                                    <span className="font-black font-mono text-2xl text-emerald-600">Bs. {getTotalAbono().toFixed(2)}</span>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setAbonoDrawer({isOpen: false, cuenta: null})} className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">Cancelar</button>
                                    <button 
                                        onClick={handleAbonoSubmit}
                                        disabled={abonoMut.isPending || getTotalAbono() <= 0 || getTotalAbono() > (abonoDrawer.cuenta?.saldo_total + 0.1)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-black shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {abonoMut.isPending ? <Loader2 size={18} className="animate-spin" /> : < CheckCircle2 size={18} />} Confirmar Pago
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
