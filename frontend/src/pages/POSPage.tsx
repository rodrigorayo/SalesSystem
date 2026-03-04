import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts, getInventario, getCategories, getSaleStatsToday } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { usePosStore, type MetodoPago } from '../store/usePosStore';
import { useDescuentos } from '../hooks/useDescuentos';
import { client } from '../api/client';
import {
    ShoppingCart, Search, Plus, Minus, Trash2,
    CreditCard, DollarSign, QrCode, X, CheckCircle2,
    Loader2, Tag, BarChart3, Package, ChevronUp, ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocalStorage } from 'usehooks-ts';
import { toast } from 'sonner';

const fmt = (n?: number) => (n || 0).toFixed(2);

const METODO_META: Record<MetodoPago, { icon: React.ReactNode; color: string; bg: string }> = {
    EFECTIVO: { icon: <DollarSign size={14} />, color: 'text-green-700', bg: 'bg-green-100 border-green-300' },
    QR: { icon: <QrCode size={14} />, color: 'text-blue-700', bg: 'bg-blue-100 border-blue-300' },
    TARJETA: { icon: <CreditCard size={14} />, color: 'text-purple-700', bg: 'bg-purple-100 border-purple-300' },
};

function useStockMap(sucursalId: string) {
    const { data: inv = [] } = useQuery({
        queryKey: ['inventario', sucursalId],
        queryFn: () => getInventario(sucursalId),
        staleTime: 30_000,
    });
    return useMemo(() => {
        const m: Record<string, number> = {};
        for (const i of inv) m[i.producto_id] = i.cantidad;
        return m;
    }, [inv]);
}

