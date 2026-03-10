import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    useSesionActiva, useAbrirCaja, useCerrarCaja,
    useMovimientos, useRegistrarGasto, useRegistrarIngreso,
    useCategoriasGasto, useCrearCategoriaGasto,
    useResumenCaja, useHistorialCaja,
    type CajaGastoCategoria, type CajaSesionResumen, type ResumenCaja,
} from '../hooks/useCaja';
import { getResumenCaja, getCategoriasGasto } from '../api/api';
import { generarPDFSesion } from '../utils/cajaPDF';
import {
    Unlock, Lock, MinusCircle, Plus, X,
    Receipt, Tag, RefreshCw, AlertCircle,
    History, ChevronDown, ChevronUp, ShieldCheck, Download, FileText, Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocalStorage } from 'usehooks-ts';

const fmt = (n?: number) => `Bs. ${(n || 0).toFixed(2)}`;

const formatDate = (dateStr: string, opts?: Intl.DateTimeFormatOptions) => {
    const isoStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    return new Date(isoStr).toLocaleString('es-BO', opts);
};

function exportarHistorialCSV(sesiones: CajaSesionResumen[]) {
    const headers = [
        'Fecha apertura', 'Fecha cierre', 'Cajero', 'Estado',
        'Transacciones', 'Monto inicial',
        'Ef. recibido', 'Cambio entregado', 'Ef. neto',
        'QR', 'Tarjeta', 'Gastos',
        'Total ventas', 'Saldo caja',
        'Cierre físico', 'Diferencia', 'Notas cierre',
    ];
    const rows = sesiones.map(s => [
        formatDate(s.abierta_at),
        s.cerrada_at ? formatDate(s.cerrada_at) : '',
        s.cajero_name,
        s.estado,
        s.num_transacciones,
        s.monto_inicial.toFixed(2),
        s.total_efectivo.toFixed(2),
        s.total_cambio.toFixed(2),
        (s.total_efectivo - s.total_cambio).toFixed(2),
        s.total_qr.toFixed(2),
        s.total_tarjeta.toFixed(2),
        s.total_gastos.toFixed(2),
        s.total_ventas.toFixed(2),
        s.saldo_calculado.toFixed(2),
        s.monto_cierre_fisico != null ? s.monto_cierre_fisico.toFixed(2) : '',
        s.diferencia != null ? s.diferencia.toFixed(2) : '',
        s.notas_cierre ?? '',
    ]);
    const csv = [headers, ...rows]
        .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_caja_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Subtipo badge ─────────────────────────────────────────────────────────

function SubtipoBadge({ subtipo }: { subtipo: string }) {
    const map: Record<string, { label: string; cls: string }> = {
        APERTURA: { label: 'Apertura', cls: 'bg-blue-50 text-blue-700 border border-blue-100' },
        VENTA_EFECTIVO: { label: 'Efectivo', cls: 'bg-green-50 text-green-700 border border-green-100' },
        VENTA_QR: { label: 'QR', cls: 'bg-sky-50 text-sky-700 border border-sky-100' },
        VENTA_TARJETA: { label: 'Tarjeta', cls: 'bg-purple-50 text-purple-700 border border-purple-100' },
        CAMBIO: { label: 'Cambio', cls: 'bg-amber-50 text-amber-700 border border-amber-100' },
        GASTO: { label: 'Gasto', cls: 'bg-red-50 text-red-700 border border-red-100' },
        AJUSTE: { label: 'Ajuste', cls: 'bg-gray-100 text-gray-600' },
    };
    const { label, cls } = map[subtipo] ?? { label: subtipo, cls: 'bg-gray-100 text-gray-600' };
    return (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${cls}`}>{label}</span>
    );
}


// ─── Resumen Numbers ───────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className={`rounded-xl p-2.5 border ${color}`}>
            <p className="text-[10px] font-semibold text-current opacity-60 mb-0.5">{label}</p>
            <p className="text-sm font-black font-mono">{fmt(value)}</p>
        </div>
    );
}

// ─── Historial Session Detail ────────────────────────────────────────────────

function SessionDetail({ sesion, categoriasGlobal }: { sesion: CajaSesionResumen, categoriasGlobal: CajaGastoCategoria[] }) {
    const { data: resumen, isLoading } = useResumenCaja(sesion.id);
    const efNeto = sesion.total_efectivo - sesion.total_cambio + (sesion.total_ajustes || 0);

    return (
        <tr className="bg-slate-50">
            <td colSpan={12} className="px-4 py-4">
                {/* ── Summary KPIs ── */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4 text-xs">
                    <div className="bg-white rounded-xl p-2.5 border border-gray-100">
                        <p className="text-gray-400 font-semibold mb-0.5 text-[10px]">Inicial</p>
                        <p className="font-mono font-black text-blue-700">{fmt(sesion.monto_inicial)}</p>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-green-100">
                        <p className="text-gray-400 font-semibold mb-0.5 text-[10px]">Ef. neto</p>
                        <p className="font-mono font-black text-green-700">{fmt(efNeto)}</p>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-sky-100">
                        <p className="text-gray-400 font-semibold mb-0.5 text-[10px]">QR</p>
                        <p className="font-mono font-black text-sky-700">{fmt(sesion.total_qr)}</p>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-purple-100">
                        <p className="text-gray-400 font-semibold mb-0.5 text-[10px]">Tarjeta</p>
                        <p className="font-mono font-black text-purple-700">{fmt(sesion.total_tarjeta)}</p>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-red-100">
                        <p className="text-gray-400 font-semibold mb-0.5 text-[10px]">Gastos</p>
                        <p className="font-mono font-black text-red-500">{fmt(sesion.total_gastos)}</p>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-indigo-100">
                        <p className="text-gray-400 font-semibold mb-0.5 text-[10px]">Saldo caja</p>
                        <p className="font-mono font-black text-indigo-700">{fmt(sesion.saldo_calculado)}</p>
                    </div>
                </div>

                {/* ── Cierre info ── */}
                <div className="flex flex-wrap gap-4 mb-4 text-xs text-gray-500">
                    {sesion.monto_cierre_fisico != null && (
                        <span>Cierre físico: <strong className="text-gray-800 font-mono">{fmt(sesion.monto_cierre_fisico)}</strong></span>
                    )}
                    {sesion.diferencia != null && (
                        <span className={sesion.diferencia >= 0 ? 'text-green-600' : 'text-red-500'}>
                            Diferencia: <strong className="font-mono">{sesion.diferencia >= 0 ? '+' : ''}{fmt(sesion.diferencia)}</strong>
                            {' '}<span className="opacity-70">{sesion.diferencia >= 0 ? 'sobrante' : 'faltante'}</span>
                        </span>
                    )}
                    {sesion.notas_cierre && <span className="italic">"{sesion.notas_cierre}"</span>}
                    {sesion.cerrada_at && (
                        <span>Cerrada: <strong>{formatDate(sesion.cerrada_at)}</strong></span>
                    )}
                </div>

                {/* ── Movements sub-table ── */}
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Movimientos de la sesión</p>
                {isLoading ? (
                    <div className="flex items-center gap-2 text-gray-400 text-xs py-2">
                        <RefreshCw size={12} className="animate-spin" /> Cargando...
                    </div>
                ) : (
                    <SessionTable resumen={resumen} categoriasGlobal={categoriasGlobal} />
                )}
            </td>
        </tr>
    );
}
// ─── Componentes del Reporte (Tab Session) ───────────────────────────────────

function SessionTable({ resumen, categoriasGlobal }: { resumen: ResumenCaja | undefined, categoriasGlobal: CajaGastoCategoria[] }) {
    if (!resumen || resumen.movimientos.length === 0) {
        return <p className="text-gray-400 text-xs italic">Sin movimientos registrados.</p>;
    }

    return (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-left text-xs">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase">Hora</th>
                        <th className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase">Tipo</th>
                        <th className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase">Descripción</th>
                        <th className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase">Cajero</th>
                        <th className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase text-right">Monto</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {resumen.movimientos.map((m: any) => {
                        const isDigital = m.subtipo === 'VENTA_QR' || m.subtipo === 'VENTA_TARJETA';
                        const amtColor = m.tipo === 'EGRESO' ? 'text-red-500'
                            : isDigital ? (m.subtipo === 'VENTA_QR' ? 'text-sky-600' : 'text-purple-600')
                                : 'text-green-600';
                        return (
                            <tr key={m._id} className={isDigital ? 'bg-indigo-50/20' : ''}>
                                <td className="px-3 py-1.5 font-mono text-[11px] text-gray-400">
                                    {formatDate(m.fecha, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </td>
                                <td className="px-3 py-1.5"><SubtipoBadge subtipo={m.subtipo} /></td>
                                <td className="px-3 py-1.5 text-gray-700">
                                    {m.descripcion}
                                    {m.categoria_id && (
                                        <span className="ml-2 text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                            {categoriasGlobal.find((c: CajaGastoCategoria) => c._id === m.categoria_id)?.nombre || 'Categoría'}
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-1.5 text-gray-400">{m.cajero_name}</td>
                                <td className={`px-3 py-1.5 text-right font-bold font-mono ${amtColor}`}>
                                    {m.tipo === 'INGRESO' ? '+' : '-'}{fmt(Number(m.monto))}
                                    {isDigital && <span className="ml-1 text-[9px] opacity-50">digital</span>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Historial Tab ───────────────────────────────────────────────────────────

function HistorialTab({ categoriasGlobal }: { categoriasGlobal: CajaGastoCategoria[] }) {
    const { data: sesiones = [], isLoading } = useHistorialCaja();
    const [expanded, setExpanded] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState<string | null>(null);

    async function handleExportPDF(e: React.MouseEvent, s: CajaSesionResumen) {
        e.stopPropagation(); // don't toggle expand
        setPdfLoading(s.id);
        try {
            const resumen = await getResumenCaja(s.id);
            generarPDFSesion(s, resumen);
        } finally {
            setPdfLoading(null);
        }
    }

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-400 gap-2">
                <RefreshCw size={16} className="animate-spin" /> Cargando historial...
            </div>
        );
    }

    if (sesiones.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400">
                <History size={36} className="opacity-20" />
                <p className="text-sm">No hay sesiones de caja registradas aún.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* read-only notice + export */}
            <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <ShieldCheck size={13} className="text-indigo-400" />
                    Historial de solo lectura — los registros no pueden modificarse
                </div>
                <button
                    onClick={() => exportarHistorialCSV(sesiones)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95">
                    <Download size={12} /> Exportar CSV
                </button>
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fecha / Hora</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cajero</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Txs</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">QR</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Tarjeta</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Ef. neto</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Gastos</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Total</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Saldo caja</th>
                            <th className="px-2 py-2" />
                            <th className="px-2 py-2" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sesiones.map((s: CajaSesionResumen) => {
                            const isOpen = expanded === s.id;
                            const efNeto = s.total_efectivo - s.total_cambio;
                            return (
                                <React.Fragment key={s.id}>
                                    <tr
                                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => setExpanded(isOpen ? null : s.id)}>
                                        <td className="px-3 py-2.5 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                                            {formatDate(s.abierta_at, { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                            {' '}
                                            <span className="text-gray-400">{formatDate(s.abierta_at, { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td className="px-3 py-2.5 font-medium text-gray-700">{s.cajero_name}</td>
                                        <td className="px-3 py-2.5">
                                            {s.estado === 'ABIERTA'
                                                ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Abierta</span>
                                                : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">Cerrada</span>
                                            }
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-gray-600 font-mono">{s.num_transacciones}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-sky-700">{fmt(s.total_qr)}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-purple-700">{fmt(s.total_tarjeta)}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-green-700">{fmt(efNeto)}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-red-500">{fmt(s.total_gastos)}</td>
                                        <td className="px-3 py-2.5 text-right font-bold font-mono text-indigo-700">{fmt(s.total_ventas)}</td>
                                        <td className="px-3 py-2.5 text-right font-bold font-mono text-gray-900">{fmt(s.saldo_calculado)}</td>
                                        <td className="px-2 py-2.5 text-gray-400">
                                            {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        </td>
                                        <td className="px-2 py-2.5 text-right">
                                            <button
                                                title="Exportar PDF de esta sesión"
                                                onClick={(e) => handleExportPDF(e, s)}
                                                disabled={pdfLoading === s.id}
                                                className="px-2 py-1 bg-white border border-gray-200 hover:border-gray-300 rounded text-[10px] font-bold text-gray-600 hover:text-gray-900 transition-all flex items-center gap-1 ml-auto disabled:opacity-50">
                                                {pdfLoading === s.id
                                                    ? <RefreshCw size={10} className="animate-spin" />
                                                    : <FileText size={10} />}
                                                PDF
                                            </button>
                                        </td>
                                    </tr>
                                    {isOpen && <SessionDetail key={`${s.id}-detail`} sesion={s} categoriasGlobal={categoriasGlobal} />}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


// ─── Main Component ─────────────────────────────────────────────────────────

export default function CajaPage() {
    const { data: categoriasGlobal = [] } = useQuery({ queryKey: ['categorias-gasto-global'], queryFn: getCategoriasGasto });

    const { data: sesion, isLoading: loadingSesion } = useSesionActiva();
    const { data: movimientos = [], isLoading: loadingMov } = useMovimientos();
    const { data: categorias = [] } = useCategoriasGasto();

    const abrirMut = useAbrirCaja();
    const cerrarMut = useCerrarCaja();
    const gastoMut = useRegistrarGasto();
    const ingresoMut = useRegistrarIngreso();
    const catMut = useCrearCategoriaGasto();

    const { data: resumen } = useResumenCaja(sesion?._id);

    // ── Tab state ─────────────────────────────────────────────────────────
    const [tab, setTab] = useLocalStorage<'sesion' | 'historial'>('caja-tab', 'sesion');
    const [kpiOpen, setKpiOpen] = useLocalStorage<boolean>('caja-kpi-open', true);

    // ── Modal state ───────────────────────────────────────────────────────
    type ModalType = 'abrir' | 'gasto' | 'ingreso' | 'cierre' | 'categoria' | null;
    const [modal, setModal] = useState<ModalType>(null);
    const closeModal = () => setModal(null);

    // abrir caja
    const [montoInicial, setMontoInicial] = useState('');

    // gasto
    const [gastoMonto, setGastoMonto] = useState('');
    const [gastoDesc, setGastoDesc] = useState('');
    const [gastoCategId, setGastoCategId] = useState('');

    // ingreso manual
    const [ingresoMonto, setIngresoMonto] = useState('');
    const [ingresoDesc, setIngresoDesc] = useState('');
    const [ingresoMetodo, setIngresoMetodo] = useState<'EFECTIVO' | 'QR' | 'TARJETA'>('EFECTIVO');

    // cierre
    const [notasCierre, setNotasCierre] = useState('');
    // Denominaciones (Calculadora de cierre)
    const [billetes, setBilletes] = useState<Record<string, number>>({ '200': 0, '100': 0, '50': 0, '20': 0, '10': 0 });
    const [monedas, setMonedas] = useState<Record<string, number>>({ '5': 0, '2': 0, '1': 0, '0.50': 0, '0.20': 0, '0.10': 0 });
    const totalFisicoCalculado = Object.entries(billetes).reduce((acc, [k, v]) => acc + (parseFloat(k) * (v || 0)), 0) +
        Object.entries(monedas).reduce((acc, [k, v]) => acc + (parseFloat(k) * (v || 0)), 0);

    // nueva categoría
    const [catNombre, setCatNombre] = useState('');
    const [catDesc, setCatDesc] = useState('');
    const [catIcono, setCatIcono] = useState('receipt');

    // ── Computed ──────────────────────────────────────────────────────────
    const saldoActual = resumen
        ? resumen.monto_inicial + resumen.total_efectivo_ventas - resumen.total_cambio - resumen.total_gastos + (resumen.total_ajustes || 0)
        : 0;

    const diferencia = (totalFisicoCalculado > 0 || modal === 'cierre')
        ? totalFisicoCalculado - (resumen?.saldo_calculado ?? 0)
        : null;

    // ── Handlers ──────────────────────────────────────────────────────────

    const handleAbrirCaja = () => {
        if (!montoInicial) return;
        abrirMut.mutate({ monto_inicial: parseFloat(montoInicial) }, {
            onSuccess: () => { setMontoInicial(''); closeModal(); },
        });
    };

    const handleGasto = () => {
        if (!gastoMonto || !gastoDesc) return;
        gastoMut.mutate({
            monto: parseFloat(gastoMonto),
            descripcion: gastoDesc,
            categoria_id: gastoCategId || undefined,
        }, {
            onSuccess: () => { setGastoMonto(''); setGastoDesc(''); setGastoCategId(''); closeModal(); },
        });
    };

    const handleIngreso = () => {
        if (!ingresoMonto || !ingresoDesc) return;
        ingresoMut.mutate({
            monto: parseFloat(ingresoMonto),
            descripcion: ingresoDesc,
            metodo: ingresoMetodo,
        }, {
            onSuccess: () => { setIngresoMonto(''); setIngresoDesc(''); setIngresoMetodo('EFECTIVO'); closeModal(); },
        });
    };

    const handleCierre = () => {
        if (!sesion || totalFisicoCalculado === 0) return;
        cerrarMut.mutate({
            sesionId: sesion._id,
            data: { monto_fisico_contado: totalFisicoCalculado, notas: notasCierre || undefined },
        }, {
            onSuccess: () => {
                setBilletes({ '200': 0, '100': 0, '50': 0, '20': 0, '10': 0 });
                setMonedas({ '5': 0, '2': 0, '1': 0, '0.50': 0, '0.20': 0, '0.10': 0 });
                setNotasCierre('');
                closeModal();
                setTab('historial');
            },
        });
    };

    const handleCrearCategoria = () => {
        if (!catNombre) return;
        catMut.mutate({ nombre: catNombre, descripcion: catDesc || undefined, icono: catIcono }, {
            onSuccess: () => { setCatNombre(''); setCatDesc(''); setCatIcono('receipt'); closeModal(); },
        });
    };

    // ── Loading ───────────────────────────────────────────────────────────
    if (loadingSesion) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                <RefreshCw size={20} className="animate-spin mr-2" /> Cargando caja...
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // UI
    // ─────────────────────────────────────────────────────────────────────
    return (
        <div className="p-4 space-y-3 h-full flex flex-col overflow-y-auto">

            {/* ── Tabs de Navegación (Estilo Navegador) ── */}
            <div className="flex gap-1 pl-0 relative z-10 w-full mb-0">
                <button onClick={() => setTab('sesion')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-t-xl text-xs font-bold transition-all border-b-0 ${tab === 'sesion' ? 'bg-gray-900 border border-gray-900 text-white z-20 shadow-[0_4px_0_0_#111827]' : 'bg-gray-200 border border-gray-300 text-gray-500 hover:bg-gray-300'
                        }`}>
                    <Wallet size={14} className={tab === 'sesion' ? 'text-indigo-400' : 'text-gray-400'} /> Sesión actual
                </button>
                <button onClick={() => setTab('historial')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-t-xl text-xs font-bold transition-all border-b-0 ${tab === 'historial' ? 'bg-white border border-gray-200 text-gray-900 z-20 shadow-[0_4px_0_0_#ffffff]' : 'bg-gray-200 border border-gray-300 text-gray-500 hover:bg-gray-300'
                        }`}>
                    <History size={14} className={tab === 'historial' ? 'text-indigo-600' : 'text-gray-400'} /> Historial
                </button>
            </div>

            {/* ── Top: estado de caja ── */}
            <div className={`text-white rounded-2xl rounded-tl-none px-5 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 relative overflow-hidden shadow-xl transition-colors z-20 ${tab === 'historial' ? 'bg-white text-gray-900 border border-t-0 border-gray-200' : 'bg-gray-900 border border-t-0 border-gray-900'}`}>
                {/* glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />

                <div className="relative z-10 flex-1 flex justify-between items-center w-full">
                    <div>
                        <p className={`text-[10px] font-semibold uppercase tracking-widest mb-0.5 ${tab === 'historial' ? 'text-gray-500' : 'text-gray-400'}`}>Efectivo en caja</p>
                        <p className={`text-2xl font-black font-mono ${tab === 'historial' ? 'text-gray-900' : 'text-white'}`}>{sesion ? fmt(saldoActual) : '—'}</p>
                        {sesion && (
                            <p className={`text-[10px] mt-0.5 ${tab === 'historial' ? 'text-gray-400' : 'text-gray-500'}`}>
                                Abierta {formatDate(sesion.abierta_at || new Date().toISOString(), { hour: '2-digit', minute: '2-digit' })}
                                {' '}· {sesion.cajero_name}
                            </p>
                        )}
                    </div>
                    {tab === 'sesion' && (
                        <div className="flex gap-2 flex-wrap justify-end">
                            {!sesion ? (
                                <button onClick={() => setModal('abrir')}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg font-bold text-xs transition-all active:scale-95">
                                    <Unlock size={14} /> Abrir Caja
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => setModal('ingreso')}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 rounded-lg font-bold text-xs transition-all active:scale-95">
                                        <Plus size={13} /> Ingreso
                                    </button>
                                    <button onClick={() => setModal('gasto')}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg font-bold text-xs transition-all active:scale-95">
                                        <MinusCircle size={13} /> Gasto
                                    </button>
                                    <button onClick={() => setModal('categoria')}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-lg font-bold text-xs transition-all active:scale-95">
                                        <Tag size={13} /> Categorías
                                    </button>
                                    <button onClick={() => setModal('cierre')}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs transition-all active:scale-95">
                                        <Lock size={13} /> Cerrar Caja
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Toggle Resumen Tab (attached to top container) */}
            {tab === 'sesion' && sesion && resumen && (
                <div className="flex pl-6 -mt-3.5 relative z-10 mb-2">
                    <button onClick={() => setKpiOpen(!kpiOpen)}
                        className={`flex items-center gap-2 px-6 py-1.5 rounded-b-xl text-[10px] font-bold transition-all border border-t-0 shadow-sm ${kpiOpen ? 'bg-white border-gray-200 text-gray-600' : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'}`}
                    >
                        {kpiOpen ? 'Ocultar Resumen' : 'Mostrar Resumen'}
                        {kpiOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                </div>
            )}

            {/* ── Historial Tab ── */}
            {tab === 'historial' && <HistorialTab categoriasGlobal={categorias} />}

            <AnimatePresence initial={false}>
                {tab === 'sesion' && sesion && resumen && kpiOpen && (
                    <motion.div
                        key="resumen-kpis"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-2 overflow-hidden mb-2 mt-2"
                    >
                        {/* Cash drawer */}
                        <div className="grid grid-cols-4 gap-2">
                            <StatCard label="Inicial" value={resumen.monto_inicial} color="border-blue-200 bg-blue-50 text-blue-800" />
                            <StatCard label="Ef. Recibido (+Ingresos)" value={resumen.total_efectivo_ventas + (resumen.total_ingresos_efectivo || 0)} color="border-green-200 bg-green-50 text-green-800" />
                            <StatCard label="Cambio" value={resumen.total_cambio} color="border-amber-200 bg-amber-50 text-amber-800" />
                            <StatCard label="Gastos" value={resumen.total_gastos} color="border-red-200 bg-red-50 text-red-800" />
                        </div>
                        {/* Digital channels + grand total */}
                        <div className="grid grid-cols-4 gap-2">
                            <div className="rounded-xl p-2.5 border border-sky-200 bg-sky-50 text-sky-800">
                                <p className="text-[10px] font-semibold opacity-60 mb-0.5">QR (+Ingresos)</p>
                                <p className="text-sm font-black font-mono">{fmt(resumen.total_qr)}</p>
                            </div>
                            <div className="rounded-xl p-2.5 border border-purple-200 bg-purple-50 text-purple-800">
                                <p className="text-[10px] font-semibold opacity-60 mb-0.5">Tarjeta (+Ingresos)</p>
                                <p className="text-sm font-black font-mono">{fmt(resumen.total_tarjeta)}</p>
                            </div>
                            <div className="rounded-xl p-2.5 border border-gray-200 bg-gray-100 text-gray-600">
                                <p className="text-[10px] font-semibold opacity-60 mb-0.5">Ajustes</p>
                                <p className="text-sm font-black font-mono">{fmt(resumen.total_ajustes || 0)}</p>
                            </div>
                            <div className="rounded-xl p-2.5 border-2 border-indigo-200 bg-indigo-50 text-indigo-900 border-dashed">
                                <p className="text-[10px] font-semibold opacity-60 mb-0.5">Calculado {sesion?.estado === 'CERRADA' ? '(Final)' : '(Actual)'}</p>
                                <p className="text-sm font-black font-mono">{fmt(resumen.saldo_calculado)}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── No open session call-to-action ── */}
            {
                tab === 'sesion' && !sesion && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
                        <AlertCircle size={40} className="opacity-30" />
                        <p className="text-sm">No hay una sesión de caja abierta.</p>
                        <button onClick={() => setModal('abrir')}
                            className="mt-2 px-6 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-500 transition-colors">
                            Abrir Caja ahora
                        </button>
                    </div>
                )
            }

            {/* ── Movements table ── */}
            {
                tab === 'sesion' && sesion && (
                    <div className="flex-1 bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden shadow-sm min-h-0">
                        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                                <Receipt size={14} className="text-gray-400" /> Movimientos del día
                            </h3>
                            <span className="text-xs text-gray-400">{movimientos.length} registros</span>
                        </div>
                        <div className="flex-1 overflow-auto">
                            {loadingMov ? (
                                <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
                            ) : movimientos.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 text-sm">Sin movimientos aún.</div>
                            ) : (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hora</th>
                                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tipo</th>
                                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Descripción</th>
                                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cajero</th>
                                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {movimientos.map((m) => {
                                            const isDigital = m.subtipo === 'VENTA_QR' || m.subtipo === 'VENTA_TARJETA';
                                            const amtColor = m.tipo === 'EGRESO'
                                                ? 'text-red-500'
                                                : isDigital
                                                    ? m.subtipo === 'VENTA_QR' ? 'text-sky-600' : 'text-purple-600'
                                                    : 'text-green-600';
                                            return (
                                                <tr key={m._id} className={`transition-colors ${isDigital ? 'bg-indigo-50/30 hover:bg-indigo-50/60' : 'hover:bg-gray-50'
                                                    }`}>
                                                    <td className="px-3 py-1.5 font-mono text-[11px] text-gray-400">
                                                        {formatDate(m.fecha, { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <SubtipoBadge subtipo={m.subtipo} />
                                                    </td>
                                                    <td className="px-3 py-1.5 text-gray-700 font-medium text-xs">
                                                        {m.descripcion}
                                                        {m.categoria_id && (
                                                            <span className="ml-2 text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                                                {categoriasGlobal.find(c => c._id === m.categoria_id)?.nombre || 'Categoría'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-gray-400 text-[11px]">{m.cajero_name}</td>
                                                    <td className={`px-3 py-1.5 text-right font-bold font-mono text-xs ${amtColor}`}>
                                                        {m.tipo === 'INGRESO' ? '+' : '-'}{fmt(Number(m.monto))}
                                                        {isDigital && <span className="ml-1 text-[9px] opacity-50">digital</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )
            }

            {/* ═══════════════════════ MODALS ═══════════════════════════════ */}

            <AnimatePresence>
                {modal && (
                    <motion.div
                        key="caja-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            key="caja-modal-content"
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl relative"
                        >
                            <button onClick={closeModal} className="absolute top-5 right-5 text-gray-300 hover:text-gray-600 transition-colors">
                                <X size={20} />
                            </button>

                            {/* ── ABRIR CAJA ── */}
                            {modal === 'abrir' && (
                                <>
                                    <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mb-4">
                                        <Unlock size={22} className="text-green-600" />
                                    </div>
                                    <h2 className="text-xl font-black mb-1">Apertura de Caja</h2>
                                    <p className="text-sm text-gray-400 mb-5">Ingresá el efectivo con el que arranca la caja hoy.</p>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Monto inicial (Bs.)</label>
                                    <input type="number" step="0.01" autoFocus
                                        className="w-full bg-gray-50 rounded-xl p-4 text-2xl font-bold outline-none focus:ring-2 focus:ring-green-400 mb-6 text-gray-900"
                                        placeholder="0.00" value={montoInicial} onChange={e => setMontoInicial(e.target.value)} />
                                    <button onClick={handleAbrirCaja} disabled={!montoInicial || abrirMut.isPending}
                                        className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors">
                                        {abrirMut.isPending ? 'Abriendo...' : 'Confirmar Apertura'}
                                    </button>
                                </>
                            )}

                            {/* ── GASTO ── */}
                            {modal === 'gasto' && (
                                <>
                                    <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
                                        <MinusCircle size={22} className="text-red-600" />
                                    </div>
                                    <h2 className="text-xl font-black mb-1">Registrar Gasto</h2>
                                    <p className="text-sm text-gray-400 mb-5">Salida de efectivo de caja.</p>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Categoría</label>
                                            <div className="flex gap-2">
                                                <select value={gastoCategId} onChange={e => setGastoCategId(e.target.value)}
                                                    className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-300 text-gray-900">
                                                    <option value="">Sin categoría</option>
                                                    {categorias.map(c => (
                                                        <option key={c._id} value={c._id}>{c.nombre}</option>
                                                    ))}
                                                </select>
                                                <button onClick={() => setModal('categoria')} title="Nueva categoría"
                                                    className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-500 transition-colors">
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Descripción</label>
                                            <input type="text" autoFocus
                                                className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-300 text-gray-900"
                                                placeholder="Ej: Pasaje movilidad, limpieza..."
                                                value={gastoDesc} onChange={e => setGastoDesc(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Monto (Bs.)</label>
                                            <input type="number" step="0.01"
                                                className="w-full bg-gray-50 rounded-xl p-4 text-2xl font-bold outline-none focus:ring-2 focus:ring-red-300 text-gray-900"
                                                placeholder="0.00"
                                                value={gastoMonto} onChange={e => setGastoMonto(e.target.value)} />
                                        </div>
                                    </div>

                                    <button onClick={handleGasto} disabled={!gastoMonto || !gastoDesc || gastoMut.isPending}
                                        className="w-full mt-5 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors">
                                        {gastoMut.isPending ? 'Guardando...' : 'Registrar Gasto'}
                                    </button>
                                </>
                            )}

                            {/* ── INGRESO ── */}
                            {modal === 'ingreso' && (
                                <>
                                    <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mb-4">
                                        <Plus size={22} className="text-green-600" />
                                    </div>
                                    <h2 className="text-xl font-black mb-1">Registrar Ingreso</h2>
                                    <p className="text-sm text-gray-400 mb-5">Ingreso de dinero a caja (ej. sencillo, ventas sin inventario).</p>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Método de pago</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {['EFECTIVO', 'QR', 'TARJETA'].map(m => (
                                                    <button key={m}
                                                        onClick={() => setIngresoMetodo(m as any)}
                                                        className={`py-2 rounded-xl text-xs font-bold transition-colors border ${ingresoMetodo === m
                                                                ? 'bg-green-100 border-green-300 text-green-700'
                                                                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                                            }`}
                                                    >
                                                        {m}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Descripción</label>
                                            <input type="text" autoFocus
                                                className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-300 text-gray-900"
                                                placeholder="Ej: Cambio (sencillo) o Venta Manual..."
                                                value={ingresoDesc} onChange={e => setIngresoDesc(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Monto (Bs.)</label>
                                            <input type="number" step="0.01"
                                                className="w-full bg-gray-50 rounded-xl p-4 text-2xl font-bold outline-none focus:ring-2 focus:ring-green-300 text-gray-900"
                                                placeholder="0.00"
                                                value={ingresoMonto} onChange={e => setIngresoMonto(e.target.value)} />
                                        </div>
                                    </div>

                                    <button onClick={handleIngreso} disabled={!ingresoMonto || !ingresoDesc || ingresoMut.isPending}
                                        className="w-full mt-5 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors">
                                        {ingresoMut.isPending ? 'Guardando...' : 'Registrar Ingreso'}
                                    </button>
                                </>
                            )}

                            {/* ── CIERRE DE CAJA ── */}
                            {modal === 'cierre' && (
                                <>
                                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                                        <Lock size={22} className="text-indigo-600" />
                                    </div>
                                    <h2 className="text-xl font-black mb-1">Cierre de Caja</h2>
                                    <p className="text-sm text-gray-400 mb-4">Verificá el arqueo antes de cerrar.</p>

                                    {/* Resumen automático */}
                                    <div className="bg-gray-50 rounded-2xl p-4 text-sm space-y-2 mb-4 border border-gray-100">
                                        <div className="flex justify-between text-gray-500">
                                            <span>Monto inicial</span>
                                            <span className="font-mono font-bold text-gray-700">+ {fmt(resumen?.monto_inicial)}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-500">
                                            <span>Efectivo por ventas</span>
                                            <span className="font-mono font-bold text-green-600">+ {fmt(resumen?.total_efectivo_ventas)}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-500">
                                            <span>Ingresos manuales (Ef.)</span>
                                            <span className="font-mono font-bold text-green-600">+ {fmt(resumen?.total_ingresos_efectivo)}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-500">
                                            <span>Cambio entregado</span>
                                            <span className="font-mono font-bold text-amber-600">- {fmt(resumen?.total_cambio)}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-500">
                                            <span>Total gastos</span>
                                            <span className="font-mono font-bold text-red-500">- {fmt(resumen?.total_gastos)}</span>
                                        </div>
                                        <div className="border-t border-gray-200 pt-2 flex justify-between font-black text-gray-900">
                                            <span>Saldo calculado</span>
                                            <span className="font-mono">{fmt(resumen?.saldo_calculado)}</span>
                                        </div>
                                    </div>


                                    {/* ==== Calculadora de Billetes y Monedas ==== */}
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        {/* Billetes */}
                                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Billetes (Cant.)</h3>
                                            <div className="space-y-1">
                                                {Object.entries(billetes).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0])).map(([val, cant]) => (
                                                    <div key={`b-${val}`} className="flex items-center justify-between group">
                                                        <span className="text-[11px] font-bold text-gray-500 w-12 text-right">Bs {val}</span>
                                                        <input
                                                            type="number" min="0"
                                                            className="w-16 ml-2 bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm text-right font-mono transition-all focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                                                            value={cant || ''}
                                                            placeholder="0"
                                                            onChange={e => setBilletes(prev => ({ ...prev, [val]: parseInt(e.target.value) || 0 }))}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Monedas */}
                                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Monedas (Cant.)</h3>
                                            <div className="space-y-1">
                                                {Object.entries(monedas).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0])).map(([val, cant]) => (
                                                    <div key={`m-${val}`} className="flex items-center justify-between group">
                                                        <span className="text-[11px] font-bold text-gray-500 w-12 text-right">Bs {val}</span>
                                                        <input
                                                            type="number" min="0"
                                                            className="w-16 ml-2 bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm text-right font-mono transition-all focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                                                            value={cant || ''}
                                                            placeholder="0"
                                                            onChange={e => setMonedas(prev => ({ ...prev, [val]: parseInt(e.target.value) || 0 }))}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex justify-between items-center mb-4">
                                        <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Efectivo Físico Contado</span>
                                        <span className="text-2xl font-black font-mono text-indigo-900">Bs. {fmt(totalFisicoCalculado)}</span>
                                    </div>

                                    {diferencia !== null && totalFisicoCalculado > 0 && (
                                        <p className={`text-sm font-bold mb-3 text-center ${Math.abs(diferencia) < 0.01 ? 'text-green-600' : diferencia > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                            {Math.abs(diferencia) < 0.01
                                                ? '✓ Cuadra perfecto'
                                                : diferencia > 0
                                                    ? `↑ Sobrante en caja: ${fmt(diferencia)}`
                                                    : `↓ Faltante en caja: ${fmt(Math.abs(diferencia))}`}
                                        </p>
                                    )}

                                    {(() => {
                                        // Tolerancia de 0.50 centavos
                                        const requiereJustificacion = diferencia !== null && diferencia < -0.50;
                                        const notasAceptables = notasCierre && notasCierre.length >= 10;
                                        const btnDisabled = totalFisicoCalculado === 0 || cerrarMut.isPending || (requiereJustificacion && !notasAceptables);

                                        return (
                                            <>
                                                <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${requiereJustificacion ? 'text-red-500' : 'text-gray-500'}`}>
                                                    {requiereJustificacion ? 'Justificación Obligatoria' : 'Notas (opcional)'}
                                                </label>
                                                <textarea
                                                    className={`w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 mb-5 resize-none h-20
                                                        ${requiereJustificacion ? 'border border-red-300 focus:ring-red-400 text-red-900 bg-red-50 placeholder-red-300' : 'focus:ring-indigo-300 text-gray-900'}`}
                                                    placeholder={requiereJustificacion ? "Explica detalladamente por qué falta dinero..." : "Observaciones..."}
                                                    value={notasCierre} onChange={e => setNotasCierre(e.target.value)}
                                                />

                                                <button onClick={handleCierre} disabled={btnDisabled}
                                                    className={`w-full py-3 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50
                                                        ${requiereJustificacion && !notasAceptables ? 'bg-red-400' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                                                    {cerrarMut.isPending ? 'Cerrando...' : requiereJustificacion && !notasAceptables ? 'Justificación requerida (Faltante)' : 'Confirmar Cierre y Arqueo'}
                                                </button>
                                            </>
                                        );
                                    })()}
                                </>
                            )}

                            {/* ── NUEVA CATEGORÍA DE GASTO ── */}
                            {modal === 'categoria' && (
                                <>
                                    <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mb-4">
                                        <Tag size={22} className="text-purple-600" />
                                    </div>
                                    <h2 className="text-xl font-black mb-1">Nueva categoría de gasto</h2>
                                    <p className="text-sm text-gray-400 mb-5">Organizá los gastos por tipo.</p>

                                    {/* Existing categories */}
                                    {categorias.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {categorias.map((c: CajaGastoCategoria) => (
                                                <span key={c._id} className="px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-600">
                                                    {c.nombre}
                                                </span>
                                            ))}
                                        </div>
                                    )}


                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre</label>
                                            <input type="text" autoFocus
                                                className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-300 text-gray-900"
                                                placeholder="Ej: Pasajes, Limpieza, Insumos..."
                                                value={catNombre} onChange={e => setCatNombre(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Descripción (opcional)</label>
                                            <input type="text"
                                                className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-300 text-gray-900"
                                                placeholder="Detalle..."
                                                value={catDesc} onChange={e => setCatDesc(e.target.value)} />
                                        </div>
                                    </div>

                                    <button onClick={handleCrearCategoria} disabled={!catNombre || catMut.isPending}
                                        className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-xl font-bold text-sm transition-colors mt-2">
                                        {catMut.isPending ? 'Guardando...' : 'Crear Categoría'}
                                    </button>
                                </>
                            )}

                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
