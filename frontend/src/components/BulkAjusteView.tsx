import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getInventario, ajustarInventarioMasivo } from '../api/api';
import { Search, Loader2, Plus, Minus, Trash2, Scale, PackageCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CartItem {
    producto_id: string;
    producto_nombre: string;
    stock_actual: number;
    delta: number;
}

interface Props {
    sucursalId: string;
    almacenId: string;
    onSuccess: () => void;
}

export default function BulkAjusteView({ sucursalId, almacenId, onSuccess }: Props) {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [notasGenerales, setNotasGenerales] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: searchResults, isLoading: searching } = useQuery({
        queryKey: ['inv-search-bulk', sucursalId, debouncedSearch],
        queryFn: () => getInventario(sucursalId, almacenId, 1, 10, debouncedSearch),
        enabled: debouncedSearch.length > 1,
    });

    const addToCart = (item: any) => {
        if (cart.find(c => c.producto_id === item.producto_id)) {
            toast.error('El producto ya está en la lista de ajustes.');
            return;
        }
        setCart([{
            producto_id: item.producto_id,
            producto_nombre: item.producto_nombre,
            stock_actual: item.cantidad,
            delta: 0
        }, ...cart]);
        setSearchTerm('');
    };

    const updateDelta = (id: string, newDelta: number) => {
        setCart(cart.map(c => {
            if (c.producto_id === id) {
                // Prevent negative stock resulting
                if (c.stock_actual + newDelta < 0) {
                    toast.error('El stock resultante no puede ser menor a cero.');
                    return c;
                }
                return { ...c, delta: newDelta };
            }
            return c;
        }));
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(c => c.producto_id !== id));
    };

    const adjustMut = useMutation({
        mutationFn: async () => {
            const ajustes = cart.filter(c => c.delta !== 0).map(c => {
                const tipo = c.delta > 0 ? 'ENTRADA' : 'SALIDA';
                return {
                    producto_id: c.producto_id,
                    tipo: tipo as 'ENTRADA' | 'SALIDA',
                    cantidad: Math.abs(c.delta)
                };
            });

            if (ajustes.length === 0) throw new Error('No hay ajustes válidos para procesar (todos están en 0).');

            return ajustarInventarioMasivo({
                sucursal_id: sucursalId,
                almacen_id: almacenId,
                notas_generales: notasGenerales,
                ajustes
            });
        },
        onSuccess: (res) => {
            toast.success(`Se actualizaron ${res.procesados} productos exitosamente.`);
            setCart([]);
            setNotasGenerales('');
            onSuccess();
        },
        onError: (err: any) => {
            toast.error(err.message || 'Error procesando el ajuste masivo.');
        }
    });

    const totalAdjustments = cart.filter(c => c.delta !== 0).length;

    return (
        <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Columna Izquierda: Buscador */}
            <div className="w-full lg:w-1/3 space-y-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                        <Search size={16} className="text-indigo-500" /> Buscar Productos
                    </h2>
                    <p className="text-xs text-gray-500 mb-4">Busca e inserta productos en la lista para ajustar su cantidad física.</p>
                    
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Ej. Coca Cola 2L..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-xl outline-none transition-all text-sm font-medium text-gray-900"
                        />
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        {searching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" size={16} />}
                    </div>

                    {debouncedSearch.length > 1 && searchResults?.items && (
                        <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden shadow-lg bg-white absolute z-10 w-full max-w-[calc(100vw-2rem)] lg:max-w-xs">
                            {searchResults.items.length === 0 ? (
                                <div className="p-4 text-center text-xs text-gray-500">No se encontraron productos.</div>
                            ) : (
                                <ul className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                                    {searchResults.items.map(item => (
                                        <li 
                                            key={item.producto_id}
                                            onClick={() => addToCart(item)}
                                            className="p-3 hover:bg-indigo-50 cursor-pointer transition-colors flex items-center justify-between group"
                                        >
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 line-clamp-1">{item.producto_nombre}</p>
                                                <p className="text-[10px] text-gray-500 font-medium">Stock Actual: {item.cantidad} u.</p>
                                            </div>
                                            <Plus size={16} className="text-indigo-400 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl flex items-start gap-3">
                    <AlertCircle size={20} className="text-indigo-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-indigo-800 leading-relaxed font-medium">
                        Usa valores <strong>positivos</strong> (ej. 5) para registrar entradas (compras, camiones) y valores <strong>negativos</strong> (ej. -2) para registrar salidas (mermas, daños). El sistema calculará el stock final automáticamente.
                    </p>
                </div>
            </div>

            {/* Columna Derecha: Lista de Ajuste */}
            <div className="w-full lg:w-2/3 flex flex-col gap-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <div>
                            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <Scale size={16} className="text-indigo-500" /> Ráfaga de Ajustes
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">Productos en la cola: {cart.length}</p>
                        </div>
                        {cart.length > 0 && (
                            <button 
                                onClick={() => setCart([])}
                                className="text-[11px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                                Limpiar Lista
                            </button>
                        )}
                    </div>
                    
                    <div className="p-4 flex-1 overflow-y-auto bg-gray-50/30">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3 py-10">
                                <PackageCheck size={48} className="opacity-20" />
                                <p className="text-sm font-medium">La lista está vacía.</p>
                                <p className="text-xs">Busca productos en el panel izquierdo para comenzar.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {cart.map(item => {
                                    const isPos = item.delta > 0;
                                    const isNeg = item.delta < 0;
                                    const resultStock = item.stock_actual + item.delta;
                                    
                                    return (
                                        <div key={item.producto_id} className="bg-white border border-gray-200 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-indigo-200 transition-colors">
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-gray-900 truncate">{item.producto_nombre}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-bold">
                                                        Actual: {item.stock_actual}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">→</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-black ${
                                                        isPos ? 'bg-green-100 text-green-700' : isNeg ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        Final: {resultStock}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-3 self-end sm:self-auto">
                                                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-0.5">
                                                    <button 
                                                        onClick={() => updateDelta(item.producto_id, item.delta - 1)}
                                                        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-white hover:text-red-500 rounded-md transition-colors shadow-sm"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <input 
                                                        type="number"
                                                        value={item.delta || ''}
                                                        onChange={(e) => updateDelta(item.producto_id, parseInt(e.target.value) || 0)}
                                                        className="w-14 text-center bg-transparent outline-none text-sm font-black font-mono text-gray-900"
                                                        placeholder="0"
                                                    />
                                                    <button 
                                                        onClick={() => updateDelta(item.producto_id, item.delta + 1)}
                                                        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-white hover:text-green-600 rounded-md transition-colors shadow-sm"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                                <button 
                                                    onClick={() => removeFromCart(item.producto_id)}
                                                    className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {cart.length > 0 && (
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                Justificación / Motivo General
                            </label>
                            <input 
                                type="text"
                                value={notasGenerales}
                                onChange={e => setNotasGenerales(e.target.value)}
                                placeholder="Ej. Llegada de almacén matriz, limpieza mensual..."
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-xl outline-none transition-all text-sm font-medium"
                            />
                        </div>
                        <button 
                            onClick={() => adjustMut.mutate()}
                            disabled={adjustMut.isPending || totalAdjustments === 0}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                        >
                            {adjustMut.isPending ? <Loader2 size={18} className="animate-spin" /> : <PackageCheck size={18} />}
                            {adjustMut.isPending ? 'Procesando Ráfaga...' : `Procesar ${totalAdjustments} Ajuste${totalAdjustments !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
