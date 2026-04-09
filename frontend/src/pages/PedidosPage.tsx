import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPedidos, createPedido, despacharPedido, recibirPedido, cancelarPedido, aceptarPedido, getSucursales, getInventario, getProducts, downloadPedidoPDF } from '../api/api';
import { useAuthStore } from '../store/authStore';

import {
    ClipboardList, Plus, Truck, CheckCircle2, Clock,
    X, Check, Loader2, ChevronDown, ChevronRight, Package,
    CheckSquare, Ban, AlertTriangle, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type TabType = 'todos' | 'CREADO' | 'ACEPTADO' | 'DESPACHADO' | 'RECIBIDO' | 'CANCELADO';

const formatDate = (dateStr: string) => {
    const isoStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    return new Date(isoStr).toLocaleDateString();
};

const ESTADO = {
    CREADO: { label: 'Pendiente', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-300', icon: Clock },
    ACEPTADO: { label: 'Aceptado', color: 'text-indigo-800', bg: 'bg-indigo-50', border: 'border-indigo-300', icon: CheckSquare },
    DESPACHADO: { label: 'En camino', color: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-300', icon: Truck },
    RECIBIDO: { label: 'Recibido', color: 'text-green-800', bg: 'bg-green-50', border: 'border-green-300', icon: CheckCircle2 },
    CANCELADO: { label: 'Cancelado', color: 'text-red-800', bg: 'bg-red-50', border: 'border-red-300', icon: Ban },
} as const;

export default function PedidosPage() {
    const qc = useQueryClient();
    const { isMatriz, isSucursal, isCajero, user } = useAuthStore();
    const [tab, setTab] = useState<TabType>('todos');
    const [showCreate, setShowCreate] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        action: () => void;
        type: 'danger' | 'info' | 'success';
    }>({ isOpen: false, title: '', message: '', action: () => {}, type: 'info' });
    const [receptionModal, setReceptionModal] = useState<{ isOpen: boolean; pedido: any }>({ isOpen: false, pedido: null });

    const [selectedSucursal, setSelectedSucursal] = useState('');
    const [supervisorAction, setSupervisorAction] = useState<'PEDIR' | 'TRANSFERIR' | 'DEVOLVER'>('PEDIR');
    const [orderItems, setOrderItems] = useState<{ producto_id: string; cantidad: number }[]>([]);
    const [notas, setNotas] = useState('');
    const [searchProd, setSearchProd] = useState('');

    const { data: pedidos = [], isLoading } = useQuery({
        queryKey: ['pedidos', tab],
        queryFn: () => getPedidos(undefined, tab === 'todos' ? undefined : tab),
    });
    const { data: sucursales = [] } = useQuery({ queryKey: ['sucursales'], queryFn: getSucursales });
    
    // Determine the true source of merchandise based on user role and action
    const origenId = useMemo(() => {
        if (isMatriz() || user?.role === 'SUPERADMIN') return "CENTRAL";
        if (user?.role === 'SUPERVISOR') {
            if (supervisorAction === 'PEDIR') return selectedSucursal;
            if (supervisorAction === 'TRANSFERIR') return user.sucursal_id;
            if (supervisorAction === 'DEVOLVER') return selectedSucursal;
        }
        if (isSucursal()) {
            if (supervisorAction === 'PEDIR') return "CENTRAL";
            if (supervisorAction === 'TRANSFERIR') return user?.sucursal_id;
            if (supervisorAction === 'DEVOLVER') return selectedSucursal;
        }
        return "CENTRAL";
    }, [user, supervisorAction, selectedSucursal, isMatriz, isSucursal]);

    const { data: invData } = useQuery({
        queryKey: ['inventario-for-order', origenId],
        queryFn: () => getInventario(origenId, 1, 1000),
        enabled: showCreate && !!origenId && origenId !== 'CENTRAL'
    });
    
    // Matriz does not have strict stock limits; they can craft from factory.
    // Fetch the global catalog unrestricted for CENTRAL orders.
    const { data: productsData } = useQuery({ 
        queryKey: ['products'], 
        queryFn: () => getProducts(1, 1000),
        enabled: showCreate && origenId === 'CENTRAL' 
    });

    const availableProducts = useMemo(() => {
        let list = [];
        if (origenId === 'CENTRAL') {
            list = (productsData?.items || []).map((p: any) => ({
                producto_id: p._id || p.id,
                producto_nombre: p.descripcion || p.name,
                cantidad: '∞',
                precio: p.costo_producto ?? p.costo_unitario ?? 0
            }));
        } else {
            list = (invData?.items || [])
                .filter((inv: any) => inv.cantidad > 0)
                .map((inv: any) => ({
                    producto_id: inv.producto_id,
                    producto_nombre: inv.producto_nombre || inv.descripcion || 'Producto',
                    cantidad: inv.cantidad,
                    precio: inv.precio_sucursal ?? inv.precio_venta ?? 0
                }));
        }
        return list.sort((a: any, b: any) => a.producto_nombre.localeCompare(b.producto_nombre));
    }, [origenId, invData, productsData]);

    const createMut = useMutation({
        mutationFn: createPedido,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['pedidos'] }); setShowCreate(false); resetForm(); },
        onError: (err: any) => alert(err?.response?.data?.detail || err.message || 'Error al crear pedido')
    });
    const despacharMut = useMutation({
        mutationFn: despacharPedido,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos'] }),
        onError: (err: any) => alert(err?.response?.data?.detail || err.message || 'Error al despachar pedido')
    });

    const cancelarMut = useMutation({
        mutationFn: cancelarPedido,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos'] }),
        onError: (err: any) => alert(err?.response?.data?.detail || err.message || 'Error al cancelar pedido')
    });
    const aceptarMut = useMutation({
        mutationFn: aceptarPedido,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos'] }),
        onError: (err: any) => alert(err?.response?.data?.detail || err.message || 'Error al aceptar pedido')
    });

    const filteredCatalog = useMemo(() => {
        if (!searchProd) return availableProducts;
        const low = searchProd.toLowerCase();
        return availableProducts.filter((p: any) => p.producto_nombre.toLowerCase().includes(low));
    }, [availableProducts, searchProd]);

    const resetForm = () => { setSelectedSucursal(''); setOrderItems([]); setNotas(''); setSearchProd(''); };
    const addItem = () => setOrderItems(p => [...p, { producto_id: '', cantidad: 1 }]);
    const updateItem = (i: number, f: 'producto_id' | 'cantidad', v: string | number) =>
        setOrderItems(p => p.map((item, idx) => idx === i ? { ...item, [f]: v } : item));
    const removeItem = (i: number) => setOrderItems(p => p.filter((_, idx) => idx !== i));

    return (
        <div className="max-w-7xl mx-auto px-3 py-4 md:p-4 space-y-4 pb-20 md:pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Pedidos Internos</h1>
                    <p className="text-gray-500 text-xs mt-1">Gestión de transferencias de inventario</p>
                </div>
                {!isCajero() && (
                    <button onClick={() => setShowCreate(true)}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium text-xs shadow-sm transition-colors">
                        <Plus size={14} /> Nuevo Pedido
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 flex-wrap w-fit">
                {(['todos', 'CREADO', 'ACEPTADO', 'DESPACHADO', 'RECIBIDO', 'CANCELADO'] as TabType[]).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                        {t === 'todos' ? 'Todos' : ESTADO[t].label}
                    </button>
                ))}
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-indigo-500" /></div>
            ) : pedidos.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <ClipboardList size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-gray-500">No hay pedidos en este estado.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {pedidos.map(pedido => {
                        const cfg = ESTADO[pedido.estado];
                        const Icon = cfg.icon;
                        const isOpen = expanded === pedido._id;
                        const getNombre = (id: string) => id === 'CENTRAL' ? 'Matriz Principal' : sucursales.find(s => s._id === id)?.nombre || id;
                        const origenNombre = getNombre(pedido.sucursal_origen_id || 'CENTRAL');
                        const destinoNombre = getNombre(pedido.sucursal_destino_id || pedido.sucursal_id);

                        return (
                            <div key={pedido._id} className={`${cfg.bg} border-2 ${cfg.border} rounded-2xl overflow-hidden hover:shadow-md transition-shadow ${isOpen ? 'shadow-md' : 'shadow-sm'}`}>
                                <button onClick={() => setExpanded(isOpen ? null : pedido._id)}
                                    className="w-full flex items-center justify-between p-4 text-left">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}>
                                            <Icon size={16} className={cfg.color} />
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                                <span className="font-semibold text-sm text-gray-900 line-clamp-1 flex items-center gap-1.5">
                                                    {origenNombre} <ChevronRight size={14} className="text-gray-400" /> {destinoNombre}
                                                </span>
                                                {pedido.tipo_pedido === 'MATRIZ_A_SUCURSAL' ? (
                                                    <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-purple-200">Reabastecimiento</span>
                                                ) : (
                                                    <span className="text-[9px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-sky-200">Traslado Operativo</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {formatDate(pedido.created_at)} · {pedido.items.length} producto(s)
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400">Total</div>
                                            <div className="font-bold text-gray-900">Bs. {(pedido.total_mayorista || 0).toFixed(2)}</div>
                                        </div>
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                                            {cfg.label}
                                        </span>
                                        {isOpen ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                                    </div>
                                </button>

                                {isOpen && (
                                    <div className="px-4 pb-4 border-t border-gray-100">
                                        <div className="bg-white/60 p-3 rounded-xl mt-3">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-gray-500 text-[10px] uppercase tracking-wider">
                                                        <th className="text-left pb-1.5 font-semibold">Producto</th>
                                                        <th className="text-center pb-1.5 font-semibold">Cantidad</th>
                                                        <th className="text-right pb-1.5 font-semibold">P. Mayorista</th>
                                                        <th className="text-right pb-1.5 font-semibold">Subtotal</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {pedido.items.map((item, i) => (
                                                        <tr key={i} className="text-gray-800">
                                                            <td className="py-1.5">{item.descripcion || item.producto_nombre || 'Producto Desconocido'}</td>
                                                            <td className="py-1.5 text-center">{item.cantidad}</td>
                                                            <td className="py-1.5 text-right">Bs. {(item.precio_mayorista || 0).toFixed(2)}</td>
                                                            <td className="py-1.5 text-right font-medium">Bs. {(item.cantidad * (item.precio_mayorista || 0)).toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {pedido.notas && (
                                            <p className="text-sm text-gray-700 mt-3 italic font-medium bg-white/50 p-2 rounded-lg">Notas: {pedido.notas}</p>
                                        )}

                                        <div className="flex justify-end gap-2 mt-3">
                                            {pedido.estado === 'CREADO' && (
                                                <button onClick={() => setConfirmModal({
                                                    isOpen: true, title: 'Cancelar Pedido',
                                                    message: '¿Estás seguro de cancelar este pedido? Esta acción no se puede deshacer.',
                                                    type: 'danger', action: () => cancelarMut.mutate(pedido._id)
                                                })} disabled={cancelarMut.isPending}
                                                    className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm mr-auto">
                                                    {cancelarMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                                                    Cancelar
                                                </button>
                                            )}
                                            {pedido.estado === 'CREADO' && (isMatriz() || user?.role === 'SUPERADMIN' || user?.sucursal_id === pedido.sucursal_origen_id) && (
                                                <button onClick={() => setConfirmModal({
                                                    isOpen: true, title: 'Aceptar Pedido',
                                                    message: '¿Estás seguro de ACEPTAR este pedido y comenzar a prepararlo?',
                                                    type: 'info', action: () => aceptarMut.mutate(pedido._id)
                                                })} disabled={aceptarMut.isPending}
                                                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                                                    {aceptarMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />}
                                                    Aceptar Pedido
                                                </button>
                                            )}
                                            {pedido.estado === 'ACEPTADO' && (isMatriz() || user?.role === 'SUPERADMIN' || user?.sucursal_id === pedido.sucursal_origen_id) && (
                                                <button onClick={() => setConfirmModal({
                                                    isOpen: true, title: 'Despachar Pedido',
                                                    message: '¿Confirmas que ya enviaste los productos y están EN CAMINO a su destino?',
                                                    type: 'info', action: () => despacharMut.mutate(pedido._id)
                                                })} disabled={despacharMut.isPending}
                                                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                                                    {despacharMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                                                    Despachar
                                                </button>
                                            )}
                                            {pedido.estado === 'DESPACHADO' && (user?.sucursal_id === pedido.sucursal_destino_id || user?.role === 'SUPERADMIN') && (
                                                <button onClick={() => setReceptionModal({ isOpen: true, pedido })}
                                                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                                                    <CheckCircle2 size={14} />
                                                    Confirmar Recepción
                                                </button>
                                            )}
                                            {pedido.estado === 'RECIBIDO' && (
                                                <button onClick={async () => {
                                                    try {
                                                        await downloadPedidoPDF(pedido._id);
                                                    } catch (err: any) { alert(err.message); }
                                                }}
                                                    className="flex items-center gap-1.5 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ml-auto shadow-sm">
                                                    <Download size={14} />
                                                    Descargar Comprobante PDF
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Pedido Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold text-gray-900">Nuevo Pedido Interno</h2>
                            <button onClick={() => { setShowCreate(false); resetForm(); }} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
                        </div>
                        <form onSubmit={e => {
                            e.preventDefault();
                            const validItems = orderItems.filter(i => i.producto_id.trim() !== '');
                            if (!selectedSucursal && (isMatriz() || user?.role === 'SUPERADMIN' || user?.role === 'SUPERVISOR')) {
                                alert("Por favor, selecciona una sucursal.");
                                return;
                            }
                            if (validItems.length === 0) {
                                alert("Por favor, selecciona al menos un producto válido para el pedido.");
                                return;
                            }
                            
                            let payload: any = { items: validItems, notas: notas || undefined };
                            
                            if (isMatriz() || user?.role === 'SUPERADMIN') {
                                payload.sucursal_destino_id = selectedSucursal;
                                payload.sucursal_id = selectedSucursal;
                                payload.sucursal_origen_id = "CENTRAL";
                            } else if (user?.role === 'SUPERVISOR') {
                                if (supervisorAction === 'PEDIR') {
                                    payload.sucursal_destino_id = user.sucursal_id;
                                    payload.sucursal_id = user.sucursal_id;
                                    payload.sucursal_origen_id = selectedSucursal; // A physical branch
                                } else if (supervisorAction === 'TRANSFERIR') {
                                    payload.sucursal_destino_id = selectedSucursal; // A vendedor branch
                                    payload.sucursal_id = selectedSucursal;
                                    payload.sucursal_origen_id = user.sucursal_id;
                                    payload.transferencia_directa = true;
                                } else if (supervisorAction === 'DEVOLVER') {
                                    payload.sucursal_destino_id = user.sucursal_id; 
                                    payload.sucursal_id = user.sucursal_id;
                                    payload.sucursal_origen_id = selectedSucursal; // A vendedor branch
                                    payload.transferencia_directa = true;
                                }
                            } else if (isSucursal()) {
                                if (supervisorAction === 'PEDIR') {
                                    payload.sucursal_destino_id = user?.sucursal_id;
                                    payload.sucursal_id = user?.sucursal_id;
                                    payload.sucursal_origen_id = "CENTRAL";
                                } else if (supervisorAction === 'TRANSFERIR') {
                                    payload.sucursal_destino_id = selectedSucursal; // A supervisor
                                    payload.sucursal_id = selectedSucursal;
                                    payload.sucursal_origen_id = user?.sucursal_id;
                                    payload.transferencia_directa = true;
                                } else if (supervisorAction === 'DEVOLVER') {
                                    payload.sucursal_destino_id = user?.sucursal_id;
                                    payload.sucursal_id = user?.sucursal_id;
                                    payload.sucursal_origen_id = selectedSucursal; // A supervisor
                                    payload.transferencia_directa = true;
                                }
                            } else {
                                payload.sucursal_destino_id = user?.sucursal_id;
                                payload.sucursal_id = user?.sucursal_id;
                                payload.sucursal_origen_id = "CENTRAL";
                            }
                            
                            createMut.mutate(payload);
                        }} className="space-y-4">
                            {(user?.role === 'SUPERVISOR' || isSucursal()) && (
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de Movimiento</label>
                                    <select value={supervisorAction} onChange={e => setSupervisorAction(e.target.value as any)}
                                        className="w-full border border-indigo-200 bg-indigo-50 rounded-xl px-3 py-2 text-xs font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none">
                                        <option value="PEDIR">
                                            {isSucursal() ? 'Solicitar Mercadería (A Matriz)' : 'Extraer Mercadería (Desde Sucursal Física)'}
                                        </option>
                                        <option value="TRANSFERIR">
                                            {isSucursal() ? 'Entregar Mercadería (A un Supervisor)' : 'Entregar Mercadería (A un Vendedor)'}
                                        </option>
                                        <option value="DEVOLVER">
                                            {isSucursal() ? 'Recuperar Inventario (De un Supervisor)' : 'Recuperar Inventario (De un Vendedor)'}
                                        </option>
                                    </select>
                                </div>
                            )}

                            <div className="flex bg-gray-50 p-3 rounded-xl border border-gray-100 gap-3">
                                {/* ORIGEN */}
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                        <Truck size={12} /> Origen
                                    </label>
                                    {isMatriz() || user?.role === 'SUPERADMIN' ? (
                                        <div className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 font-semibold cursor-not-allowed">
                                            Matriz Principal
                                        </div>
                                    ) : user?.role === 'SUPERVISOR' ? (
                                        supervisorAction === 'PEDIR' ? (
                                            <select required value={selectedSucursal} onChange={e => setSelectedSucursal(e.target.value)}
                                                className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none">
                                                <option value="">Seleccionar Sucursal Física...</option>
                                                {sucursales.filter(s => s.tipo === 'FISICA' || !s.tipo).map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                                            </select>
                                        ) : supervisorAction === 'DEVOLVER' ? (
                                            <select required value={selectedSucursal} onChange={e => setSelectedSucursal(e.target.value)}
                                                className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none">
                                                <option value="">Seleccionar Vendedor...</option>
                                                {sucursales.filter(s => s.tipo === 'VENDEDOR').map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                                            </select>
                                        ) : (
                                            <div className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 font-semibold cursor-not-allowed line-clamp-1">
                                                {sucursales.find(s => s._id === user?.sucursal_id)?.nombre || 'Mi Inventario Móvil'}
                                            </div>
                                        )
                                    ) : (
                                        supervisorAction === 'PEDIR' ? (
                                            <div className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 font-semibold cursor-not-allowed">
                                                Matriz Principal
                                            </div>
                                        ) : supervisorAction === 'DEVOLVER' ? (
                                            <select required value={selectedSucursal} onChange={e => setSelectedSucursal(e.target.value)}
                                                className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none">
                                                <option value="">Seleccionar Supervisor Móvil...</option>
                                                {sucursales.filter(s => s.tipo === 'SUPERVISOR').map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                                            </select>
                                        ) : (
                                            <div className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 font-semibold cursor-not-allowed line-clamp-1">
                                                {sucursales.find(s => s._id === user?.sucursal_id)?.nombre || 'Mi Sucursal'}
                                            </div>
                                        )
                                    )}
                                </div>

                                {/* ICON */}
                                <div className="flex items-center justify-center pt-5">
                                    <ChevronRight size={18} className="text-gray-400" />
                                </div>

                                {/* DESTINO */}
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                        <Package size={12} /> Destino
                                    </label>
                                    {isMatriz() || user?.role === 'SUPERADMIN' ? (
                                        <select required value={selectedSucursal} onChange={e => setSelectedSucursal(e.target.value)}
                                            className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none">
                                            <option value="">Sucursal Física...</option>
                                            {sucursales.filter(s => s.tipo !== 'VENDEDOR' && s.tipo !== 'SUPERVISOR').map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                                        </select>
                                    ) : user?.role === 'SUPERVISOR' ? (
                                        supervisorAction === 'PEDIR' ? (
                                            <div className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 font-semibold cursor-not-allowed line-clamp-1">
                                                {sucursales.find(s => s._id === user?.sucursal_id)?.nombre || 'Mi Inventario Móvil'}
                                            </div>
                                        ) : supervisorAction === 'TRANSFERIR' ? (
                                            <select required value={selectedSucursal} onChange={e => setSelectedSucursal(e.target.value)}
                                                className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none">
                                                <option value="">Seleccionar Vendedor...</option>
                                                {sucursales.filter(s => s.tipo === 'VENDEDOR').map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                                            </select>
                                        ) : (
                                            <div className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 font-semibold cursor-not-allowed line-clamp-1">
                                                {sucursales.find(s => s._id === user?.sucursal_id)?.nombre || 'Mi Inventario Móvil'}
                                            </div>
                                        )
                                    ) : (
                                        supervisorAction === 'TRANSFERIR' ? (
                                            <select required value={selectedSucursal} onChange={e => setSelectedSucursal(e.target.value)}
                                                className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none">
                                                <option value="">Seleccionar Supervisor Móvil...</option>
                                                {sucursales.filter(s => s.tipo === 'SUPERVISOR').map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                                            </select>
                                        ) : (
                                            <div className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 font-semibold cursor-not-allowed line-clamp-1">
                                                {sucursales.find(s => s._id === user?.sucursal_id)?.nombre || 'Esta Sucursal'}
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5 gap-2">
                                    <label className="text-xs font-semibold text-gray-700">Explorar Catálogo *</label>
                                    <div className="flex-1 px-4">
                                        <input type="text" placeholder="🔍 Buscar por nombre o código..." value={searchProd} onChange={e => setSearchProd(e.target.value)}
                                            className="w-full border border-gray-300 rounded px-2 py-1 text-[11px] focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none placeholder-gray-400" />
                                    </div>
                                    <button type="button" onClick={addItem} className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-bold">
                                        <Plus size={12} /> Agregar Ítem Fila
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {orderItems.map((item, i) => (
                                        <div key={i} className="flex gap-1.5 items-center">
                                            <select required value={item.producto_id} onChange={e => updateItem(i, 'producto_id', e.target.value)}
                                                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-[11px] bg-white">
                                                <option value="">-- Seleccionar Producto --</option>
                                                {filteredCatalog.map((p: any) => (
                                                    <option key={p.producto_id} value={p.producto_id}>
                                                        {p.producto_nombre} (Stock: {p.cantidad}) — Valor Unitario: Bs.{(Number(p.precio)||0).toFixed(2)}
                                                    </option>
                                                ))}
                                            </select>
                                            <input required type="number" min="1" value={item.cantidad} onChange={e => updateItem(i, 'cantidad', parseInt(e.target.value) || 1)}
                                                className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-[11px] text-center"
                                                title="Cantidad solicitada/despachada"
                                            />
                                            <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 p-1"><X size={14} /></button>
                                        </div>
                                    ))}
                                    {orderItems.length === 0 && (
                                        <div className="text-center py-4 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                                            <Package size={20} className="mx-auto mb-1 opacity-40" />
                                            <p className="text-[11px] text-gray-500">Sin productos aún</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Notas (opcional)</label>
                                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-1.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-[11px]"
                                    placeholder="Instrucciones especiales..."
                                />
                            </div>

                            <button type="submit" disabled={createMut.isPending || orderItems.length === 0}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm">
                                {createMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Crear Pedido</>}
                            </button>
                        </form>
                    </div>
                </div>
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
                                <X size={20} />
                            </button>
                            
                            <div className="flex flex-col items-center text-center">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 
                                    ${confirmModal.type === 'danger' ? 'bg-red-100 text-red-600' :
                                      confirmModal.type === 'success' ? 'bg-green-100 text-green-600' :
                                      'bg-blue-100 text-blue-600'}`}
                                >
                                    {confirmModal.type === 'danger' ? <AlertTriangle size={32} /> : 
                                     confirmModal.type === 'success' ? <CheckCircle2 size={32} /> : 
                                     <ClipboardList size={32} />}
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

            {/* Reception Modal */}
            {receptionModal.isOpen && (
                <ReceptionModal 
                    pedido={receptionModal.pedido} 
                    onClose={() => setReceptionModal({ isOpen: false, pedido: null })} 
                    onSuccess={() => {
                        setReceptionModal({ isOpen: false, pedido: null });
                        qc.invalidateQueries({ queryKey: ['pedidos'] });
                    }}
                />
            )}
        </div>
    );
}

function ReceptionModal({ pedido, onClose, onSuccess }: { pedido: any; onClose: () => void; onSuccess: () => void }) {
    const [items, setItems] = useState<{producto_id: string, descripcion: string, cantidad_enviada: number, cantidad_recibida: number}[]>(
        pedido.items.map((i: any) => ({
            producto_id: i.producto_id,
            descripcion: i.producto_nombre || i.descripcion,
            cantidad_enviada: i.cantidad,
            cantidad_recibida: i.cantidad // defecto: asume que todo llegó
        }))
    );

    const mut = useMutation({
        mutationFn: () => recibirPedido(pedido._id, items.map(i => ({ producto_id: i.producto_id, cantidad_recibida: i.cantidad_recibida }))),
        onSuccess,
        onError: (err: any) => alert(err?.message || "Error al confirmar recepción")
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Confirmar Recepción Variada</h2>
                        <p className="text-xs text-gray-500 mt-1">Ajusta la cantidad recibida si llegó menos de lo despachado.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200">
                        <X size={18} />
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr>
                                <th className="px-3 py-2">Producto</th>
                                <th className="px-3 py-2 text-center w-24">Enviada</th>
                                <th className="px-3 py-2 text-center w-32">Recibida</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map((i, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50">
                                    <td className="px-3 py-2 text-xs font-semibold">{i.descripcion}</td>
                                    <td className="px-3 py-2 text-center font-bold text-gray-500 bg-gray-50/50">{i.cantidad_enviada}</td>
                                    <td className="px-3 py-2 relative">
                                        <input type="number" min="0" max={i.cantidad_enviada}
                                            value={i.cantidad_recibida}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0;
                                                setItems(items.map((it, n) => n === idx ? { ...it, cantidad_recibida: Math.min(val, it.cantidad_enviada) } : it));
                                            }}
                                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-center text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700 bg-indigo-50"
                                        />
                                        {i.cantidad_recibida !== i.cantidad_enviada && (
                                            <div className="absolute top-1/2 -right-6 -translate-y-1/2 text-amber-500" title="Diferencia de inventario detectada">
                                                <AlertTriangle size={16} />
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg text-sm transition-colors hover:bg-gray-50 shadow-sm">Cancelar</button>
                    <button disabled={mut.isPending} onClick={() => mut.mutate()} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm transition-colors flex items-center gap-1.5 shadow-sm">
                        {mut.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        Confirmar Cantidades
                    </button>
                </div>
            </div>
        </div>
    );
}
