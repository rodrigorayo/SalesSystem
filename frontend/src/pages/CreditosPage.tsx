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

interface CuentaCredito {
    id: string;
    cliente_nombre: string;
    cliente_nit: string;
    cliente_telefono?: string;
    saldo_total: number;
    estado_cuenta: 'AL_DIA' | 'MOROSO';
}

interface Deuda {
    id: string;
    sale_id_corto: string;
    estado: string;
    fecha_emision: string;
    monto_original: number;
    saldo_pendiente: number;
}

interface Transaccion {
    id: string;
    tipo: 'ABONO' | 'CARGO';
    monto: number;
    created_at: string;
    pagos?: any[];
    notas?: string;
}

export default function CreditosPage() {
    const qc = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState<'' | 'AL_DIA' | 'MOROSO'>('');
    const [page, setPage] = useState(1);
    const limit = 20;

    // Side panel state
    const [selectedCuenta, setSelectedCuenta] = useState<CuentaCredito | null>(null);
    const [activeTab, setActiveTab] = useState<'DEUDAS' | 'HISTORIAL'>('DEUDAS');

    // Drawer Queries
    const { data: deudas = [], isLoading: loadingDeudas } = useQuery<Deuda[]>({
        queryKey: ['deudas', selectedCuenta?.id],
        queryFn: () => getDeudasPorCuenta(selectedCuenta?.id as string),
        enabled: !!selectedCuenta
    });

    const { data: transacciones = [], isLoading: loadingHistorial } = useQuery<Transaccion[]>({
        queryKey: ['transacciones', selectedCuenta?.id],
        queryFn: () => getTransaccionesCuenta(selectedCuenta?.id as string),
        enabled: !!selectedCuenta && activeTab === 'HISTORIAL'
    });


    const { data: creditosRes, isLoading } = useQuery({
        queryKey: ['cuentas-credito', page, searchTerm, filterEstado],
        queryFn: () => getCuentasCredito(searchTerm || undefined, filterEstado || undefined, page, limit)
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
                        placeholder="Buscar por Teléfono / Nombre / NIT..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl outline-none text-sm font-medium shadow-sm transition-all"
                    />
                </div>
            </div>

            <div className="flex gap-2 pb-2">
                <button 
                    onClick={() => { setFilterEstado(''); setPage(1); }}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${filterEstado === '' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                >
                    Todos
                </button>
                <button 
                    onClick={() => { setFilterEstado('MOROSO'); setPage(1); }}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${filterEstado === 'MOROSO' ? 'bg-red-500 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                >
                    Con Mora / Pendientes
                </button>
                <button 
                    onClick={() => { setFilterEstado('AL_DIA'); setPage(1); }}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${filterEstado === 'AL_DIA' ? 'bg-emerald-500 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                >
                    Al Día
                </button>
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
                        {cuentas.map((cuenta: CuentaCredito) => (
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

                            <div className="flex-1 overflow-auto p-6 bg-gray-50/30">
                                {activeTab === 'DEUDAS' ? (
                                    <div className="space-y-4">
                                        {loadingDeudas ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div> : deudas.length === 0 ? <p className="text-center py-10 text-gray-500 italic">No hay deudas pendientes.</p> : (
                                            deudas.map(d => (
                                                <div key={d.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex justify-between items-center shadow-sm hover:border-indigo-100 transition-colors">
                                                    <div>
                                                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">Ticket #{d.sale_id_corto}</span>
                                                        <h4 className="font-bold text-gray-900 mt-1">Saldo: Bs. {d.saldo_pendiente.toFixed(2)}</h4>
                                                        <p className="text-[10px] text-gray-400 font-medium uppercase mt-0.5">{formatDate(d.fecha_emision)}</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => { 
                                                            setPagosIn([{metodo:'EFECTIVO', monto: d.saldo_pendiente.toString()}]); 
                                                            setAbonoDrawer({isOpen: true, cuenta: selectedCuenta, deudaId: d.id}); 
                                                        }}
                                                        className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-xl transition-all"
                                                    >
                                                        Liquidar
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {loadingHistorial ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div> : transacciones.length === 0 ? <p className="text-center py-10 text-gray-500 italic">No hay historial de movimientos.</p> : (
                                            transacciones.map(h => (
                                                <div key={h.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                                                    <div>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${h.tipo === 'ABONO' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{h.tipo}</span>
                                                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-medium">{formatDate(h.created_at)}</p>
                                                        {h.notas && <p className="text-[11px] text-gray-600 mt-1 italic">"{h.notas}"</p>}
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`font-black font-mono ${h.tipo === 'ABONO' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {h.tipo === 'ABONO' ? '-' : '+'} Bs. {h.monto.toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Abono Multiple Drawer */}
            <AnimatePresence>
                {abonoDrawer.isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[80] bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Registrar Pago</h3>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{abonoDrawer.cuenta.cliente_nombre}</p>
                                </div>
                                <button onClick={() => setAbonoDrawer({isOpen: false, cuenta: null})} className="p-1.5 hover:bg-gray-200 rounded-full text-gray-400 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                                {pagosIn.map((pago, index) => (
                                    <div key={index} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3 relative group">
                                        {pagosIn.length > 1 && (
                                            <button 
                                                onClick={() => setPagosIn(pagosIn.filter((_, i) => i !== index))}
                                                className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-rose-100 text-rose-500 rounded-full flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Método</label>
                                                <select 
                                                    value={pago.metodo}
                                                    onChange={e => {
                                                        const newP = [...pagosIn];
                                                        newP[index].metodo = e.target.value as any;
                                                        setPagosIn(newP);
                                                    }}
                                                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm h-[38px]"
                                                >
                                                    <option value="EFECTIVO">EFECTIVO</option>
                                                    <option value="QR">QR / PAGOS NET</option>
                                                    <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                                                    <option value="TARJETA">TARJETA POS</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Monto</label>
                                                <input 
                                                    type="number" step="0.1" min="0" placeholder="0.00"
                                                    value={pago.monto}
                                                    onChange={e => {
                                                        const newP = [...pagosIn];
                                                        newP[index].monto = e.target.value;
                                                        setPagosIn(newP);
                                                    }}
                                                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm h-[38px]"
                                                />
                                            </div>
                                        </div>
                                        {(pago.metodo === 'QR' || pago.metodo === 'TRANSFERENCIA') && (
                                            <div className="pt-1">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Cód. Referencia / Banco</label>
                                                <input 
                                                    type="text" placeholder="Ej: BCP 123456..."
                                                    value={pago.qrRef || ''}
                                                    onChange={e => {
                                                        const newP = [...pagosIn];
                                                        newP[index].qrRef = e.target.value;
                                                        setPagosIn(newP);
                                                    }}
                                                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <button 
                                    onClick={() => setPagosIn([...pagosIn, {metodo:'QR', monto:''}])}
                                    className="w-full py-3 border-2 border-dashed border-indigo-100 rounded-2xl text-indigo-400 text-xs font-bold hover:bg-indigo-50 hover:border-indigo-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <PlusCircle size={14} /> Añadir Pago Combinado
                                </button>
                            </div>

                            <div className="p-6 bg-gray-50 border-t border-gray-100">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Amortización</span>
                                        <span className={`text-2xl font-black font-mono ${getTotalAbono() > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>Bs. {getTotalAbono().toFixed(2)}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Saldo Restante</span>
                                        <span className="text-sm font-bold text-rose-500 font-mono">Bs. {Math.max(0, abonoDrawer.cuenta.saldo_total - getTotalAbono()).toFixed(2)}</span>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setAbonoDrawer({isOpen: false, cuenta: null})} className="flex-1 py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors">Descartar</button>
                                    <button 
                                        onClick={handleAbonoSubmit}
                                        disabled={abonoMut.isPending || getTotalAbono() <= 0 || getTotalAbono() > (abonoDrawer.cuenta?.saldo_total + 1)}
                                        className="flex-[2] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2 capitalize"
                                    >
                                        {abonoMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Confirmar Abono
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
