import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPedidos, createPedido, despacharPedido, recibirPedido, cancelarPedido, aceptarPedido, getSucursales, getProducts } from '../api/api';
import { useAuthStore } from '../store/authStore';

import {
    ClipboardList, Plus, Truck, CheckCircle2, Clock,
    X, Check, Loader2, ChevronDown, ChevronRight, Package,
    CheckSquare, Ban
} from 'lucide-react';

type TabType = 'todos' | 'CREADO' | 'ACEPTADO' | 'DESPACHADO' | 'RECIBIDO' | 'CANCELADO';

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

    const [selectedSucursal, setSelectedSucursal] = useState('');
    const [orderItems, setOrderItems] = useState<{ producto_id: string; cantidad: number }[]>([]);
    const [notas, setNotas] = useState('');

    const { data: pedidos = [], isLoading } = useQuery({
        queryKey: ['pedidos', tab],
        queryFn: () => getPedidos(undefined, tab === 'todos' ? undefined : tab),
    });
    const { data: sucursales = [] } = useQuery({ queryKey: ['sucursales'], queryFn: getSucursales });
    const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: getProducts });

    const createMut = useMutation({
        mutationFn: createPedido,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['pedidos'] }); setShowCreate(false); resetForm(); },
    });
    const despacharMut = useMutation({
        mutationFn: despacharPedido,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos'] }),
    });
    const recibirMut = useMutation({
        mutationFn: recibirPedido,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos'] }),
    });
    const cancelarMut = useMutation({
        mutationFn: cancelarPedido,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos'] }),
    });
    const aceptarMut = useMutation({
        mutationFn: aceptarPedido,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos'] }),
    });

    const resetForm = () => { setSelectedSucursal(''); setOrderItems([]); setNotas(''); };
    const addItem = () => setOrderItems(p => [...p, { producto_id: '', cantidad: 1 }]);
    const updateItem = (i: number, f: 'producto_id' | 'cantidad', v: string | number) =>
        setOrderItems(p => p.map((item, idx) => idx === i ? { ...item, [f]: v } : item));
    const removeItem = (i: number) => setOrderItems(p => p.filter((_, idx) => idx !== i));

    return (
        <div className="max-w-7xl mx-auto p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Pedidos Internos</h1>
                    <p className="text-gray-500 text-xs mt-1">Transferencias de stock Matriz → Sucursal</p>
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
                        const sNombre = sucursales.find(s => s._id === pedido.sucursal_id)?.nombre ?? pedido.sucursal_id;

                        return (
                            <div key={pedido._id} className={`${cfg.bg} border-2 ${cfg.border} rounded-2xl overflow-hidden hover:shadow-md transition-shadow ${isOpen ? 'shadow-md' : 'shadow-sm'}`}>
                                <button onClick={() => setExpanded(isOpen ? null : pedido._id)}
                                    className="w-full flex items-center justify-between p-4 text-left">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
                                            <Icon size={16} className={cfg.color} />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-sm text-gray-900">{sNombre}</div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(pedido.created_at).toLocaleDateString()} · {pedido.items.length} producto(s)
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400">Total</div>
                                            <div className="font-bold text-gray-900">${(pedido.total_mayorista || 0).toFixed(2)}</div>
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
                                                            <td className="py-1.5">{item.producto_nombre}</td>
                                                            <td className="py-1.5 text-center">{item.cantidad}</td>
                                                            <td className="py-1.5 text-right">${(item.precio_mayorista || 0).toFixed(2)}</td>
                                                            <td className="py-1.5 text-right font-medium">${(item.cantidad * (item.precio_mayorista || 0)).toFixed(2)}</td>
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
                                                <button onClick={() => { if (window.confirm("¿Estás seguro de cancelar este pedido?")) cancelarMut.mutate(pedido._id); }} disabled={cancelarMut.isPending}
                                                    className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm mr-auto">
                                                    {cancelarMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                                                    Cancelar
                                                </button>
                                            )}
                                            {pedido.estado === 'CREADO' && isMatriz() && (
                                                <button onClick={() => aceptarMut.mutate(pedido._id)} disabled={aceptarMut.isPending}
                                                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                                                    {aceptarMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />}
                                                    Aceptar Pedido
                                                </button>
                                            )}
                                            {pedido.estado === 'ACEPTADO' && isMatriz() && (
                                                <button onClick={() => despacharMut.mutate(pedido._id)} disabled={despacharMut.isPending}
                                                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                                                    {despacharMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                                                    Despachar
                                                </button>
                                            )}
                                            {pedido.estado === 'DESPACHADO' && isSucursal() && (
                                                <button onClick={() => recibirMut.mutate(pedido._id)} disabled={recibirMut.isPending}
                                                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                                                    {recibirMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                                    Confirmar Recepción
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
                            const targetId = isMatriz() || user?.role === 'SUPERADMIN' ? selectedSucursal : user?.sucursal_id;
                            const validItems = orderItems.filter(i => i.producto_id.trim() !== '');
                            if (!targetId || validItems.length === 0) {
                                alert("Por favor, selecciona al menos un producto válido para el pedido.");
                                return;
                            }
                            createMut.mutate({ sucursal_id: targetId, items: validItems, notas: notas || undefined });
                        }} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Sucursal Destino *</label>
                                {isMatriz() || user?.role === 'SUPERADMIN' ? (
                                    <select required value={selectedSucursal} onChange={e => setSelectedSucursal(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-1.5 text-xs text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white">
                                        <option value="">Selecciona sucursal…</option>
                                        {sucursales.map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                                    </select>
                                ) : (
                                    <div className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-1.5 text-xs text-gray-700 font-medium cursor-not-allowed">
                                        {sucursales.find(s => s._id === user?.sucursal_id)?.nombre || 'Mi Sucursal'}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-semibold text-gray-700">Productos *</label>
                                    <button type="button" onClick={addItem} className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-bold">
                                        <Plus size={12} /> Agregar
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {orderItems.map((item, i) => (
                                        <div key={i} className="flex gap-1.5 items-center">
                                            <select required value={item.producto_id} onChange={e => updateItem(i, 'producto_id', e.target.value)}
                                                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-[11px] bg-white">
                                                <option value="">Producto…</option>
                                                {products.map((p: any) => <option key={p._id || p.id} value={p._id || p.id}>{p.descripcion || p.name}</option>)}
                                            </select>
                                            <input required type="number" min="1" value={item.cantidad} onChange={e => updateItem(i, 'cantidad', parseInt(e.target.value) || 1)}
                                                className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-[11px] text-center"
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
        </div>
    );
}
