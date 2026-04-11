import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSales, anularSale, getSucursales, toggleFacturaEmitida, checkPosibleDuplicado, type MotivoAnulacion } from '../api/api';
import { useAuthStore } from '../store/authStore';
import {
    Receipt, Loader2, ChevronRight, ChevronDown,
    Search, Ban, CalendarDays, ScrollText, AlertTriangle, ShieldCheck, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TicketPrinter } from '../components/TicketPrinter';
import Pagination from '../components/Pagination';
import type { Sale } from '../api/types';

import { formatFullDate as formatDate } from '../utils/dateUtils';

// ─── Motivos de anulación ────────────────────────────────────────────────────

const MOTIVOS: { value: MotivoAnulacion; label: string; icon: string; desc: string }[] = [
    { value: 'ERROR_COBRO',          label: 'Error de cobro',            icon: '💸', desc: 'Se cobró mal el monto o el método' },
    { value: 'DEVOLUCION_CLIENTE',   label: 'Devolución de cliente',     icon: '↩️', desc: 'El cliente devuelve el producto' },
    { value: 'PRODUCTO_DEFECTUOSO',  label: 'Producto defectuoso',       icon: '⚠️', desc: 'El artículo presentó fallas' },
    { value: 'VENTA_DUPLICADA',      label: 'Venta duplicada',           icon: '🔁', desc: 'Esta venta fue registrada dos veces' },
    { value: 'OTRO',                 label: 'Otro motivo',               icon: '📝', desc: 'Especificar en el campo de notas' },
];

// ─── AnularModal ─────────────────────────────────────────────────────────────

