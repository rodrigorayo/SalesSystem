import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, Plus, ArrowRight, Package, CheckCircle2, Clock, XCircle, FileText, Search } from 'lucide-react';
import { getTraslados, despacharTraslado, recibirTraslado, cancelarTraslado } from '../api/traslados';
import { getSucursales, getInventario } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

export default function InventarioTrasladosPage() {
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<'enviados' | 'recibidos'>('enviados');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState<string | null>(null);

    // Queries
    const { data: trasladosData, isLoading } = useQuery({
        queryKey: ['traslados', tab],
        queryFn: () => getTraslados({ tipo: tab }),
    });

    const { data: sucursales = [] } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales,
    });

    const traslados = (trasladosData as any)?.items || [];

    const handleSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['traslados'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
    };

    const cancelMutation = useMutation({
        mutationFn: cancelarTraslado,
        onSuccess: () => {
            toast.success("Traslado cancelado. Stock devuelto.");
            handleSuccess();
        }
    });

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <Truck className="text-indigo-600" size={32} />
                        Traslados de Inventario
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Mueve stock entre sucursales sin afectar la caja.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 w-full sm:w-auto justify-center"
                >
                    <Plus size={20} />
                    Nuevo Traslado
                </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100/50 p-1 rounded-2xl w-full sm:w-max">
                <button
                    onClick={() => setTab('enviados')}
                    className={`flex-1 sm:px-8 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        tab === 'enviados' ? 'bg-white text-indigo-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Enviados (Salidas)
                </button>
                <button
                    onClick={() => setTab('recibidos')}
                    className={`flex-1 sm:px-8 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        tab === 'recibidos' ? 'bg-white text-indigo-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Recibidos (Entradas)
                </button>
            </div>

            {/* Lista */}
            <div className="grid gap-4">
                {isLoading ? (
                    <div className="text-center py-10 text-gray-400 font-medium">Cargando traslados...</div>
                ) : traslados.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 border-dashed">
                        <Truck size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-700">No hay traslados {tab}</h3>
                        <p className="text-sm text-gray-400 mt-1">Cuando {tab === 'enviados' ? 'envíes' : 'te envíen'} mercadería, aparecerá aquí.</p>
                    </div>
                ) : (
                    traslados.map((t: any) => (
                        <div key={t._id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            {/* Decorative Line */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                t.estado === 'COMPLETADO' ? 'bg-emerald-500' :
                                t.estado === 'EN_TRANSITO' ? 'bg-amber-400' : 'bg-red-500'
                            }`} />
                            
                            <div className="flex flex-col md:flex-row gap-6 justify-between">
                                <div className="space-y-3 flex-1">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider ${
                                            t.estado === 'COMPLETADO' ? 'bg-emerald-50 text-emerald-700' :
                                            t.estado === 'EN_TRANSITO' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                                        }`}>
                                            {t.estado.replace('_', ' ')}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono">{new Date(t.created_at).toLocaleString('es-BO')}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 text-gray-700">
                                        <div className="font-bold">{t.sucursal_origen_nombre}</div>
                                        <ArrowRight size={16} className="text-gray-300" />
                                        <div className="font-bold">{t.sucursal_destino_nombre}</div>
                                    </div>

                                    <div className="text-sm text-gray-500 flex items-center gap-2">
                                        <Package size={16} />
                                        <span>{t.items.length} productos diferentes</span>
                                    </div>
                                </div>

                                <div className="flex flex-col items-start md:items-end justify-center gap-3 min-w-[200px] bg-gray-50 p-4 rounded-xl">
                                    <div className="text-xs text-gray-500">Valor al Costo</div>
                                    <div className="text-xl font-black text-gray-900">
                                        Bs. {t.valor_total_enviado?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                                    </div>
                                    
                                    {tab === 'recibidos' && t.estado === 'EN_TRANSITO' && (
                                        <button 
                                            onClick={() => setIsReceiveModalOpen(t)}
                                            className="w-full mt-2 bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200"
                                        >
                                            Recibir Mercadería
                                        </button>
                                    )}
                                    {tab === 'enviados' && t.estado === 'EN_TRANSITO' && (
                                        <button 
                                            onClick={() => {
                                                if(confirm("¿Estás seguro de cancelar este traslado? El stock volverá a tu sucursal.")) {
                                                    cancelMutation.mutate(t._id);
                                                }
                                            }}
                                            className="w-full mt-2 text-red-500 font-bold py-1 px-4 text-xs hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            Cancelar Envío
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modals */}
            {isCreateModalOpen && (
                <CreateTrasladoModal 
                    onClose={() => setIsCreateModalOpen(false)} 
                    sucursales={sucursales}
                    onSuccess={handleSuccess}
                />
            )}
            
            {isReceiveModalOpen && (
                <ReceiveTrasladoModal 
                    traslado={isReceiveModalOpen}
                    onClose={() => setIsReceiveModalOpen(null)} 
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
}

// ─── Componentes Hijos (Modales) ─────────────────────────────────────────────

function CreateTrasladoModal({ onClose, sucursales, onSuccess }: any) {
    const { user } = useAuthStore();
    const [destinoId, setDestinoId] = useState('');
    const [notas, setNotas] = useState('');
    const [items, setItems] = useState<any[]>([]);
    const [search, setSearch] = useState('');

    const sucursalId = user?.sucursal_id || 'CENTRAL';

    const { data: inventarioResponse, isLoading: isLoadingInventario } = useQuery({
        queryKey: ['inventario-traslado', sucursalId, search],
        queryFn: () => getInventario(sucursalId, 1, 100, search || undefined),
    });
    const inventario = (inventarioResponse as any)?.items || [];
    // Only show products that are NOT already in the items list
    const productosDisponibles = inventario.filter((inv: any) => 
        !items.find(i => i.producto_id === inv.producto_id)
    );

    const mutation = useMutation({
        mutationFn: despacharTraslado,
        onSuccess: () => {
            toast.success('Traslado despachado exitosamente');
            onSuccess();
            onClose();
        },
        onError: (err: any) => {
            const msg = (err as any)?.message || 'Error al despachar el traslado';
            toast.error(msg);
        }
    });

    const addItem = (inv: any) => {
        if (!inv) return;
        if (inv.cantidad <= 0) {
            toast.error(`No tienes stock de '${inv.producto_nombre}' en tu sucursal.`);
            return;
        }
        if (!items.find(i => i.producto_id === inv.producto_id)) {
            setItems([...items, { 
                producto_id: inv.producto_id, 
                descripcion: inv.producto_nombre, 
                cantidad: 1, 
                maxStock: inv.cantidad 
            }]);
            setSearch('');
        }
    };

    const updateQty = (id: string, qty: number) => {
        const item = items.find(i => i.producto_id === id);
        if (item && qty > item.maxStock) {
            toast.warning(`Stock insuficiente. Máximo disponible: ${item.maxStock}`);
        }
        setItems(items.map(i => i.producto_id === id ? { ...i, cantidad: qty } : i));
    };

    const hasErrors = items.some(i => i.cantidad > i.maxStock || i.cantidad < 1);

    const handleSubmit = () => {
        if (!destinoId) return toast.error("Selecciona una sucursal destino");
        if (items.length === 0) return toast.error("Agrega al menos un producto");
        const exceedsItem = items.find(i => i.cantidad > i.maxStock);
        if (exceedsItem) {
            return toast.error(`Stock insuficiente para '${exceedsItem.descripcion}'. Disponible: ${exceedsItem.maxStock}`);
        }
        mutation.mutate({
            sucursal_destino_id: destinoId,
            notas,
            items: items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad }))
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-xl font-black text-gray-800">Nuevo Traslado</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <XCircle size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    {/* Destino */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Sucursal Destino</label>
                        <select 
                            value={destinoId} 
                            onChange={(e) => setDestinoId(e.target.value)}
                            className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-black"
                        >
                            <option value="">-- Seleccionar Destino --</option>
                            {sucursales.filter((s: any) => s._id !== user?.sucursal_id).map((s: any) => (
                                <option key={s._id} value={s._id}>{s.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* Buscador de productos */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Buscar Producto de tu Sucursal
                        </label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nombre..."
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-black"
                            />
                        </div>

                        {/* Resultados de búsqueda */}
                        {search && (
                            <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden shadow-lg max-h-52 overflow-y-auto">
                                {isLoadingInventario ? (
                                    <div className="p-3 text-sm text-gray-400 text-center">Buscando...</div>
                                ) : productosDisponibles.length === 0 ? (
                                    <div className="p-3 text-sm text-gray-400 text-center">No se encontraron productos con stock</div>
                                ) : (
                                    productosDisponibles.map((inv: any) => (
                                        <button
                                            key={inv.producto_id}
                                            onClick={() => addItem(inv)}
                                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 text-left transition-colors border-b border-gray-50 last:border-0"
                                        >
                                            <span className="text-sm font-medium text-gray-800">{inv.producto_nombre}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                                                inv.cantidad > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                                            }`}>
                                                Stock: {inv.cantidad}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Tabla de ítems seleccionados */}
                    {items.length > 0 && (
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Producto</th>
                                        <th className="px-4 py-3 text-center">Disponible</th>
                                        <th className="px-4 py-3 w-32 text-center">Cantidad</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {items.map(item => {
                                        const hasError = item.cantidad > item.maxStock || item.cantidad < 1;
                                        return (
                                            <tr key={item.producto_id} className={hasError ? 'bg-red-50' : ''}>
                                                <td className="px-4 py-3 font-medium text-gray-800">{item.descripcion}</td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-500">{item.maxStock}</td>
                                                <td className="px-4 py-3">
                                                    <input 
                                                        type="number" 
                                                        min="1"
                                                        max={item.maxStock}
                                                        value={item.cantidad}
                                                        onChange={e => updateQty(item.producto_id, parseInt(e.target.value) || 1)}
                                                        onFocus={(e) => e.target.select()}
                                                        className={`w-full p-2 border rounded-lg text-center font-bold transition-colors ${
                                                            hasError 
                                                                ? 'border-red-400 bg-red-100 text-red-700' 
                                                                : 'border-gray-200 text-black'
                                                        }`}
                                                    />
                                                    {hasError && (
                                                        <p className="text-[10px] text-red-500 text-center mt-1">
                                                            Máx. {item.maxStock}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button 
                                                        onClick={() => setItems(items.filter(i => i.producto_id !== item.producto_id))} 
                                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                    >
                                                        <XCircle size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Notas */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Notas (Opcional)</label>
                        <input 
                            type="text" 
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            placeholder="Ej. Envío por bus, caja azul..."
                            className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-black"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={mutation.isPending || hasErrors}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center gap-2"
                    >
                        {mutation.isPending ? <Clock size={16} className="animate-spin" /> : <Truck size={16} />}
                        Despachar Traslado
                    </button>
                </div>
            </div>
        </div>
    );
}


function ReceiveTrasladoModal({ onClose, traslado, onSuccess }: any) {
    const [items, setItems] = useState<any[]>(traslado.items.map((i: any) => ({ ...i, cantidad_recibida: i.cantidad_enviada })));
    const [notas, setNotas] = useState('');

    const mutation = useMutation({
        mutationFn: (data: any) => recibirTraslado(traslado._id, data),
        onSuccess: () => {
            toast.success('Traslado recibido exitosamente');
            onSuccess();
            onClose();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Error al recibir el traslado');
        }
    });

    const updateQty = (id: string, qty: number) => {
        setItems(items.map(i => i.producto_id === id ? { ...i, cantidad_recibida: qty } : i));
    };

    const handleSubmit = () => {
        mutation.mutate({
            notas,
            items: items.map(i => ({ producto_id: i.producto_id, cantidad_recibida: i.cantidad_recibida }))
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 bg-emerald-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-emerald-800">Recibir Mercadería</h2>
                        <p className="text-sm text-emerald-600 mt-0.5">Verifica lo recibido desde {traslado.sucursal_origen_nombre}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-emerald-100 rounded-full transition-colors text-emerald-600">
                        <XCircle size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="border border-emerald-100 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-emerald-50 text-emerald-700">
                                <tr>
                                    <th className="p-3">Producto</th>
                                    <th className="p-3 text-center">Enviado</th>
                                    <th className="p-3 w-32">Recibido Real</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.map(item => (
                                    <tr key={item.producto_id}>
                                        <td className="p-3 font-medium text-gray-700">{item.descripcion}</td>
                                        <td className="p-3 text-center font-bold text-gray-500">{item.cantidad_enviada}</td>
                                        <td className="p-3">
                                            <input 
                                                type="number" 
                                                min="0"
                                                max={item.cantidad_enviada}
                                                value={item.cantidad_recibida}
                                                onChange={e => updateQty(item.producto_id, parseInt(e.target.value) || 0)}
                                                onFocus={(e) => e.target.select()}
                                                className={`w-full p-2 border rounded-lg text-center font-bold ${
                                                    item.cantidad_recibida < item.cantidad_enviada ? 'bg-red-50 border-red-200 text-red-600' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                }`}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {items.some(i => i.cantidad_recibida < i.cantidad_enviada) && (
                        <div className="p-4 bg-amber-50 text-amber-800 rounded-xl text-sm font-medium flex gap-3 items-start border border-amber-200">
                            <FileText className="shrink-0 text-amber-500" />
                            <p>Has marcado una cantidad menor a la enviada. La diferencia se considerará pérdida/merma en tránsito y no se sumará a tu inventario.</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Observaciones</label>
                        <input 
                            type="text" 
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            placeholder="Ej. Una caja llegó abollada..."
                            className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={mutation.isPending}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center gap-2"
                    >
                        {mutation.isPending ? <Clock size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        Confirmar Recepción
                    </button>
                </div>
            </div>
        </div>
    );
}
