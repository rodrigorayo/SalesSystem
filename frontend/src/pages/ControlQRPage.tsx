import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSales, getSucursales, updateQRInfo } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { QrCode, Search, CheckCircle2, Clock, CalendarDays, Loader2, Building2 } from 'lucide-react';
import type { Sale } from '../api/types';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

const BANCOS_POPULARES = [
    'Banco Unión',
    'Mercantil Santa Cruz',
    'Banco Bisa',
    'Banco Nacional de Bolivia (BNB)',
    'Banco Fassil',
    'Banco Económico',
    'Banco Solidario (BancoSol)',
    'Banco Ganadero',
    'Banco Fie',
    'Otros'
];

const formatDate = (dateStr: string) => {
    const isoStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    return new Date(isoStr).toLocaleString();
};

export default function ControlQRPage() {
    const qc = useQueryClient();
    const { user, role } = useAuthStore();
    const esMatriz = ['ADMIN_MATRIZ', 'ADMIN', 'SUPERADMIN'].includes(role || '');

    const [selectedSucursal, setSelectedSucursal] = useState<string>(esMatriz ? '' : (user?.sucursal_id || ''));
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'TODOS' | 'PENDIENTES' | 'CONFIRMADOS'>('PENDIENTES');
    
    // Modal State
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [qrData, setQrData] = useState({ banco: '', referencia: '', monto_transferido: '' });

    const { data: sucursales = [] } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales,
        enabled: esMatriz
    });

    const { data: ventas = [], isLoading } = useQuery({
        queryKey: ['sales-history', selectedSucursal],
        queryFn: () => getSales(selectedSucursal || undefined)
    });

    const qrMut = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => updateQRInfo(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['sales-history'] });
            setSelectedSale(null);
        },
        onError: (err: any) => alert(err.message || 'Error al confirmar QR.')
    });

    // Extract only ventas that have a QR payment
    const qrSales = useMemo(() => {
        return ventas.filter(v => v.pagos.some(p => p.metodo === 'QR') && !v.anulada);
    }, [ventas]);

    // Apply UI Filters
    const filteredSales = useMemo(() => {
        return qrSales.filter(v => {
            // Status filter
            const isConfirmed = v.qr_info?.confirmado || false;
            if (filterStatus === 'PENDIENTES' && isConfirmed) return false;
            if (filterStatus === 'CONFIRMADOS' && !isConfirmed) return false;

            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (!v._id.toLowerCase().includes(term) && 
                    !(v.qr_info?.referencia || '').toLowerCase().includes(term) &&
                    !(v.cashier_name || '').toLowerCase().includes(term)) {
                    return false;
                }
            }
            return true;
        });
    }, [qrSales, filterStatus, searchTerm]);

    const handleOpenModal = (sale: Sale) => {
        // Find how much was supposedly paid via QR
        const qrPaymentAmount = sale.pagos.find(p => p.metodo === 'QR')?.monto || 0;
        
        setSelectedSale(sale);
        setQrData({
            banco: sale.qr_info?.banco || BANCOS_POPULARES[0],
            referencia: sale.qr_info?.referencia || '',
            monto_transferido: sale.qr_info?.monto_transferido ? String(sale.qr_info.monto_transferido) : String(qrPaymentAmount)
        });
    };

    const handleConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSale || qrMut.isPending) return;
        qrMut.mutate({
            id: selectedSale._id,
            data: {
                banco: qrData.banco,
                referencia: qrData.referencia,
                monto_transferido: parseFloat(qrData.monto_transferido)
            }
        });
    };

    return (
        <div className="max-w-7xl mx-auto px-3 py-4 md:p-4 space-y-4 pb-20 md:pb-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <QrCode className="text-indigo-600" size={28} /> Control de Pagos QR
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">Confirma los ingresos por transferencias QR.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar ticket, ref o cajero..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-white text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-lg outline-none text-xs font-medium shadow-sm transition-all"
                        />
                    </div>

                    {/* Filter Status */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="bg-white border border-gray-200 text-gray-900 text-xs font-semibold rounded-lg px-3 py-1.5 focus:border-indigo-500 outline-none shadow-sm h-[32px]"
                    >
                        <option value="TODOS">Todos los Estados</option>
                        <option value="PENDIENTES">Sólo Pendientes</option>
                        <option value="CONFIRMADOS">Sólo Confirmados</option>
                    </select>

                    {/* Filter Branch */}
                    {esMatriz && (
                        <select
                            value={selectedSucursal}
                            onChange={(e) => setSelectedSucursal(e.target.value)}
                            className="bg-white border border-gray-200 text-gray-900 text-xs font-semibold rounded-lg px-3 py-1.5 focus:border-indigo-500 outline-none shadow-sm h-[32px]"
                        >
                            <option value="">Todas las Sucursales</option>
                            {sucursales.map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
            ) : filteredSales.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <QrCode size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 font-medium text-sm">No hay pagos por QR {filterStatus === 'PENDIENTES' ? 'pendientes' : 'para mostrar'}.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSales.map(v => {
                        const isConfirmed = v.qr_info?.confirmado;
                        const qrTotal = v.pagos.find(p => p.metodo === 'QR')?.monto || 0;
                        const sucursalNombre = sucursales.find(s => s._id === v.sucursal_id)?.nombre || v.sucursal_id;
                        
                        return (
                            <div 
                                key={v._id} 
                                onClick={() => handleOpenModal(v)}
                                className={cn(
                                    "bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg",
                                    isConfirmed ? "border-emerald-100 shadow-sm" : "border-amber-100 shadow-md"
                                )}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                            isConfirmed ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-500"
                                        )}>
                                            {isConfirmed ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 text-sm">Ticket #{v._id.slice(-6).toUpperCase()}</div>
                                            <div className="text-[10px] text-gray-500 flex items-center gap-1 font-medium">
                                                <CalendarDays size={10} /> {formatDate(v.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase">Monto QR</div>
                                        <div className="font-black text-gray-900 text-lg">Bs. {qrTotal.toFixed(2)}</div>
                                    </div>
                                </div>
                                
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                                        <span className="text-gray-500">Cajero</span>
                                        <span className="font-medium text-gray-900">{v.cashier_name}</span>
                                    </div>
                                    
                                    {esMatriz && (
                                        <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                                            <span className="text-gray-500 flex items-center gap-1"><Building2 size={12}/> Sucursal</span>
                                            <span className="font-medium text-gray-900">{sucursalNombre}</span>
                                        </div>
                                    )}

                                    {isConfirmed ? (
                                        <div className="bg-emerald-50/50 p-2 rounded-lg mt-2 border border-emerald-100/50">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-emerald-700/70 font-semibold text-[10px] uppercase">Banco</span>
                                                <span className="text-emerald-900 font-bold">{v.qr_info?.banco}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-emerald-700/70 font-semibold text-[10px] uppercase">Referencia</span>
                                                <span className="text-emerald-900 font-medium truncate max-w-[120px]">{v.qr_info?.referencia}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-amber-50 text-amber-700 text-center py-1.5 rounded-lg font-bold border border-amber-200/50 mt-2">
                                            Pendiente de Confirmación
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal */}
            {selectedSale && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <QrCode className="text-indigo-600" size={18} />
                                {selectedSale.qr_info?.confirmado ? 'Editar Confirmación QR' : 'Confirmar Pago QR'}
                            </h3>
                            <button onClick={() => setSelectedSale(null)} className="text-gray-400 hover:text-gray-600">×</button>
                        </div>
                        
                        <form onSubmit={handleConfirm} className="p-5 space-y-4">
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex justify-between items-center mb-6">
                                <span className="text-indigo-900 font-medium text-sm">Ticket #{selectedSale._id.slice(-6).toUpperCase()}</span>
                                <span className="font-black text-indigo-700">Bs. {selectedSale.pagos.find(p => p.metodo === 'QR')?.monto.toFixed(2)}</span>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Banco Origen</label>
                                <select 
                                    value={qrData.banco}
                                    onChange={e => setQrData({...qrData, banco: e.target.value})}
                                    className="w-full border-gray-200 border rounded-xl py-2 px-3 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium text-gray-800"
                                    required
                                >
                                    <option value="" disabled>Selecciona un banco</option>
                                    {BANCOS_POPULARES.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Nombre / Cuenta / Ref.</label>
                                <input 
                                    type="text"
                                    value={qrData.referencia}
                                    onChange={e => setQrData({...qrData, referencia: e.target.value})}
                                    placeholder="Ej. Juan Perez, 1234567"
                                    className="w-full border-gray-200 border rounded-xl py-2 px-3 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-gray-800"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Monto Real Transferido (Bs.)</label>
                                <input 
                                    type="number"
                                    step="0.10"
                                    value={qrData.monto_transferido}
                                    onChange={e => setQrData({...qrData, monto_transferido: e.target.value})}
                                    className="w-full border-gray-200 border rounded-xl py-2 px-3 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-mono text-gray-800"
                                    required
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSelectedSale(null)}
                                    className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={qrMut.isPending}
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-md shadow-indigo-600/20"
                                >
                                    {qrMut.isPending ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                    Confirmar Pago
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