function AnularModal({
    venta,
    onClose,
    onConfirm,
    isPending,
}: {
    venta: Sale;
    onClose: () => void;
    onConfirm: (motivo: MotivoAnulacion, notas?: string) => void;
    isPending: boolean;
}) {
    const [motivo, setMotivo] = useState<MotivoAnulacion | ''>('');
    const [notas, setNotas] = useState('');
    const [dupData, setDupData] = useState<Awaited<ReturnType<typeof checkPosibleDuplicado>> | null>(null);
    const [checkingDup, setCheckingDup] = useState(false);

    // Auto-check for duplicate on mount
    useState(() => {
        setCheckingDup(true);
        checkPosibleDuplicado(venta._id)
            .then(d => setDupData(d))
            .catch(() => {})
            .finally(() => setCheckingDup(false));
    });

    // Financial impact analysis
    const metodosEfectivo = (venta.pagos || []).filter(p => p.metodo === 'EFECTIVO');
    const metodosDigital = (venta.pagos || []).filter(p => ['QR', 'TARJETA', 'TRANSFERENCIA'].includes(p.metodo));
    const montoEfectivo = metodosEfectivo.reduce((s, p) => s + Number(p.monto), 0);
    const montoDigital = metodosDigital.reduce((s, p) => s + Number(p.monto), 0);

    const requiereNotas = motivo === 'OTRO';
    const notasOk = !requiereNotas || notas.trim().length >= 10;
    const canConfirm = motivo !== '' && notasOk && !isPending;

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                            <Ban size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-base">Anular Venta</h2>
                            <p className="text-red-200 text-[11px]">Ticket #{venta._id.slice(-6).toUpperCase()} — Bs. {Number(venta.total).toFixed(2)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/20 p-1.5 rounded-lg transition-all">
                        ✕
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

                    {/* Alerta de duplicado detectado */}
                    {checkingDup && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-xl">
                            <Loader2 size={12} className="animate-spin" /> Verificando posibles duplicados...
                        </div>
                    )}
                    {dupData?.tiene_duplicado && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                            <div className="p-1.5 bg-amber-100 rounded-lg shrink-0"><Copy size={14} className="text-amber-700" /></div>
                            <div>
                                <p className="text-xs font-bold text-amber-900 mb-0.5">⚠️ Posible venta duplicada detectada</p>
                                <p className="text-[11px] text-amber-800">
                                    Hay otra venta similar (Ticket <strong>#{dupData.candidato_id_corto}</strong> — Bs. {dupData.candidato_monto?.toFixed(2)}) del mismo cajero hace menos de 2 minutos. ¿Es esta la que querías anular?
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Impacto financiero */}
                    <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Impacto Financiero de la Anulación</p>
                        {montoEfectivo > 0 && (
                            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2">
                                <Ban size={14} className="text-red-600 shrink-0" />
                                <p className="text-[11px] text-red-800 font-medium">
                                    <strong>Bs. {montoEfectivo.toFixed(2)} en EFECTIVO</strong> saldrá del cajón de la caja activa.
                                </p>
                            </div>
                        )}
                        {montoDigital > 0 && (
                            <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-lg p-2">
                                <ShieldCheck size={14} className="text-sky-600 shrink-0" />
                                <p className="text-[11px] text-sky-800 font-medium">
                                    <strong>Bs. {montoDigital.toFixed(2)} digital (QR/Tarjeta)</strong> no afecta el cajón.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Selector de motivo */}
                    <div>
                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-wider mb-2">
                            Motivo de Anulación <span className="text-red-500">*</span>
                        </p>
                        <div className="space-y-2">
                            {MOTIVOS.map(m => (
                                <button
                                    key={m.value}
                                    onClick={() => setMotivo(m.value)}
                                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-sm ${
                                        motivo === m.value
                                            ? 'border-red-400 bg-red-50 text-red-900 ring-2 ring-red-200'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="text-base">{m.icon}</span>
                                    <div>
                                        <p className="font-bold text-[12px]">{m.label}</p>
                                        <p className="text-[10px] opacity-60">{m.desc}</p>
                                    </div>
                                    {motivo === m.value && (
                                        <div className="ml-auto text-red-500">
                                            <ShieldCheck size={16} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notas adicionales */}
                    <div>
                        <label className={`block text-[10px] font-black uppercase tracking-wider mb-1.5 ${requiereNotas ? 'text-red-600' : 'text-gray-500'}`}>
                            {requiereNotas ? 'Detalle del motivo *' : 'Notas adicionales (opcional)'}
                        </label>
                        <textarea
                            value={notas}
                            onChange={e => setNotas(e.target.value)}
                            placeholder={requiereNotas ? 'Describe el motivo con al menos 10 caracteres...' : 'Observaciones adicionales...'}
                            className={`w-full text-sm rounded-xl border p-3 outline-none focus:ring-2 resize-none h-20 transition-all ${
                                requiereNotas && notas.trim().length < 10 && notas.length > 0
                                    ? 'border-red-300 bg-red-50 focus:ring-red-200'
                                    : 'border-gray-200 bg-white focus:ring-indigo-200'
                            }`}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 pt-2 flex gap-3 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => canConfirm && onConfirm(motivo as MotivoAnulacion, notas || undefined)}
                        disabled={!canConfirm}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                            canConfirm
                                ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200 active:scale-95'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                        {isPending ? 'Procesando...' : motivo ? 'Confirmar Anulación' : 'Selecciona un motivo'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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

    // Estado del nuevo modal de anulación
    const [anularVenta, setAnularVenta] = useState<Sale | null>(null);

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
            setAnularVenta(null);
        },
        onError: (err: any) => alert(err.message || 'Error al anular la venta.')
    });

    const facturaMut = useMutation({
        mutationFn: ({ id, emitida }: { id: string, emitida: boolean }) => toggleFacturaEmitida(id, emitida),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-history'] }),
        onError: (err: any) => alert(err.message || 'Error al actualizar el estado de la factura.')
    });

    const filteredVentas = ventas.filter(v => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
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

                                        {/* Log de auditoría en ventas anuladas */}
                                        {isAnulado && (venta as any).motivo_anulacion && (
                                            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-3">
                                                <div className="p-1.5 bg-red-100 rounded-lg shrink-0">
                                                    <AlertTriangle size={14} className="text-red-600" />
                                                </div>
                                                <div className="text-xs">
                                                    <p className="font-black text-red-900 uppercase tracking-wide mb-1">Registro de Anulación</p>
                                                    <div className="space-y-0.5 text-red-800">
                                                        <p><span className="font-bold">Motivo:</span> {MOTIVOS.find(m => m.value === (venta as any).motivo_anulacion)?.label || (venta as any).motivo_anulacion}</p>
                                                        {(venta as any).notas_anulacion && <p><span className="font-bold">Notas:</span> {(venta as any).notas_anulacion}</p>}
                                                        {(venta as any).anulada_por_nombre && <p><span className="font-bold">Autorizado por:</span> {(venta as any).anulada_por_nombre}</p>}
                                                    </div>
                                                </div>
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
                                                            onClick={(e) => { e.stopPropagation(); setAnularVenta(venta); }}
                                                            disabled={anularMut.isPending}
                                                            className="flex items-center gap-1.5 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all"
                                                        >
                                                            <Ban size={16} />
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

            {/* AnularModal PRO */}
            <AnimatePresence>
                {anularVenta && (
                    <AnularModal
                        venta={anularVenta}
                        onClose={() => setAnularVenta(null)}
                        onConfirm={(motivo, notas) => anularMut.mutate({ id: anularVenta._id, motivo, notas })}
                        isPending={anularMut.isPending}
                    />
                )}
            </AnimatePresence>

            {/* Hidden Ticket Wrapper for Re-printing */}
            <div className="print-only">
                {printSale && <TicketPrinter sale={printSale} tenantName={user?.tenant_id || "Mi Tienda"} />}
            </div>
        </div>
    );
}
