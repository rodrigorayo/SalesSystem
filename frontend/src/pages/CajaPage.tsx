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
    Receipt, Tag, RefreshCw, AlertCircle, AlertTriangle,
    History, ChevronDown, ChevronUp, ShieldCheck, Download, FileText, Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocalStorage } from 'usehooks-ts';
import { formatDate } from '../utils/dateUtils';


const fmt = (n?: number) => `Bs. ${(n || 0).toFixed(2)}`;


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

function SessionTable({ resumen, categoriasGlobal, filterCashOnly }: { resumen: ResumenCaja | undefined, categoriasGlobal: CajaGastoCategoria[], filterCashOnly?: boolean }) {
    if (!resumen || resumen.movimientos.length === 0) {
        return <p className="text-gray-400 text-xs italic">Sin movimientos registrados.</p>;
    }

    return (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            {filterCashOnly && (
                <div className="px-3 py-1 bg-yellow-50/80 border-b border-yellow-100 text-[10px] text-yellow-800 font-bold flex items-center justify-center">
                    ⚠️ MODO AUDITORÍA: Mostrando solo transacciones que afectan al cajón de efectivo (Los pagos digitales están ocultos).
                </div>
            )}
            <table className="w-full text-left text-xs">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase">Fecha / Hora</th>
                        <th className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase">Tipo</th>
                        <th className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase">Descripción</th>
                        <th className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase">Cajero</th>
                        <th className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase text-right">Monto</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {resumen.movimientos
                        .filter((m: any) => filterCashOnly ? !['VENTA_QR', 'VENTA_TARJETA', 'INGRESO_QR', 'INGRESO_TARJETA'].includes(m.subtipo) : true)
                        .map((m: any) => {
                        const isDigital = m.subtipo === 'VENTA_QR' || m.subtipo === 'VENTA_TARJETA';
                        const amtColor = m.tipo === 'EGRESO' ? 'text-red-500'
                            : isDigital ? (m.subtipo === 'VENTA_QR' ? 'text-sky-600' : 'text-purple-600')
                                : 'text-green-600';
                        return (
                            <tr key={m._id} className={isDigital ? 'bg-indigo-50/20' : ''}>
                                <td className="px-3 py-1.5 font-mono text-[10px] text-gray-400 leading-tight">
                                    {formatDate(m.fecha, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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

    // apertura
    const [montoInicial, setMontoInicial] = useState('');
    const [aperturaDetallada, setAperturaDetallada] = useState(true);

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
    const [conteoDetallado, setConteoDetallado] = useState(false);
    const [montoFisicoManual, setMontoFisicoManual] = useState('');
    const [filterCashOnly, setFilterCashOnly] = useState<boolean>(true);

    // Denominaciones (Calculadora de cierre)
    const [billetes, setBilletes] = useState<Record<string, number>>({ '200': 0, '100': 0, '50': 0, '20': 0, '10': 0 });
    const [monedas, setMonedas] = useState<Record<string, number>>({ '5': 0, '2': 0, '1': 0, '0.50': 0, '0.20': 0, '0.10': 0 });
    
    // El "Total" final depende de si es detallado o manual, aproximado a 2 decimales para evitar ruido de punto flotante de JS
    const totalFisicoCalculadoRaw = Object.entries(billetes).reduce((acc, [k, v]) => acc + (parseFloat(k) * (v || 0)), 0) +
        Object.entries(monedas).reduce((acc, [k, v]) => acc + (parseFloat(k) * (v || 0)), 0);

    const totalAperturaFinal = Math.round((aperturaDetallada ? totalFisicoCalculadoRaw : (parseFloat(montoInicial) || 0)) * 100) / 100;
    const totalFisicoFinal   = Math.round((conteoDetallado ? totalFisicoCalculadoRaw : (parseFloat(montoFisicoManual) || 0)) * 100) / 100;

    // nueva categoría
    const [catNombre, setCatNombre] = useState('');
    const [catDesc, setCatDesc] = useState('');
    const [catIcono, setCatIcono] = useState('receipt');

    // ── Computed ──────────────────────────────────────────────────────────
    const saldoActual = resumen
        ? resumen.monto_inicial + resumen.total_efectivo_ventas - resumen.total_cambio - resumen.total_gastos + (resumen.total_ajustes || 0)
        : 0;

    const ventasPuras = (resumen?.movimientos || [])
        .filter((m: any) => m.subtipo === 'VENTA_EFECTIVO' && m.tipo === 'INGRESO')
        .reduce((sum: number, m: any) => sum + Number(m.monto), 0);
        
    const anulacionesPuras = (resumen?.movimientos || [])
        .filter((m: any) => m.subtipo === 'VENTA_EFECTIVO' && m.tipo === 'EGRESO')
        .reduce((sum: number, m: any) => sum + Number(m.monto), 0);

    const diferencia = (totalFisicoFinal > 0 || modal === 'cierre')
        ? totalFisicoFinal - (resumen?.saldo_calculado ?? 0)
        : null;

    // ── Handlers ──────────────────────────────────────────────────────────

    const handleAbrirCaja = () => {
        if (totalAperturaFinal <= 0) return;
        abrirMut.mutate({ monto_inicial: totalAperturaFinal }, {
            onSuccess: () => { 
                setMontoInicial(''); 
                setBilletes({ '200': 0, '100': 0, '50': 0, '20': 0, '10': 0 });
                setMonedas({ '5': 0, '2': 0, '1': 0, '0.50': 0, '0.20': 0, '0.10': 0 });
                closeModal(); 
            },
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
        if (!sesion || totalFisicoFinal === 0) return;
        cerrarMut.mutate({
            sesionId: sesion._id,
            data: { monto_fisico_contado: totalFisicoFinal, notas: notasCierre || undefined },
        }, {
            onSuccess: () => {
                setBilletes({ '200': 0, '100': 0, '50': 0, '20': 0, '10': 0 });
                setMonedas({ '5': 0, '2': 0, '1': 0, '0.50': 0, '0.20': 0, '0.10': 0 });
                setMontoFisicoManual('');
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
        <div className="px-3 md:p-4 py-4 space-y-3 h-full flex flex-col overflow-y-auto pb-20 md:pb-4">

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
                        className="space-y-4 overflow-hidden mb-2 mt-2"
                    >
                        {/* Bloque Fondo Fijo: Flujo Físico */}
                        <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col gap-3 shadow-sm">
                            <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider flex justify-between items-center bg-gray-50/80 p-2 rounded-lg border border-gray-100">
                                <span>Flujo de Efectivo Físico (Modelo Fondo Fijo)</span>
                                <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">Saldo Esperado: {fmt(resumen.saldo_calculado)}</span>
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div className="rounded-xl p-2.5 border-l-4 border-blue-400 bg-blue-50 text-blue-900 flex flex-col justify-between">
                                    <p className="text-[10px] font-bold opacity-70 mb-1 leading-tight">Monto Inicial<br/><span className="text-[9px] font-normal opacity-70">(Base para mañana)</span></p>
                                    <p className="text-sm font-black font-mono">{fmt(resumen.monto_inicial)}</p>
                                </div>
                                <div className="rounded-xl p-2.5 border border-green-100 bg-green-50 text-green-800 flex flex-col justify-between">
                                    <p className="text-[10px] font-bold opacity-70 mb-1 leading-tight">Total Ingresos Efectivo<br/><span className="text-[9px] font-normal opacity-70">(Ventas Puras + Manuales)</span></p>
                                    <p className="text-sm font-black font-mono">+{fmt(ventasPuras + (resumen.total_ingresos_efectivo || 0))}</p>
                                </div>
                                <div className="rounded-xl p-2.5 border border-red-100 bg-red-50 text-red-800 flex flex-col justify-between group relative cursor-help">
                                    <p className="text-[10px] font-bold opacity-70 mb-1 leading-tight">Salidas y Anulaciones<br/><span className="text-[9px] font-normal opacity-70">(Vueltos + Gast. + Anul.)</span></p>
                                    <p className="text-sm font-black font-mono">-{fmt(resumen.total_gastos + resumen.total_cambio + Math.abs(anulacionesPuras) - (resumen.total_ajustes || 0))}</p>
                                    
                                    {/* Tooltip Hover Explicativo */}
                                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] rounded p-2 z-20 shadow-xl">
                                        <p className="font-bold border-b border-gray-700 pb-1 mb-1">Desglose de Salidas:</p>
                                        <div className="flex justify-between"><span>Gastos Físicos:</span><span className="font-mono">{fmt(resumen.total_gastos)}</span></div>
                                        <div className="flex justify-between"><span>Vueltos/Cambio:</span><span className="font-mono">{fmt(resumen.total_cambio)}</span></div>
                                        <div className="flex justify-between text-red-300"><span>Ventas Anuladas:</span><span className="font-mono">{fmt(Math.abs(anulacionesPuras))}</span></div>
                                    </div>
                                </div>
                                <div className="rounded-xl p-2.5 border-2 border-dashed border-indigo-300 bg-indigo-50 flex flex-col justify-between relative overflow-hidden">
                                     <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-600/5 rounded-full blur-xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                                     <p className="text-[10px] font-bold text-indigo-800/80 mb-1 leading-tight">Monto A Entregar<br/><span className="text-[9px] font-normal text-indigo-700/80">(Ganancia Neta Física)</span></p>
                                     <p className="text-sm font-black font-mono text-indigo-900">{fmt(Math.max(0, resumen.saldo_calculado - resumen.monto_inicial))}</p>
                                </div>
                            </div>
                        </div>

                        {/* Canales Digitales y Totales */}
                        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                             <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between mb-2 px-1">
                                 <span>Pagos Digitales (Directo a Banco)</span>
                                 <span className="text-[9px] lowercase opacity-60">Estos ingresos no se contabilizan en el flujo físico</span>
                             </h3>
                             <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-xl p-2 border border-sky-100 bg-sky-50/50 flex justify-between items-center text-sky-800">
                                    <span className="text-[11px] font-semibold">QR Total</span>
                                    <span className="text-xs font-bold font-mono text-sky-900">{fmt(resumen.total_qr)}</span>
                                </div>
                                <div className="rounded-xl p-2 border border-purple-100 bg-purple-50/50 flex justify-between items-center text-purple-800">
                                    <span className="text-[11px] font-semibold">Tarjeta / POS</span>
                                    <span className="text-xs font-bold font-mono text-purple-900">{fmt(resumen.total_tarjeta)}</span>
                                </div>
                             </div>
                        </div>

                        {/* Panel de Auditoría / Insights Automáticos */}
                        {anulacionesPuras > 0 && (
                            <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="bg-red-50/80 rounded-xl border border-red-200 p-3 shadow-sm flex items-start gap-3 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                                <div className="p-2 bg-red-100 text-red-600 rounded-full shrink-0">
                                    <AlertTriangle size={16} />
                                </div>
                                <div className="z-10 relative">
                                    <h4 className="text-[11px] font-bold text-red-900 leading-tight flex items-center gap-1.5 uppercase tracking-wide">Modo Auditoría <span className="px-1.5 py-0.5 bg-red-200 text-red-800 rounded bg-opacity-50 text-[9px]">Alerta Detectada</span></h4>
                                    <p className="text-[11px] text-red-800 mt-1.5 font-medium leading-relaxed">
                                        Se han detectado ventas anuladas (reversiones en efectivo) equivalentes a <strong className="font-mono text-red-900 bg-white/50 px-1 rounded-sm">{fmt(Math.abs(anulacionesPuras))}</strong> durante este turno de caja. Revisa los movimientos marcados en la bitácora.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                        
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
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-700 font-bold bg-white border border-gray-200 px-2 py-1 rounded-md shadow-sm select-none hover:bg-gray-50">
                                    <input 
                                       type="checkbox" 
                                       checked={filterCashOnly} 
                                       onChange={(e) => setFilterCashOnly(e.target.checked)}
                                       className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                    />
                                    <span>Solo Efectivo 💵</span>
                                </label>
                                <span className="text-xs text-gray-400">
                                    {movimientos.filter((m: any) => filterCashOnly ? !['VENTA_QR', 'VENTA_TARJETA', 'INGRESO_QR', 'INGRESO_TARJETA'].includes(m.subtipo) : true).length} registros
                                </span>
                            </div>
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
                                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fecha / Hora</th>
                                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tipo</th>
                                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Descripción</th>
                                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cajero</th>
                                            <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {movimientos
                                            .filter((m: any) => filterCashOnly ? !['VENTA_QR', 'VENTA_TARJETA', 'INGRESO_QR', 'INGRESO_TARJETA'].includes(m.subtipo) : true)
                                            .map((m) => {
                                            const isDigital = m.subtipo === 'VENTA_QR' || m.subtipo === 'VENTA_TARJETA';
                                            const amtColor = m.tipo === 'EGRESO'
                                                ? 'text-red-500'
                                                : isDigital
                                                    ? m.subtipo === 'VENTA_QR' ? 'text-sky-600' : 'text-purple-600'
                                                    : 'text-green-600';
                                            return (
                                                <tr key={m._id} className={`transition-colors ${isDigital ? 'bg-indigo-50/30 hover:bg-indigo-50/60' : 'hover:bg-gray-50'
                                                    }`}>
                                                    <td className="px-3 py-1.5 font-mono text-[10px] text-gray-400 leading-tight">
                                                        {formatDate(m.fecha, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
                        className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            key="caja-modal-content"
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 40 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className={`bg-white w-full md:rounded-3xl rounded-t-3xl p-6 md:p-8 shadow-2xl relative overflow-y-auto max-h-[92vh] md:max-h-[90vh] transition-all duration-300 ${
                                modal === 'cierre' ? 'md:max-w-5xl' : 'md:max-w-md'
                            }`}
                        >
                            <button onClick={closeModal} className="absolute top-5 right-5 text-gray-300 hover:text-gray-600 transition-colors">
                                <X size={20} />
                            </button>

                            {/* ── ABRIR CAJA ── */}
                            {modal === 'abrir' && (
                                <div className="w-full">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                                            <Unlock size={22} className="text-green-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black mb-0.5">Apertura de Caja</h2>
                                            <p className="text-sm text-gray-400">Ingresá el efectivo con el que arranca la caja.</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-end mb-4">
                                        <button 
                                            onClick={() => setAperturaDetallada(!aperturaDetallada)}
                                            className="text-[10px] font-black text-green-600 hover:text-green-700 bg-green-50 px-2.5 py-1 rounded-full transition-all"
                                        >
                                            {aperturaDetallada ? 'Ingreso Directo' : 'Desglosar Billetes'}
                                        </button>
                                    </div>

                                    <div className="bg-gray-50 border border-gray-200 rounded-3xl p-6 relative overflow-hidden mb-6">
                                        {aperturaDetallada ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Billetes */}
                                                <div>
                                                    <span className="text-[9px] font-black text-gray-400 uppercase block mb-3 pl-1">Billetes</span>
                                                    <div className="space-y-2">
                                                        {Object.entries(billetes).sort((a,b) => parseFloat(b[0]) - parseFloat(a[0])).map(([val, cant]) => (
                                                            <div key={`ab-b-${val}`} className="flex items-center gap-2 group">
                                                                <span className="text-[10px] font-bold text-gray-400 w-6">Bs.{val}</span>
                                                                <input 
                                                                    type="number" min="0" placeholder="0"
                                                                    inputMode="numeric"
                                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm text-right font-mono text-black focus:ring-1 focus:ring-green-400 outline-none"
                                                                    value={cant || ''}
                                                                    onWheel={e => (e.target as HTMLInputElement).blur()}
                                                                    onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                                                                    onChange={e => setBilletes(prev => ({...prev, [val]: parseInt(e.target.value) || 0}))}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                {/* Monedas */}
                                                <div>
                                                    <span className="text-[9px] font-black text-gray-400 uppercase block mb-3 pl-1">Monedas</span>
                                                    <div className="space-y-2">
                                                        {Object.entries(monedas).sort((a,b) => parseFloat(b[0]) - parseFloat(a[0])).map(([val, cant]) => (
                                                            <div key={`ab-m-${val}`} className="flex items-center gap-2 group">
                                                                <span className="text-[10px] font-bold text-gray-400 w-7">Bs.{val}</span>
                                                                <input 
                                                                    type="number" min="0" placeholder="0"
                                                                    inputMode="numeric"
                                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm text-right font-mono text-black focus:ring-1 focus:ring-green-400 outline-none"
                                                                    value={cant || ''}
                                                                    onWheel={e => (e.target as HTMLInputElement).blur()}
                                                                    onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                                                                    onChange={e => setMonedas(prev => ({...prev, [val]: parseInt(e.target.value) || 0}))}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="py-2 text-center text-gray-900">
                                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Monto Inicial (Bs.)</label>
                                                <div className="relative inline-block w-48">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-xl">Bs.</span>
                                                    <input 
                                                        type="number" step="0.1" autoFocus
                                                        inputMode="decimal"
                                                        className="w-full bg-white border-2 border-green-100 rounded-2xl py-6 pl-14 pr-4 font-black text-3xl font-mono text-black focus:border-green-500 outline-none transition-all placeholder-green-200"
                                                        placeholder="0.00"
                                                        value={montoInicial}
                                                        onWheel={e => (e.target as HTMLInputElement).blur()}
                                                        onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                                                        onChange={e => setMontoInicial(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center">
                                            <span className="text-xs font-black text-gray-900 uppercase">Total Inicial:</span>
                                            <span className="text-2xl font-black font-mono text-green-600">
                                                {fmt(totalAperturaFinal)}
                                            </span>
                                        </div>
                                    </div>

                                    <button onClick={handleAbrirCaja} disabled={totalAperturaFinal <= 0 || abrirMut.isPending}
                                        className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors">
                                        {abrirMut.isPending ? 'Abriendo...' : 'Confirmar Apertura'}
                                    </button>
                                </div>
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
                                            <input type="number" step="0.1"
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
                                            <input type="number" step="0.1"
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
                                <div className="w-full mx-auto">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                                            <Lock size={22} className="text-indigo-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black mb-0.5 text-gray-900 text-left">Cierre de Caja</h2>
                                            <p className="text-sm text-gray-400 text-left">Verificá los montos y realizá el arqueo físico.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                        
                                        {/* COLUMNA IZQUIERDA: RESUMEN ESPERADO */}
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-2 h-2 bg-indigo-400 rounded-full" />
                                                Flujo Físico Sugerido (Fondo Fijo)
                                            </h3>
                                            
                                            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-3">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-400 font-medium">Fondo Inicial <span className="text-[10px] bg-gray-100 px-1 rounded ml-1">(Fijo)</span></span>
                                                    <span className="font-mono font-bold text-gray-600">{fmt(resumen?.monto_inicial)}</span>
                                                </div>
                                                <div className="pt-2 border-t border-gray-50"></div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-400 font-medium">+ Ventas en Efectivo</span>
                                                    <span className="font-mono font-bold text-green-600">+{fmt(resumen?.total_efectivo_ventas)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm text-indigo-600">
                                                    <span className="font-medium">+ Ingresos Manuales</span>
                                                    <span className="font-mono font-bold">+{fmt(resumen?.total_ingresos_efectivo)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-400 font-medium">- Cambio Entregado</span>
                                                    <span className="font-mono font-bold text-amber-600">-{fmt(resumen?.total_cambio)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-400 font-medium">- Gastos Registrados</span>
                                                    <span className="font-mono font-bold text-red-500">-{fmt(resumen?.total_gastos)}</span>
                                                </div>
                                                {((resumen?.total_ajustes) || 0) !== 0 && (
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-gray-400 font-medium">Ajustes</span>
                                                        <span className="font-mono font-bold text-gray-500">{((resumen?.total_ajustes)||0) > 0 ? '+' : ''}{fmt(resumen?.total_ajustes)}</span>
                                                    </div>
                                                )}
                                                
                                                <div className="pt-4 border-t border-dashed border-gray-200 mt-2">
                                                    <div className="flex justify-between items-end mb-1">
                                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Físico Esperado Total</span>
                                                        <span className="text-2xl font-black font-mono text-gray-900 tracking-tighter">
                                                            {fmt(resumen?.saldo_calculado)}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-end mt-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-indigo-800 uppercase block">Ganancia Neta (A Depositar)</span>
                                                            <span className="text-[9px] text-indigo-500 font-medium">Lo que deberías entregar idealmente</span>
                                                        </div>
                                                        <span className="text-xl font-black font-mono text-indigo-600">
                                                            {fmt((resumen?.saldo_calculado || 0) - (resumen?.monto_inicial || 0))}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* KPI ADICIONALES (Solo lectura) */}
                                            <div className="grid grid-cols-2 gap-3 opacity-60">
                                                <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100/50">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Ventas QR</p>
                                                    <p className="text-sm font-bold font-mono text-gray-600">{fmt(resumen?.total_qr)}</p>
                                                </div>
                                                <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100/50">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Ventas Tarjeta</p>
                                                    <p className="text-sm font-bold font-mono text-gray-600">{fmt(resumen?.total_tarjeta)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* COLUMNA DERECHA: CONTEO FÍSICO */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                                                    Conteo Físico
                                                </h3>
                                                
                                                {/* Toggle Modo */}
                                                <button 
                                                    onClick={() => setConteoDetallado(!conteoDetallado)}
                                                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full transition-all"
                                                >
                                                    {conteoDetallado ? 'Ingreso Directo' : 'Desglosar Billetes'}
                                                </button>
                                            </div>

                                            <div className="bg-gray-50 border border-gray-200 rounded-3xl p-6 relative overflow-hidden">
                                                
                                                {conteoDetallado ? (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {/* Billetes */}
                                                        <div>
                                                            <span className="text-[9px] font-black text-gray-400 uppercase block mb-3 pl-1">Billetes</span>
                                                            <div className="space-y-2">
                                                                {Object.entries(billetes).sort((a,b) => parseFloat(b[0]) - parseFloat(a[0])).map(([val, cant]) => (
                                                                    <div key={`b-${val}`} className="flex items-center gap-2 group">
                                                                        <span className="text-[10px] font-bold text-gray-400 w-6">Bs.{val}</span>
                                                                        <input 
                                                                            type="number" min="0" placeholder="0"
                                                                            inputMode="numeric"
                                                                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm text-right font-mono text-black focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                                                                            value={cant || ''}
                                                                            onWheel={e => (e.target as HTMLInputElement).blur()}
                                                                            onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                                                                            onChange={e => setBilletes(prev => ({...prev, [val]: parseInt(e.target.value) || 0}))}
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        {/* Monedas */}
                                                        <div>
                                                            <span className="text-[9px] font-black text-gray-400 uppercase block mb-3 pl-1">Monedas</span>
                                                            <div className="space-y-2">
                                                                {Object.entries(monedas).sort((a,b) => parseFloat(b[0]) - parseFloat(a[0])).map(([val, cant]) => (
                                                                    <div key={`m-${val}`} className="flex items-center gap-2 group">
                                                                        <span className="text-[10px] font-bold text-gray-400 w-7">Bs.{val}</span>
                                                                        <input 
                                                                            type="number" min="0" placeholder="0"
                                                                            inputMode="numeric"
                                                                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm text-right font-mono text-black focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                                                                            value={cant || ''}
                                                                            onWheel={e => (e.target as HTMLInputElement).blur()}
                                                                            onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                                                                            onChange={e => setMonedas(prev => ({...prev, [val]: parseInt(e.target.value) || 0}))}
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="py-8 text-center">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Total Efectivo Físico</label>
                                                        <div className="relative inline-block w-48">
                                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-xl">Bs.</span>
                                                            <input 
                                                                type="number" step="0.1" autoFocus
                                                                inputMode="decimal"
                                                                className="w-full bg-white border-2 border-indigo-100 rounded-2xl py-6 pl-14 pr-4 font-black text-3xl font-mono text-black focus:border-indigo-500 outline-none transition-all placeholder-indigo-200"
                                                                placeholder="0.00"
                                                                value={montoFisicoManual}
                                                                onWheel={e => (e.target as HTMLInputElement).blur()}
                                                                onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                                                                onChange={e => setMontoFisicoManual(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center">
                                                    <span className="text-xs font-black text-gray-900 uppercase">Total en Físico:</span>
                                                    <span className="text-2xl font-black font-mono text-green-600">
                                                        {fmt(totalFisicoFinal)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* DIFERENCIA Y ANALISIS */}
                                            {totalFisicoFinal > 0 && (
                                                <div className="space-y-3">
                                                    {/* Desglose de Entrega Real */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="p-3 bg-green-50 rounded-2xl border border-green-200">
                                                            <p className="text-[10px] font-black text-green-800 uppercase leading-tight mb-2">Monto a Entregar<br/><span className="text-[9px] font-medium opacity-80">(Efectivo Ganado)</span></p>
                                                            <p className="text-xl font-black font-mono text-green-700">
                                                                {fmt(Math.max(0, totalFisicoFinal - (resumen?.monto_inicial || 0)))}
                                                            </p>
                                                        </div>
                                                        <div className="p-3 bg-yellow-50 rounded-2xl border border-yellow-200">
                                                            <p className="text-[10px] font-black text-yellow-800 uppercase leading-tight mb-2">Guardar en Caja<br/><span className="text-[9px] font-medium opacity-80">(Para el día sgt.)</span></p>
                                                            <p className="text-xl font-black font-mono text-yellow-700">
                                                                {fmt(Math.min(totalFisicoFinal, resumen?.monto_inicial || 0))}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Margen de error reportado */}
                                                    <motion.div 
                                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                                        className={`p-4 rounded-3xl border ${Math.abs(diferencia ?? 0) < 0.50 ? 'bg-green-50 border-green-200 text-green-800 shadow-sm' : (diferencia ?? 0) > 0 ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-red-50 border-red-200 text-red-800 shadow-sm'}`}
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                {Math.abs(diferencia ?? 0) < 0.50 ? <ShieldCheck size={16} className="text-green-600" /> : <AlertTriangle size={16} />}
                                                                <span className="text-[11px] font-black uppercase tracking-tight opacity-70">
                                                                    {Math.abs(diferencia ?? 0) < 0.50 ? 'Estado de Auditoría' : 'Diferencia Detectada'}
                                                                </span>
                                                            </div>
                                                            <span className={`text-lg font-black font-mono tracking-tighter ${Math.abs(diferencia ?? 0) < 0.50 ? 'text-green-700' : ''}`}>
                                                                {Math.abs(diferencia ?? 0) < 0.50 ? '✔️ CAJA CUADRADA' : (diferencia ?? 0) > 0 ? `🟢 SOBRA ${fmt(Math.abs(diferencia ?? 0))}` : `🔴 FALTA ${fmt(Math.abs(diferencia ?? 0))}`}
                                                            </span>
                                                        </div>
                                                        {Math.abs(diferencia ?? 0) >= 0.50 && (
                                                            <p className="text-[10px] opacity-70 mt-1.5 font-medium leading-relaxed">
                                                                {(diferencia ?? 0) > 0 ? 'Estás declarando que hay MÁS EFECTIVO físico de lo que el sistema contabilizó. El excedente se reportará.' : 'Estás declarando un FALTANTE DE DINERO real. Tendrás que justificarlo obligatoriamente.'}
                                                            </p>
                                                        )}
                                                    </motion.div>
                                                </div>
                                            )}

                                            {/* NOTAS Y CONFIRMACIÓN */}
                                            {(() => {
                                                const requiereJustificacion = diferencia !== null && diferencia < -0.50;
                                                const notasAceptables = notasCierre && notasCierre.trim().length >= 10;
                                                const btnDisabled = totalFisicoFinal === 0 || cerrarMut.isPending || (requiereJustificacion && !notasAceptables);

                                                return (
                                                    <div className="pt-2">
                                                        <label className={`block text-[10px] font-black uppercase mb-1.5 ${requiereJustificacion ? 'text-red-600' : 'text-gray-400'}`}>
                                                            {requiereJustificacion ? 'Justificación Obligatoria' : 'Observaciones Adicionales'}
                                                        </label>
                                                        <textarea 
                                                            className={`w-full rounded-2xl p-3 text-sm outline-none focus:ring-2 resize-none h-20 transition-all
                                                                ${requiereJustificacion 
                                                                    ? 'bg-red-50 border border-red-200 text-red-900 placeholder-red-300 focus:ring-red-400' 
                                                                    : 'bg-white border border-gray-200 text-gray-900 focus:ring-indigo-300'}`}
                                                            placeholder={requiereJustificacion ? "Explica a qué se debe el faltante de dinero..." : "Opcional: Detalles sobre el cierre..."}
                                                            value={notasCierre} onChange={e => setNotasCierre(e.target.value)}
                                                        />
                                                        
                                                        <button 
                                                            onClick={handleCierre} 
                                                            disabled={btnDisabled}
                                                            className={`w-full mt-4 py-4 rounded-2xl font-black text-sm transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2
                                                                ${requiereJustificacion && !notasAceptables 
                                                                    ? 'bg-red-100 text-red-400 cursor-not-allowed opacity-70' 
                                                                    : (requiereJustificacion && notasAceptables) 
                                                                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-200' 
                                                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'}`}
                                                        >
                                                            {cerrarMut.isPending ? <RefreshCw className="animate-spin" size={18} /> : (requiereJustificacion && !notasAceptables) ? 'BLOQUEADO: Falta Justificación' : requiereJustificacion ? 'Registrar Falta y Cerrar' : 'Confirmar Caja Cuadrada'}
                                                        </button>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
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