export default function POSPage() {
    const { user } = useAuthStore();
    const qc = useQueryClient();
    const sucursalId = user?.sucursal_id || 'CENTRAL';

    const {
        items, addItem, removeItem, updateQty,
        cliente, setCliente,
        pagos, pendingPago, setPendingPago, addPago, removePago,
        descuento, setDescuento,
        total, totalCubierto, restante, cambio, canFinalize,
        reset,
        parkedTickets, parkTicket, restoreTicket, removeParkedTicket
    } = usePosStore();

    const [search, setSearch] = useLocalStorage('pos-search', '');
    const [selectedCat, setSelectedCat] = useLocalStorage('pos-selected-cat', 'all');
    const [success, setSuccess] = useState(false);
    const [confirmSale, setConfirmSale] = useState(false);
    const [panelOpen, setPanelOpen] = useLocalStorage('pos-panel-open', true); // factura+pagos+totals visible

    const { data: products = [], isLoading: loadingP } = useQuery({ queryKey: ['products'], queryFn: getProducts });
    const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
    const { data: stats } = useQuery({ queryKey: ['pos-stats'], queryFn: () => getSaleStatsToday(), refetchInterval: 60_000 });
    const { data: descuentosDisponibles = [], isLoading: loadingD } = useDescuentos();
    const stockMap = useStockMap(sucursalId);

    // BARCODE SCANNER DETECTOR
    // Los escáneres funcionan como un teclado muy rápido que termina con "Enter".
    useEffect(() => {
        let currentString = '';
        let lastTimestamp = 0;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignorar si el usuario está tipeando en un input o textarea (ej. buscador)
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const now = Date.now();
            // Si pasan más de 50ms entre teclas, asumimos que es el humano escribiendo lento, reiniciamos.
            if (now - lastTimestamp > 50) {
                currentString = '';
            }
            lastTimestamp = now;

            if (e.key === 'Enter') {
                if (currentString.length > 2) {
                    e.preventDefault();
                    // Buscar coincidencia exacta (fuerte) por codigo de barras o codigo corto
                    const match = products.find(p => p.codigo_largo === currentString || p.codigo_corto === currentString);
                    if (match && match.is_active !== false) {
                        const stock = stockMap[match._id] ?? 0;
                        if (stock > 0) {
                            addItem(match);
                        } else {
                            // Opcionalmente se podría lanzar una alerta de sin stock.
                            console.warn('Producto sin stock escaneado:', match.descripcion);
                        }
                    }
                }
                currentString = '';
            } else if (e.key.length === 1) { // Acumular solo letras/numeros
                currentString += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [products, stockMap, addItem]);

    const filtered = useMemo(() => products.filter(p => {
        const q = search.toLowerCase();
        const matchQ = !q || p.descripcion.toLowerCase().includes(q) || (p.codigo_corto ?? '').toLowerCase().includes(q) || (p.codigo_largo ?? '').toLowerCase().includes(q);
        return matchQ && (selectedCat === 'all' || p.categoria_id === selectedCat) && p.is_active !== false;
    }), [products, search, selectedCat]);

    const saleMut = useMutation({
        mutationFn: () => client('/ventas', {
            body: {
                sucursal_id: sucursalId,
                items: items.map(i => ({ producto_id: i.product._id, cantidad: i.quantity, precio: i.precio })),
                pagos: pagos.map(p => ({ metodo: p.metodo, monto: p.monto })),
                descuento: descuento.valor ? { nombre: descuento.nombre, tipo: descuento.tipo, valor: parseFloat(descuento.valor) } : undefined,
                cliente: cliente.es_factura || cliente.nit ? cliente : undefined,
            },
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inventario', sucursalId] });
            qc.invalidateQueries({ queryKey: ['pos-stats'] });
            setSuccess(true);
            setTimeout(() => { setSuccess(false); reset(); }, 2500);
        },
    });

    const totalVal = total();
    const cubierto = totalCubierto();
    const restanteVal = restante();
    const cambioVal = cambio();
    const ticketCovered = cubierto >= totalVal && totalVal > 0;  // no more payments allowed

    const handleTryFinalize = () => {
        if (!canFinalize()) return;

        // Validaciones de Cliente
        if (cliente.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email)) {
            toast.error('El formato del correo electrónico es inválido');
            return;
        }
        
        // Letras y espacios unicamente. No numeros ni caracteres especiales.
        if (cliente.razon_social && !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(cliente.razon_social)) {
            toast.error('El nombre/razón social solo puede contener letras y espacios');
            return;
        }

        setConfirmSale(true);
    };

    return (
        <div className="flex h-full bg-gray-100 overflow-hidden">

            {/* ── Success Toast ── */}
            <AnimatePresence>
                {success && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 12 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="bg-white rounded-3xl shadow-2xl px-12 py-10 flex flex-col items-center gap-4 border border-white/80"
                        >
                            <motion.div
                                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: "spring" }}
                                className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center shadow-inner"
                            >
                                <CheckCircle2 size={44} className="text-green-500" strokeWidth={2} />
                            </motion.div>
                            <div className="text-center">
                                <p className="text-2xl font-black text-gray-900 mb-1">¡Venta Finalizada!</p>
                                <p className="text-sm text-gray-400">Ticket registrado con éxito</p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>


            {/* ════════════════ LEFT — Product Catalog ════════════════ */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                {/* Search + stats */}
                <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 shrink-0">
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar nombre, código corto o código de barras…"
                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-gray-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                            autoFocus
                        />
                    </div>
                    <div className="flex items-center gap-1.5 text-sm bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-xl shrink-0">
                        <BarChart3 size={14} />
                        <span className="font-bold">${fmt(stats?.today_sales ?? 0)}</span>
                        <span className="text-[11px] text-green-500">hoy</span>
                    </div>
                </div>

                {/* Category chips */}
                <div className="bg-white border-b border-gray-100 px-5 py-2 flex gap-2 overflow-x-auto shrink-0">
                    <button onClick={() => setSelectedCat('all')}
                        className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${selectedCat === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        Todos
                    </button>
                    {categories.map(c => (
                        <button key={c._id} onClick={() => setSelectedCat(c._id)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${selectedCat === c._id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            {c.name}
                        </button>
                    ))}
                </div>

                {/* Product grid — only this scrolls on the left */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loadingP ? (
                        <div className="flex justify-center items-center h-full"><Loader2 size={28} className="animate-spin text-indigo-400" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <Tag size={40} className="mb-2 text-gray-200" />
                            <p className="text-sm text-gray-400">Sin resultados</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {filtered.map(p => {
                                const stock = stockMap[p._id] ?? 0;
                                const inCart = items.find(i => i.product._id === p._id)?.quantity ?? 0;
                                const noStock = stock <= 0;
                                return (
                                    <button key={p._id} onClick={() => !noStock && addItem(p)} disabled={noStock}
                                        className={`group relative bg-white rounded-2xl border p-3 text-left shadow-sm flex flex-col transition-all duration-200
                                            ${noStock ? 'opacity-40 cursor-not-allowed border-gray-100' : 'hover:shadow-md hover:-translate-y-0.5 hover:border-indigo-300 border-gray-200 cursor-pointer active:scale-[0.97]'}`}>
                                        <div className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full self-start mb-1.5 truncate max-w-full">
                                            {p.categoria_nombre ?? '–'}
                                        </div>
                                        <div className="w-full aspect-square bg-gray-50 rounded-xl mb-2 overflow-hidden">
                                            {p.image_url
                                                ? <img src={p.image_url} alt={p.descripcion} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                : <div className="w-full h-full flex items-center justify-center"><Package size={24} className="text-gray-200" /></div>}
                                        </div>
                                        <p className="text-xs text-gray-900 font-semibold line-clamp-2 leading-tight mb-0.5">{p.descripcion}</p>
                                        {p.codigo_corto && <p className="text-[10px] text-gray-400 font-mono mb-1">{p.codigo_corto}</p>}
                                        <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-gray-100">
                                            <span className="text-sm font-black text-gray-900">${fmt(p.precio_venta)}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stock > 10 ? 'bg-green-100 text-green-700' : stock > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-500'}`}>
                                                {noStock ? 'Agotado' : `${stock}u`}
                                            </span>
                                        </div>
                                        {inCart > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow">
                                                {inCart}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ════════════════ RIGHT — Ticket Panel ════════════════ */}
            {/*
              LAYOUT KEY:
              • The outer div is flex-col + h-full + overflow-hidden
              • Only the ITEMS section has flex-1 + overflow-y-auto → it scrolls
              • Every other section (factura, pagos, totals, button) uses shrink-0 → never scrolls away
            */}
            <div className="w-[380px] bg-white border-l border-gray-200 flex flex-col overflow-hidden shadow-xl">

                {/* ── Header ── (shrink-0) */}
                <div className="shrink-0 px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                    <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                        <ShoppingCart size={13} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-gray-900 text-xs leading-none">Ticket de Venta</h2>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">Cajero: {user?.username}</p>
                    </div>
                    {items.length > 0 && (
                        <>
                            <button onClick={() => parkTicket()} className="shrink-0 text-gray-500 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors text-[10px] font-bold border border-gray-200 hover:border-indigo-200 bg-white" title="Parquear ticket en espera">
                                Parquear
                            </button>
                            <button onClick={() => { reset(); }} className="shrink-0 text-gray-300 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors" title="Vaciar ticket">
                                <X size={13} />
                            </button>
                        </>
                    )}
                </div>

                {/* ── Parked Tickets Row ── */}
                {parkedTickets.length > 0 && (
                    <div className="shrink-0 px-2 py-1.5 bg-indigo-50/50 border-b border-indigo-100 flex gap-1 overflow-x-auto no-scrollbar">
                        {parkedTickets.map((pt, idx) => (
                            <div key={pt.id} className="shrink-0 bg-white border border-indigo-100 rounded shadow-sm px-2 py-1 flex items-center gap-2">
                                <button onClick={() => restoreTicket(idx)} className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 text-left">
                                    Ticket #{pt.id}
                                    <span className="block text-[9px] font-normal text-gray-500">{pt.items.length} items</span>
                                </button>
                                <button onClick={() => removeParkedTicket(idx)} className="text-gray-300 hover:text-red-500 p-0.5 rounded hover:bg-red-50">
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Items list ── (flex-1 + overflow-y-auto → ONLY THIS SCROLLS) */}
                <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
                    {items.length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full py-4 text-gray-300">
                            <ShoppingCart size={32} className="mb-2 opacity-20" />
                            <p className="text-xs text-gray-400 text-center">Ticket vacío — tocá un producto</p>
                        </motion.div>
                    ) : (
                        <div className="space-y-1.5 scroll-smooth">
                            <AnimatePresence initial={false}>
                                {items.map(item => (
                                    <motion.div
                                        key={item.product._id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, height: 0, marginTop: 0, marginBottom: 0, overflow: 'hidden' }}
                                        transition={{ duration: 0.2 }}
                                        className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-900 truncate">{item.product.descripcion}</p>
                                            <p className="text-[11px] text-gray-400">
                                                ${fmt(item.precio)} × {item.quantity} =&nbsp;
                                                <span className="font-bold text-gray-700">${fmt(item.precio * item.quantity)}</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button onClick={() => updateQty(item.product._id, -1)} className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
                                                <Minus size={11} />
                                            </button>
                                            <span className="w-5 text-center text-xs font-bold text-gray-900">{item.quantity}</span>
                                            <button onClick={() => updateQty(item.product._id, 1)} className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
                                                <Plus size={11} />
                                            </button>
                                            <button onClick={() => removeItem(item.product._id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-0.5">
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {/* ── Options / Payment Toggle Header ── */}
                <div
                    className="shrink-0 px-3 py-2 border-t border-gray-100 flex justify-between items-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => setPanelOpen(!panelOpen)}
                >
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Opciones y Pagos</span>
                    <button className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 transition-colors">
                        {panelOpen ? 'Ocultar' : 'Mostrar'} {panelOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                </div>

                {/* ── Factura / Cliente ── (colapsable) */}
                <AnimatePresence initial={false}>
                    {panelOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="shrink-0 border-t border-gray-100 overflow-hidden"
                        >
                            {/* Cliente/Factura */}
                            <div className="px-3 py-1.5">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" checked={cliente.es_factura}
                                        onChange={e => setCliente({ es_factura: e.target.checked })}
                                        className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 shrink-0" />
                                    <span className="text-[11px] text-gray-600 font-medium">Solicitar factura (NIT)</span>
                                </label>
                                <AnimatePresence>
                                    {cliente.es_factura && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="grid grid-cols-2 gap-1 mt-1.5 overflow-hidden"
                                        >
                                            <input value={cliente.nit} onChange={e => setCliente({ nit: e.target.value })}
                                                className="col-span-1 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 focus:ring-1 focus:ring-indigo-400 outline-none bg-gray-50 flex-1"
                                                placeholder="NIT" />
                                            <input value={cliente.email} onChange={e => setCliente({ email: e.target.value })}
                                                className="col-span-1 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 focus:ring-1 focus:ring-indigo-400 outline-none bg-gray-50 flex-1"
                                                placeholder="Email" />
                                            <input value={cliente.razon_social} onChange={e => setCliente({ razon_social: e.target.value })}
                                                className="col-span-1 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 focus:ring-1 focus:ring-indigo-400 outline-none bg-gray-50 flex-1"
                                                placeholder="Razón Social" />
                                            <input value={cliente.celular} onChange={e => setCliente({ celular: e.target.value })}
                                                className="col-span-1 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 focus:ring-1 focus:ring-indigo-400 outline-none bg-gray-50 flex-1"
                                                placeholder="Celular" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Descuentos Predefinidos */}
                            <div className="px-3 pb-2 pt-1 border-t border-gray-100 mt-1">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Descuentos Activos</span>
                                {loadingD ? (
                                    <div className="h-6 flex items-center"><Loader2 size={14} className="animate-spin text-gray-400" /></div>
                                ) : descuentosDisponibles.filter(d => d.is_active).length === 0 ? (
                                    <p className="text-[10px] text-gray-400 italic">No hay descuentos predefinidos habilitados.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        <button
                                            onClick={() => setDescuento('MONTO', '', '')}
                                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${!descuento.valor ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                        >
                                            Ninguno
                                        </button>
                                        {descuentosDisponibles.filter(d => d.is_active).map(d => {
                                            const isActive = descuento.nombre === d.nombre && descuento.valor === d.valor.toString();
                                            return (
                                                <button
                                                    key={d._id}
                                                    onClick={() => setDescuento(d.tipo, d.valor.toString(), d.nombre)}
                                                    disabled={ticketCovered}
                                                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 border ${isActive ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                                                    title={`${d.tipo === 'PORCENTAJE' ? d.valor + '%' : 'Bs. ' + d.valor}`}
                                                >
                                                    <Tag size={10} className={isActive ? 'text-indigo-500' : 'text-gray-400'} />
                                                    {d.nombre} ({d.tipo === 'PORCENTAJE' ? `${d.valor}%` : `Bs.${d.valor}`})
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Métodos de pago ── (colapsable) */}
                <AnimatePresence initial={false}>
                    {panelOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="shrink-0 border-t border-gray-100 overflow-hidden"
                        >
                            <div className="px-3 py-2">
                                {/* Method toggles */}
                                <div className="flex gap-1 mb-1.5">
                                    {(['EFECTIVO', 'QR', 'TARJETA'] as MetodoPago[]).map(m => {
                                        const meta = METODO_META[m];
                                        const active = pendingPago.metodo === m;
                                        return (
                                            <button key={m} onClick={() => setPendingPago({ metodo: m })} disabled={ticketCovered}
                                                className={`flex-1 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed relative
                                            ${active ? `${meta.bg} ${meta.color} border-current` : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                                                {active && <motion.div layoutId="pos-pago-tab" className="absolute inset-0 border-2 border-current rounded-lg" />}
                                                <span className="relative z-10 flex items-center gap-1">{meta.icon} {m}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Amount + Add */}
                                <div className="flex gap-1.5 mb-1.5">
                                    <div className="relative flex-1">
                                        <DollarSign size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input type="number" step="0.10" min="0.10"
                                            value={pendingPago.monto}
                                            onChange={e => setPendingPago({ monto: e.target.value })}
                                            onKeyDown={e => e.key === 'Enter' && addPago()}
                                            disabled={ticketCovered}
                                            className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 font-mono focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none disabled:opacity-40 disabled:bg-gray-50 transition-colors"
                                            placeholder="0.00" />
                                    </div>
                                    <button onClick={addPago}
                                        disabled={!pendingPago.monto || parseFloat(pendingPago.monto) <= 0 || ticketCovered || !items.length}
                                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shrink-0">
                                        <Plus size={12} /> Agregar
                                    </button>
                                </div>

                                {/* Registered payments */}
                                {pagos.length > 0 && (
                                    <div className="space-y-1">
                                        <AnimatePresence>
                                            {pagos.map((p, i) => {
                                                const meta = METODO_META[p.metodo as MetodoPago];
                                                return (
                                                    <motion.div
                                                        layout
                                                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95, height: 0, margin: 0, overflow: 'hidden' }}
                                                        key={i}
                                                        className={`flex items-center justify-between rounded-lg border px-2 py-1 ${meta.bg}`}
                                                    >
                                                        <div className={`flex items-center gap-1 text-[11px] font-bold ${meta.color}`}>
                                                            {meta.icon} {p.metodo}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-mono text-xs font-bold ${meta.color}`}>Bs. {fmt(p.monto)}</span>
                                                            <button onClick={() => removePago(i)} title="Quitar pago"
                                                                className="w-4 h-4 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-500 text-red-500 hover:text-white transition-all">
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Blocked message */}
                                <AnimatePresence>
                                    {ticketCovered && items.length > 0 && (
                                        <motion.p
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="text-[11px] text-center text-green-700 bg-green-50 border border-green-200 rounded-lg py-1 mt-1.5"
                                        >
                                            ✓ Ticket cubierto — no se aceptan más pagos
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Totals + Finalize ── (siempre visible) */}
                <div className="shrink-0 bg-white shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.1)] z-10">
                    <div className="px-3 pb-2 pt-3 space-y-1.5 border-t border-gray-100">

                        {/* Full totals breakdown — shown only when panel is open */}
                        {panelOpen && (
                            <>
                                {parseFloat(descuento.valor) > 0 && (
                                    <>
                                        <div className="flex justify-between items-center text-[11px] opacity-60">
                                            <span className="font-semibold">Subtotal</span>
                                            <span className="font-mono">Bs. {fmt(items.reduce((acc, i) => acc + i.precio * i.quantity, 0))}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] text-red-500 font-medium pb-1 border-b border-gray-100">
                                            <span>Descuento {descuento.tipo === 'PORCENTAJE' ? `(${descuento.valor}%)` : ''}</span>
                                            <span className="font-mono">- Bs. {fmt(items.reduce((acc, i) => acc + i.precio * i.quantity, 0) - totalVal)}</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between items-center relative">
                                    <span className="text-xs font-semibold text-gray-500">Total a Pagar</span>
                                    <span className="text-base font-black text-gray-900 font-mono">Bs. {fmt(totalVal)}</span>
                                </div>
                                {cubierto > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Cubierto</span>
                                        <span className="font-bold text-green-600 font-mono">Bs. {fmt(cubierto)}</span>
                                    </div>
                                )}
                                {cubierto > 0 && restanteVal > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-red-500 font-semibold">Falta pagar</span>
                                        <span className="font-bold text-red-600 font-mono">Bs. {fmt(restanteVal)}</span>
                                    </div>
                                )}
                                {cambioVal > 0 && (
                                    <div className="flex justify-between items-center bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                                        <span className="text-amber-700 font-bold text-xs">💰 Cambio</span>
                                        <span className="font-black text-amber-700 font-mono text-sm">Bs. {fmt(cambioVal)}</span>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Collapsed mini-summary */}
                        {!panelOpen && (
                            <div className="flex justify-between items-center h-[34px]">
                                <span className="text-xs font-semibold text-gray-500">Total</span>
                                <div className="flex items-center gap-3">
                                    {cambioVal > 0 && <span className="text-xs font-bold text-amber-600">💰 Bs. {fmt(cambioVal)}</span>}
                                    {restanteVal > 0 && cubierto > 0 && <span className="text-xs font-bold text-red-500">Falta Bs. {fmt(restanteVal)}</span>}
                                    <span className="text-[10px] font-semibold text-gray-400 hidden">TOTAL</span>
                                    <span className="text-base font-black text-gray-900 font-mono leading-none">Bs. {fmt(totalVal)}</span>
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {saleMut.isError && (
                            <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1 text-center">
                                {(saleMut.error as any)?.message ?? 'Error al registrar la venta'}
                            </p>
                        )}

                        {/* Hint */}
                        {panelOpen && items.length > 0 && pagos.length === 0 && (
                            <p className="text-[11px] text-center text-amber-600 bg-amber-50 border border-amber-100 rounded-lg py-1">
                                Ingresá el monto y presioná <strong>Agregar</strong>
                            </p>
                        )}

                        {/* Success */}
                        {success && (
                            <div className="flex items-center gap-2 justify-center text-green-700 bg-green-100 border border-green-200 rounded-lg py-1.5">
                                <CheckCircle2 size={15} />
                                <span className="font-bold text-sm">¡Venta registrada!</span>
                            </div>
                        )}

                        {/* Finalize */}
                        <button onClick={handleTryFinalize}
                            disabled={!canFinalize() || saleMut.isPending || success}
                            className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                            ${canFinalize() && !success
                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 active:scale-[0.97]'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                            {saleMut.isPending
                                ? <Loader2 size={18} className="animate-spin" />
                                : <><CheckCircle2 size={18} /> Finalizar Venta</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Confirmación de Venta */}
            <AnimatePresence>
                {confirmSale && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-5">
                            <h3 className="text-lg font-black text-gray-900 mb-2">Confirmar Venta</h3>
                            <p className="text-sm text-gray-500 mb-4">Revisa los montos antes de finalizar.</p>

                            <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-5 border border-gray-100">
                                {parseFloat(descuento.valor) > 0 && (
                                    <>
                                        <div className="flex justify-between items-center text-gray-500 opacity-80">
                                            <span className="font-medium text-sm">Subtotal:</span>
                                            <span className="text-base font-bold font-mono">Bs. {fmt(items.reduce((acc, i) => acc + i.precio * i.quantity, 0))}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-red-500 font-medium pb-2 border-b border-gray-200">
                                            <span className="text-sm">Descuento {descuento.tipo === 'PORCENTAJE' ? `(${descuento.valor}%)` : ''}:</span>
                                            <span className="text-base font-bold font-mono">- Bs. {fmt(items.reduce((acc, i) => acc + i.precio * i.quantity, 0) - totalVal)}</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium text-sm">Total a cobrar:</span>
                                    <span className="text-lg font-black font-mono text-gray-900">Bs. {fmt(totalVal)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium text-sm">Efectivo recibido:</span>
                                    <span className="text-lg font-black font-mono text-green-600">Bs. {fmt(cubierto)}</span>
                                </div>
                                {cambioVal > 0 && (
                                    <div className="flex justify-between items-center pt-3 mt-1 border-t border-gray-200">
                                        <span className="text-gray-900 font-bold text-sm">Cambio a dar:</span>
                                        <span className="text-xl font-black font-mono text-amber-600">Bs. {fmt(cambioVal)}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 w-full">
                                <button onClick={() => setConfirmSale(false)} className="flex-1 py-2 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancelar</button>
                                <button onClick={() => { setConfirmSale(false); saleMut.mutate(); }} disabled={saleMut.isPending} className="flex-1 py-2 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2">
                                    {saleMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Confirmar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
