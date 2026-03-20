import React, { useState, useMemo, useEffect } from 'react';
import { useLocalStorage } from 'usehooks-ts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Warehouse, ArrowDownRight, ArrowUpRight, Scale, Loader2, Package, Search, History, X, Check, Tag, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { getInventario, getMovimientosInventario, ajustarInventario, getSucursales, crearSolicitudPrecio, exportInventoryTemplate, importInventoryBranchExcel } from '../api/api';
import { useDropzone } from 'react-dropzone';
import { useAuthStore } from '../store/authStore';
import type { AjusteInventario } from '../api/types';
import Pagination from '../components/Pagination';

const formatDate = (dateStr: string) => {
    const isoStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    return new Date(isoStr).toLocaleString();
};

export default function InventarioPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    // Si es matriz/admin puede ver cualquier sucursal (por defecto CENTRAL). Si es sucursal, solo la suya.
    const esMatriz = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN_MATRIZ' || user?.role === 'ADMIN';
    const esAdminSucursal = esMatriz || user?.role === 'ADMIN_SUCURSAL';
    const [selectedSucursal, setSelectedSucursal] = useState<string>(esMatriz ? 'CENTRAL' : (user?.sucursal_id || 'CENTRAL'));
    const [tab, setTab] = useLocalStorage<'stock' | 'kardex'>('inventario-tab', 'stock');
    const [searchTerm, setSearchTerm] = useLocalStorage('inventario-search', '');

    const { data: sucursales = [] } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales,
        enabled: esMatriz,
    });

    const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const [currentPageStock, setCurrentPageStock] = useState(1);
    const [currentPageKardex, setCurrentPageKardex] = useState(1);
    const ITEMS_PER_PAGE = 20;

    const { data: invData, isLoading: loadingInv } = useQuery({
        queryKey: ['inventario', selectedSucursal, currentPageStock, ITEMS_PER_PAGE, debouncedSearch],
        queryFn: () => getInventario(selectedSucursal, currentPageStock, ITEMS_PER_PAGE, debouncedSearch || undefined),
        enabled: tab === 'stock'
    });
    
    const inventario = invData?.items || [];
    const totalPagesStock = invData?.pages || 1;
    const totalItemsStock = invData?.total || 0;

    const { data: movimientos = [], isLoading: loadingMovs } = useQuery({
        queryKey: ['movimientos', selectedSucursal],
        queryFn: () => getMovimientosInventario(selectedSucursal),
        enabled: tab === 'kardex',
    });

    // Modals State
    const [adjItem, setAdjItem] = useState<{ id: string, name: string } | null>(null);
    const [priceReqItem, setPriceReqItem] = useState<{ id: string, name: string, currentPrice: number } | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    useEffect(() => {
        setCurrentPageStock(1);
        setCurrentPageKardex(1);
    }, [searchTerm, selectedSucursal, tab]);

    const filteredMovs = useMemo(() => {
        if (!debouncedSearch) return movimientos;
        return movimientos.filter(m => m.producto_nombre?.toLowerCase().includes(debouncedSearch.toLowerCase()));
    }, [movimientos, debouncedSearch]);

    const paginatedMovs = useMemo(() => {
        const startIndex = (currentPageKardex - 1) * ITEMS_PER_PAGE;
        return filteredMovs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredMovs, currentPageKardex]);

    const handleAjusteSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['inventario', selectedSucursal] });
        queryClient.invalidateQueries({ queryKey: ['movimientos', selectedSucursal] });
        setAdjItem(null);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-4 p-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                <div>
                    <h1 className="text-lg font-bold text-gray-900 tracking-tight">Gestión de Inventarios</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Control de stock físico y kárdex de movimientos por sucursal.</p>
                </div>

                {esMatriz && (
                    <div className="w-full md:w-56">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Viendo Sucursal</label>
                        <select
                            value={selectedSucursal}
                            onChange={e => setSelectedSucursal(e.target.value)}
                            className="w-full bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-lg px-2.5 py-1.5 outline-none transition-all text-xs font-semibold text-gray-900 shadow-sm"
                        >
                            <option value="CENTRAL">Almacén Central (Matriz)</option>
                            {sucursales.map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {/* Toolbar (Buscador + Tabs) */}
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3 w-full">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-white text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-lg outline-none transition-all text-xs font-medium shadow-sm"
                        />
                    </div>
                    <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-100 inline-flex">
                        <button
                            onClick={() => setTab('stock')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${tab === 'stock' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                        >
                            <Warehouse size={14} className={tab === 'stock' ? 'text-indigo-600' : 'text-gray-400'} />
                            <span>Stock Actual</span>
                        </button>
                        <button
                            onClick={() => setTab('kardex')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${tab === 'kardex' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                        >
                            <History size={14} className={tab === 'kardex' ? 'text-indigo-600' : 'text-gray-400'} />
                            <span>Kárdex (Movimientos)</span>
                        </button>
                    </div>
                </div>
                {tab === 'stock' && esAdminSucursal && (
                    <button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all shadow-sm whitespace-nowrap"
                    >
                        <FileSpreadsheet size={14} />
                        Importar Conteo Excel
                    </button>
                )}
            </div>

            {tab === 'stock' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-[10px] tracking-wider border-b border-gray-100">
                                    <tr>
                                        <th className="px-3 py-2">Producto</th>
                                        <th className="px-3 py-2 text-center">Stock Físico</th>
                                        <th className="px-3 py-2 text-right">Precio Actual</th>
                                        {esAdminSucursal && <th className="px-3 py-2 text-right">Acciones</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loadingInv ? (
                                        <tr>
                                            <td colSpan={esAdminSucursal ? 4 : 3} className="px-4 py-8 text-center text-gray-400">
                                                <Loader2 size={32} className="mx-auto animate-spin mb-3 text-indigo-400" />
                                                <p>Cargando inventario...</p>
                                            </td>
                                        </tr>
                                    ) : inventario.length === 0 ? (
                                        <tr>
                                            <td colSpan={esAdminSucursal ? 4 : 3} className="px-4 py-8 text-center text-gray-400">
                                                <Package size={48} className="mx-auto mb-4 opacity-20" />
                                                <p className="text-base font-medium text-gray-600">No hay stock registrado</p>
                                                <p className="text-sm mt-1">Realiza un ajuste de inventario para inicializar el stock.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        inventario.map((item) => (
                                            <tr key={item.producto_id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                            {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <Package size={16} className="text-gray-300" />}
                                                        </div>
                                                        <div className="font-semibold text-gray-900">{item.producto_nombre}</div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${item.cantidad > 10 ? 'bg-green-100 text-green-700 border border-green-200' :
                                                        item.cantidad > 0 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                                            'bg-red-100 text-red-700 border border-red-200'
                                                        }`}>
                                                        {item.cantidad} u.
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`font-mono font-bold ${item.precio_sucursal ? 'text-indigo-600' : 'text-gray-900'}`}>
                                                            Bs. {(item.precio_sucursal ?? item.precio ?? 0).toFixed(2)}
                                                        </span>
                                                        {item.precio_sucursal && (
                                                            <span className="text-[9px] text-gray-400 line-through font-mono">
                                                                Bs. {item.precio.toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                {esAdminSucursal && (
                                                    <td className="px-3 py-2 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                onClick={() => setAdjItem({ id: item.producto_id, name: item.producto_nombre })}
                                                                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase rounded-md transition-colors border border-indigo-100"
                                                                title="Ajustar Stock"
                                                            >
                                                                <Scale size={12} />
                                                            </button>
                                                            {(!esMatriz || selectedSucursal !== 'CENTRAL') && (
                                                                <button
                                                                    onClick={() => setPriceReqItem({ id: item.producto_id, name: item.producto_nombre, currentPrice: item.precio_sucursal ?? item.precio })}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-md transition-colors border border-amber-100"
                                                                    title="Solicitar Cambio de Precio"
                                                                >
                                                                    <Tag size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {totalItemsStock > ITEMS_PER_PAGE && (
                            <Pagination 
                                currentPage={currentPageStock}
                                totalPages={totalPagesStock}
                                onPageChange={setCurrentPageStock}
                                totalItems={totalItemsStock}
                                itemsPerPage={ITEMS_PER_PAGE}
                            />
                        )}
                    </div>
                </div>
            )}

            {tab === 'kardex' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-[10px] tracking-wider border-b border-gray-100">
                                <tr>
                                    <th className="px-3 py-2">Fecha</th>
                                    <th className="px-3 py-2">Producto</th>
                                    <th className="px-3 py-2">Tipo Mov.</th>
                                    <th className="px-3 py-2 text-right">Cantidad</th>
                                    <th className="px-3 py-2 text-right">Stock Final</th>
                                    <th className="px-3 py-2">Usuario / Notas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loadingMovs ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                            <Loader2 size={32} className="mx-auto animate-spin mb-3 text-indigo-400" />
                                            <p>Cargando historial de movimientos...</p>
                                        </td>
                                    </tr>
                                ) : filteredMovs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                            <History size={48} className="mx-auto mb-4 opacity-20" />
                                            <p className="text-base font-medium text-gray-600">Sin movimientos {searchTerm ? 'para esta búsqueda' : 'registrados'}</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedMovs.map((mov) => {
                                        const isPos = mov.cantidad_movida > 0;
                                        const isNeg = mov.cantidad_movida < 0;
                                        return (
                                            <tr key={mov._id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-[11px]">
                                                    {formatDate(mov.created_at)}
                                                </td>
                                                <td className="px-3 py-2 font-semibold text-gray-900">
                                                    {mov.producto_nombre}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase border ${isPos ? 'bg-green-50 text-green-700 border-green-200' :
                                                        isNeg ? 'bg-red-50 text-red-700 border-red-200' :
                                                            'bg-gray-50 text-gray-700 border-gray-200'
                                                        }`}>
                                                        {isPos ? <ArrowDownRight size={10} /> : isNeg ? <ArrowUpRight size={10} /> : <Scale size={10} />}
                                                        {mov.tipo_movimiento.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className={`px-3 py-2 text-right font-black font-mono ${isPos ? 'text-green-600' : isNeg ? 'text-red-500' : 'text-gray-900'}`}>
                                                    {mov.cantidad_movida > 0 ? '+' : ''}{mov.cantidad_movida}
                                                </td>
                                                <td className="px-3 py-2 text-right font-black font-mono text-gray-900">
                                                    {mov.stock_resultante}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="text-gray-900 font-semibold">{mov.usuario_nombre}</div>
                                                    {mov.notas && <div className="text-[10px] text-gray-500 mt-0.5 max-w-[200px] truncate" title={mov.notas}>{mov.notas}</div>}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {filteredMovs.length > ITEMS_PER_PAGE && (
                        <Pagination 
                            currentPage={currentPageKardex}
                            totalPages={Math.ceil(filteredMovs.length / ITEMS_PER_PAGE)}
                            onPageChange={setCurrentPageKardex}
                            totalItems={filteredMovs.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                        />
                    )}
                </div>
            )}

            {/* Modal de Cambio de Precio */}
            {priceReqItem && (
                <PriceRequestModal
                    isOpen={true}
                    onClose={() => setPriceReqItem(null)}
                    sucursalId={selectedSucursal}
                    productoId={priceReqItem.id}
                    productoNombre={priceReqItem.name}
                    currentPrice={priceReqItem.currentPrice}
                    onSuccess={() => {
                        setPriceReqItem(null);
                        queryClient.invalidateQueries({ queryKey: ['inventario', selectedSucursal] });
                    }}
                />
            )}

            {/* Modal de Ajuste */}
            {adjItem && (
                <AjusteModal
                    isOpen={true}
                    onClose={() => setAdjItem(null)}
                    sucursalId={selectedSucursal}
                    productoId={adjItem.id}
                    productoNombre={adjItem.name}
                    onSuccess={handleAjusteSuccess}
                />
            )}

            {isImportModalOpen && (
                <ImportInventoryModal onClose={() => setIsImportModalOpen(false)} sucursalId={selectedSucursal} />
            )}
        </div>
    );
}

function PriceRequestModal({ onClose, sucursalId, productoId, productoNombre, currentPrice, onSuccess }: any) {
    const [precioPropuesto, setPrecioPropuesto] = useState<number | ''>(currentPrice);
    const [motivo, setMotivo] = useState('');

    const reqMut = useMutation({
        mutationFn: (data: any) => crearSolicitudPrecio(data),
        onSuccess: onSuccess,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!precioPropuesto || precioPropuesto <= 0 || !motivo) return;
        reqMut.mutate({
            sucursal_id: sucursalId,
            producto_id: productoId,
            precio_propuesto: Number(precioPropuesto),
            motivo_solicitud: motivo,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-amber-50">
                    <div>
                        <h3 className="text-sm font-bold text-amber-900">Solicitar Cambio de Precio</h3>
                        <p className="text-[10px] text-amber-700">{productoNombre}</p>
                    </div>
                    <button onClick={onClose} className="p-1 text-amber-400 hover:text-amber-700 rounded-md hover:bg-amber-100 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Precio Actual</label>
                            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-xs font-mono font-bold text-gray-400">
                                Bs. {currentPrice.toFixed(2)}
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Precio Propuesto</label>
                            <input
                                type="number" step="0.5" min="0" required
                                autoFocus
                                className="w-full bg-white border border-indigo-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-lg px-2.5 py-1.5 outline-none transition-all text-xs font-bold font-mono text-gray-900"
                                value={precioPropuesto}
                                onChange={e => setPrecioPropuesto(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Motivo de la Propuesta *</label>
                        <textarea
                            required rows={3}
                            className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-lg px-2.5 py-1.5 outline-none transition-all text-xs text-gray-900 resize-none"
                            value={motivo}
                            onChange={e => setMotivo(e.target.value)}
                            placeholder="Ej. Competencia local bajó precios, o costos de envío local altos..."
                        />
                    </div>

                    {reqMut.isError && (
                        <div className="p-2 bg-red-50 text-red-700 text-[10px] rounded-lg border border-red-200 font-bold">
                            Error al enviar la solicitud.
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={reqMut.isPending || !precioPropuesto || !motivo}
                        className="w-full py-2.5 text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                    >
                        {reqMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        Enviar Solicitud a Matriz
                    </button>
                    <p className="text-[9px] text-gray-400 text-center px-4 leading-tight">
                        Tu solicitud será revisada por el administrador de la matriz (Taboada). Se te notificará el resultado.
                    </p>
                </form>
            </div>
        </div>
    );
}

function AjusteModal({ onClose, sucursalId, productoId, productoNombre, onSuccess }: any) {
    const [tipo, setTipo] = useState<'ENTRADA' | 'SALIDA' | 'AJUSTE'>('ENTRADA');
    const [cantidad, setCantidad] = useState<number | ''>('');
    const [notas, setNotas] = useState('');

    const adjMut = useMutation({
        mutationFn: (data: AjusteInventario) => ajustarInventario(sucursalId, data),
        onSuccess: onSuccess,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!cantidad || cantidad <= 0) return;
        adjMut.mutate({
            producto_id: productoId,
            tipo,
            cantidad: Number(cantidad),
            notas,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-white">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">Ajustar Inventario</h3>
                        <p className="text-[10px] text-gray-500">{productoNombre}</p>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Tipo de Movimiento</label>
                        <div className="grid grid-cols-3 gap-1.5">
                            <button type="button" onClick={() => setTipo('ENTRADA')} className={`py-1.5 px-1 text-[10px] font-bold rounded-lg border transition-all ${tipo === 'ENTRADA' ? 'bg-green-50 text-green-700 border-green-200 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                                ENTRADA
                            </button>
                            <button type="button" onClick={() => setTipo('SALIDA')} className={`py-1.5 px-1 text-[10px] font-bold rounded-lg border transition-all ${tipo === 'SALIDA' ? 'bg-red-50 text-red-700 border-red-200 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                                SALIDA
                            </button>
                            <button type="button" onClick={() => setTipo('AJUSTE')} className={`py-1.5 px-1 text-[10px] font-bold rounded-lg border transition-all ${tipo === 'AJUSTE' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                                CONTEO ABSOLUTO
                            </button>
                        </div>
                        <p className="text-[9px] text-gray-400 mt-1.5 text-center leading-tight">
                            {tipo === 'ENTRADA' && "Suma la cantidad al stock actual."}
                            {tipo === 'SALIDA' && "Resta la cantidad al stock actual."}
                            {tipo === 'AJUSTE' && "Reemplaza el stock actual con la cantidad ingresada."}
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Cantidad (Valor Absoluto) *</label>
                        <input
                            type="number" min="1" required
                            className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-lg px-2.5 py-1.5 outline-none transition-all text-xs text-center font-bold font-mono text-gray-900"
                            value={cantidad}
                            onChange={e => setCantidad(Number(e.target.value))}
                            placeholder="Ej. 10"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Motivo / Justificación *</label>
                        <textarea
                            required rows={2}
                            className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-lg px-2.5 py-1.5 outline-none transition-all text-xs text-gray-900 resize-none"
                            value={notas}
                            onChange={e => setNotas(e.target.value)}
                            placeholder={tipo === 'SALIDA' ? 'Ej. Producto dañado o vencido...' : 'Ej. Llegó pedido...'}
                        />
                    </div>

                    {adjMut.isError && (
                        <div className="p-2 bg-red-50 text-red-700 text-[10px] rounded-lg border border-red-200 font-bold">
                            Hubo un error al procesar el ajuste.
                        </div>
                    )}

                    <button type="submit" disabled={adjMut.isPending || !cantidad} className="w-full py-2 text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 font-bold rounded-lg text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 mt-1">
                        {adjMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Confirmar Movimiento
                    </button>
                </form>
            </div>
        </div>
    );
}

function ImportInventoryModal({ onClose, sucursalId }: { onClose: () => void, sucursalId: string }) {
    const queryClient = useQueryClient();
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const onDrop = async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setIsUploading(true);
        setError(null);
        try {
            const data = await importInventoryBranchExcel(sucursalId, file);
            setResult(data);
            queryClient.invalidateQueries({ queryKey: ['inventario', sucursalId] });
            queryClient.invalidateQueries({ queryKey: ['movimientos', sucursalId] });
        } catch (err: any) {
            setError(err.message || 'Error al procesar el conteo físico');
        } finally {
            setIsUploading(false);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        maxFiles: 1,
        disabled: isUploading || !!result
    });

    const handleDownloadTemplate = async () => {
        try {
            await exportInventoryTemplate(sucursalId);
        } catch (err) {
            alert("Error descargando plantilla de inventario");
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Warehouse size={18} className="text-emerald-600" />
                            Importar Conteo de Inventario
                        </h3>
                    </div>
                    <button onClick={onClose} disabled={isUploading} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {!result ? (
                        <div className="space-y-6">
                            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                                <h4 className="font-semibold text-emerald-900 mb-2 text-sm flex items-center gap-1.5">
                                    <FileSpreadsheet size={16} /> Instrucciones de Conteo
                                </h4>
                                <ol className="list-decimal list-inside text-[11px] text-emerald-800 space-y-1.5">
                                    <li>Descarga la plantilla o usa el archivo maestro proporcionado por la Central (ej. <b>test1.xlsx</b>).</li>
                                    <li>Ubica la columna que lleva el nombre de tu sucursal (ej. <b>INVENTARIO FISICO LA PAZ</b>).</li>
                                    <li>Asegúrate de llenar sólo las celdas de tu columna y vuelve a subir el archivo.</li>
                                </ol>
                                <button onClick={handleDownloadTemplate} className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm">
                                    <Download size={14} />
                                    Descargar Plantilla Actual
                                </button>
                            </div>

                            <div 
                                {...getRootProps()} 
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[140px]
                                    ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/30'}
                                    ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                <input {...getInputProps()} />
                                {isUploading ? (
                                    <div className="flex flex-col items-center text-indigo-600">
                                        <Loader2 size={24} className="animate-spin mb-2" />
                                        <p className="font-medium text-xs">Ajustando inventario y generando Kárdex...</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-10 h-10 bg-indigo-100/50 text-indigo-500 rounded-lg flex items-center justify-center mb-3">
                                            <Upload size={20} />
                                        </div>
                                        <p className="font-semibold text-gray-700 mb-1 text-sm">Arrastra tu archivo aquí</p>
                                        <p className="text-xs text-gray-400">Sólo formatos .xlsx o .xls</p>
                                    </>
                                )}
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-bold flex items-start gap-1.5">
                                    <X size={14} className="shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
                                <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-3 text-sm">
                                    <Check size={16} className="text-indigo-600" />
                                    Importación Finalizada
                                </h4>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className="bg-white p-2.5 rounded-lg shadow-sm border border-indigo-50">
                                        <div className="text-xl font-black text-gray-800">{result.resumen.procesados}</div>
                                        <div className="text-[9px] text-gray-500 font-bold uppercase mt-1 tracking-wider">Productos Leídos</div>
                                    </div>
                                    <div className="bg-white p-2.5 rounded-lg shadow-sm border border-indigo-50">
                                        <div className="text-xl font-black text-emerald-600">{result.resumen.actualizados}</div>
                                        <div className="text-[9px] text-emerald-600/80 font-bold uppercase mt-1 tracking-wider">Ajustes Realizados</div>
                                    </div>
                                    <div className="bg-white p-2.5 rounded-lg shadow-sm border border-indigo-50">
                                        <div className="text-xl font-black text-red-500">{result.resumen.fallidos}</div>
                                        <div className="text-[9px] text-red-500/80 font-bold uppercase mt-1 tracking-wider">Errores Listados</div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-indigo-600/70 mt-3 font-medium">Nota: Si la diferencia con el sistema era 0, esos productos no sufrieron ajustes ni se listaron como errores.</p>
                            </div>

                            {result.errores && result.errores.length > 0 && (
                                <div className="animate-in fade-in duration-500">
                                    <h5 className="font-bold text-gray-900 mb-2 text-xs flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                        Detalle de Filas Omitidas ({result.errores.length})
                                    </h5>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="max-h-[200px] overflow-y-auto bg-white">
                                            <table className="w-full text-left text-[10px]">
                                                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                                                    <tr>
                                                        <th className="px-3 py-1.5 font-bold text-gray-600 w-16 text-center">Fila n°</th>
                                                        <th className="px-3 py-1.5 font-bold text-gray-600">Motivo Detectado</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {result.errores.map((err: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-red-50/20">
                                                            <td className="px-3 py-2 text-center font-mono text-gray-500 font-bold">{err.fila}</td>
                                                            <td className="px-3 py-2 text-red-600 font-semibold">{err.motivo}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <button onClick={onClose} className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-lg text-xs transition-colors shadow-sm active:scale-95">
                                    Aceptar y Cerrar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
