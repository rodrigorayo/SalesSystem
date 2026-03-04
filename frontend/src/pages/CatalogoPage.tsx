import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Loader2, Package, Image as ImageIcon, Check, X, Tag, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { getProducts, getCategories, createProduct, updateProduct, exportProductTemplate, importProductsExcel, importGlobalExcel } from '../api/api';
import { useDropzone } from 'react-dropzone';
import { useAuthStore } from '../store/authStore';
import type { Product, Category, ProductCreate } from '../api/types';

export default function CatalogoPage() {
    const { user } = useAuthStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isImportGlobalModalOpen, setIsImportGlobalModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const { data: products = [], isLoading: loadingProducts } = useQuery({
        queryKey: ['products'],
        queryFn: getProducts
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: getCategories
    });

    const isEditor = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN_MATRIZ' || user?.role === 'ADMIN';

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.codigo_corto && p.codigo_corto.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCat = selectedCategory === 'ALL' || p.categoria_id === selectedCategory;
            return matchesSearch && matchesCat;
        });
    }, [products, searchTerm, selectedCategory]);

    const handleOpenCreate = () => {
        setEditingProduct(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (product: Product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    return (
        <div className="max-w-7xl mx-auto p-4 space-y-4">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Catálogo Maestro</h1>
                    <p className="text-sm text-gray-500 mt-1">Gestión centralizada de productos e información base.</p>
                </div>
                {isEditor && (
                    <div className="flex gap-2">
                        <button onClick={() => setIsImportGlobalModalOpen(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-transparent px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all transform hover:scale-105">
                            <Package size={18} />
                            <span className="hidden sm:inline">Importación Global Excel</span>
                        </button>
                        <button onClick={() => setIsImportModalOpen(true)} className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-colors">
                            <FileSpreadsheet size={18} className="text-emerald-600" />
                            <span className="hidden sm:inline">Importar Básica</span>
                        </button>
                        <button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-colors">
                            <Plus size={18} />
                            <span className="hidden sm:inline">Nuevo Producto</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o código..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl outline-none transition-all text-sm text-gray-900"
                    />
                </div>
                <div className="sm:w-64">
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl outline-none transition-all text-sm appearance-none"
                    >
                        <option value="ALL">Todas las Categorías</option>
                        {categories.map(cat => (
                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-xs tracking-wider border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">Producto</th>
                                <th className="px-6 py-4">Categoría</th>
                                <th className="px-6 py-4 text-right">Público (Bs)</th>
                                {isEditor && <th className="px-6 py-4 text-right">Costo (Bs)</th>}
                                <th className="px-6 py-4 text-center">Estado</th>
                                {isEditor && <th className="px-6 py-4 text-right">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loadingProducts ? (
                                <tr>
                                    <td colSpan={isEditor ? 6 : 4} className="px-6 py-12 text-center text-gray-400">
                                        <Loader2 size={32} className="mx-auto animate-spin mb-3 text-indigo-400" />
                                        <p>Cargando catálogo...</p>
                                    </td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={isEditor ? 6 : 4} className="px-6 py-12 text-center text-gray-400">
                                        <Package size={48} className="mx-auto mb-4 opacity-20 text-indigo-500" />
                                        <p className="text-base text-gray-800 font-medium">No se encontraron productos</p>
                                        <p className="text-sm mt-1">Ajusta los filtros o intenta otra búsqueda.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((p) => (
                                    <tr key={p._id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {p.image_url ? (
                                                    <img src={p.image_url} alt={p.descripcion} className="w-10 h-10 rounded-lg object-cover border border-gray-100 shadow-sm bg-white" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-300">
                                                        <ImageIcon size={20} />
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-medium text-gray-900">{p.descripcion}</div>
                                                    <div className="text-xs text-indigo-400 mt-0.5 font-mono">{p.codigo_corto || 'SIN SKU'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 text-gray-600 text-xs font-medium border border-gray-200">
                                                <Tag size={12} className="text-gray-400" />
                                                {p.categoria_nombre || p.categoria_id || 'General'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-semibold text-gray-900">
                                            {(p.precio_venta || 0).toFixed(2)}
                                        </td>
                                        {isEditor && (
                                            <td className="px-6 py-4 text-right text-gray-500">
                                                {(p.costo_producto || 0).toFixed(2)}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${p.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {p.is_active !== false ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        {isEditor && (
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleOpenEdit(p)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                    <Edit2 size={18} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {isModalOpen && (
                <ProductModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    product={editingProduct}
                    categories={categories}
                />
            )}
            
            {isImportModalOpen && (
                <ImportModal onClose={() => setIsImportModalOpen(false)} />
            )}
            
            {isImportGlobalModalOpen && (
                <ImportGlobalModal onClose={() => setIsImportGlobalModalOpen(false)} />
            )}
        </div>
    );
}

function ImportModal({ onClose }: { onClose: () => void }) {
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
            const data = await importProductsExcel(file);
            setResult(data);
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['tenant_stats'] });
        } catch (err: any) {
            setError(err.message || 'Error al procesar el archivo');
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
            await exportProductTemplate();
        } catch (err) {
            alert("Error descargando plantilla");
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <FileSpreadsheet size={20} className="text-emerald-600" />
                        Importación Masiva
                    </h3>
                    <button onClick={onClose} disabled={isUploading} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {!result ? (
                        <div className="space-y-6">
                            <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                                <h4 className="font-semibold text-blue-900 mb-2">Instrucciones</h4>
                                <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1.5 ml-1">
                                    <li>Descarga la plantilla dinámica. Contiene tus categorías pre-cargadas para guiarte.</li>
                                    <li>Llena tus productos sin modificar el nombre de las columnas.</li>
                                    <li>Las columnas con asterisco (*) son obligatorias en tu mente (código y nombre mínimo).</li>
                                    <li>Sube el archivo aquí. El sistema detectará si hay que crear o actualizar según el <b>código_corto</b>.</li>
                                </ol>
                                <button onClick={handleDownloadTemplate} className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
                                    <Download size={16} />
                                    Descargar Plantilla
                                </button>
                            </div>

                            <div 
                                {...getRootProps()} 
                                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[160px]
                                    ${isDragActive ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'}
                                    ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                <input {...getInputProps()} />
                                {isUploading ? (
                                    <div className="flex flex-col items-center text-emerald-600">
                                        <Loader2 size={32} className="animate-spin mb-3" />
                                        <p className="font-medium">Procesando y validando productos...</p>
                                        <p className="text-xs text-emerald-600/70 mt-1">Dependiendo del tamaño, esto puede tardar unos segundos.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-3 text-emerald-600">
                                            <Upload size={24} />
                                        </div>
                                        <p className="font-semibold text-gray-700 mb-1">Haz clic o arrastra tu archivo Excel aquí</p>
                                        <p className="text-sm text-gray-500">Formato .xlsx o .xls, máximo 5MB</p>
                                    </>
                                )}
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 font-medium flex items-start gap-2">
                                    <X size={18} className="shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl">
                                <h4 className="font-bold text-emerald-900 flex items-center gap-2 mb-3">
                                    <Check size={20} className="text-emerald-600" />
                                    Proceso Completado
                                </h4>
                                <div className="grid grid-cols-4 gap-4 text-center">
                                    <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                                        <div className="text-2xl font-black text-gray-900">{result.resumen.procesados}</div>
                                        <div className="text-xs text-gray-500 font-medium uppercase mt-1">Procesados</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                                        <div className="text-2xl font-black text-emerald-600">{result.resumen.insertados}</div>
                                        <div className="text-xs text-emerald-600/70 font-medium uppercase mt-1">Nuevos</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                                        <div className="text-2xl font-black text-blue-600">{result.resumen.actualizados}</div>
                                        <div className="text-xs text-blue-600/70 font-medium uppercase mt-1">Actualizados</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                                        <div className="text-2xl font-black text-red-600">{result.resumen.fallidos}</div>
                                        <div className="text-xs text-red-600/70 font-medium uppercase mt-1">Omitidos</div>
                                    </div>
                                </div>
                            </div>

                            {result.errores && result.errores.length > 0 && (
                                <div>
                                    <h5 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                        Detalle de Errores ({result.errores.length})
                                    </h5>
                                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="max-h-[300px] overflow-y-auto bg-white">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-2 font-semibold text-gray-600 w-20 text-center">Fila Excel</th>
                                                        <th className="px-4 py-2 font-semibold text-gray-600">Motivo del Error</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {result.errores.map((err: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-red-50/30">
                                                            <td className="px-4 py-3 text-center font-mono text-gray-500">{err.fila}</td>
                                                            <td className="px-4 py-3 text-red-600 font-medium">{err.motivo}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Corrija únicamente estas filas en su archivo original y vuelva a subirlas.</p>
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <button onClick={onClose} className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl transition-colors shadow-sm">
                                    Cerrar y Volver
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ProductModal({ onClose, product, categories }: { isOpen: boolean, onClose: () => void, product: Product | null, categories: Category[] }) {
    const isEditing = !!product;
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState<ProductCreate>({
        descripcion: product?.descripcion || '',
        categoria_id: product?.categoria_id || (categories.length > 0 ? categories[0]._id : ''),
        precio_venta: product?.precio_venta || 0,
        costo_producto: product?.costo_producto || 0,
        codigo_corto: product?.codigo_corto || '',
        image_url: product?.image_url || '',
    });

    const createMut = useMutation({
        mutationFn: createProduct,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            onClose();
        }
    });

    const updateMut = useMutation({
        mutationFn: (data: ProductCreate) => updateProduct(product!._id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            onClose();
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEditing) {
            updateMut.mutate(formData);
        } else {
            createMut.mutate(formData);
        }
    };

    const isPending = createMut.isPending || updateMut.isPending;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                    <h3 className="text-lg font-bold text-gray-900">{isEditing ? 'Editar Producto' : 'Crear Nuevo Producto'}</h3>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Descripción / Nombre</label>
                        <input
                            required
                            type="text"
                            className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-2.5 outline-none transition-all text-sm text-gray-900 placeholder-gray-400"
                            value={formData.descripcion}
                            onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                            placeholder="Ej. Coca Cola 2L"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Categoría</label>
                            <select
                                required
                                className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-2.5 outline-none transition-all text-sm text-gray-900"
                                value={formData.categoria_id}
                                onChange={e => setFormData({ ...formData, categoria_id: e.target.value })}
                            >
                                <option value="" disabled>Seleccionar...</option>
                                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">SKU (Opcional)</label>
                            <input
                                type="text"
                                className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-2.5 outline-none transition-all text-sm text-gray-900 placeholder-gray-400 uppercase font-mono"
                                value={formData.codigo_corto}
                                onChange={e => setFormData({ ...formData, codigo_corto: e.target.value })}
                                placeholder="C-COLA-2L"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Costo Base (Bs) (Opcional)</label>
                            <input
                                type="number" step="0.01" min="0" required
                                className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-2.5 outline-none transition-all text-sm text-gray-900"
                                value={formData.costo_producto === 0 ? '' : formData.costo_producto}
                                onChange={e => setFormData({ ...formData, costo_producto: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-indigo-700 mb-1.5">Público Final (Bs)</label>
                            <input
                                type="number" step="0.01" min="0" required
                                className="w-full bg-indigo-50 border border-indigo-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-2.5 outline-none transition-all text-sm font-bold text-indigo-900"
                                value={formData.precio_venta === 0 ? '' : formData.precio_venta}
                                onChange={e => setFormData({ ...formData, precio_venta: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">URL de Imagen (Opcional)</label>
                        <input
                            type="url"
                            className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-2.5 outline-none transition-all text-sm text-gray-900 placeholder-gray-400"
                            value={formData.image_url}
                            onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                            placeholder="https://ejemplo.com/imagen.jpg"
                        />
                    </div>

                    {(createMut.isError || updateMut.isError) && (
                        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 font-medium">
                            Hubo un error al guardar el producto. Verifica los datos o el SKU.
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 mt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 font-semibold rounded-xl text-sm transition-all shadow-sm">
                            Cancelar
                        </button>
                        <button type="submit" disabled={isPending} className="flex-1 py-2.5 text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2">
                            {isPending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                            {isEditing ? 'Guardar Cambios' : 'Crear Producto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ImportGlobalModal({ onClose }: { onClose: () => void }) {
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
            const data = await importGlobalExcel(file);
            setResult(data);
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            queryClient.invalidateQueries({ queryKey: ['inventario'] });
            queryClient.invalidateQueries({ queryKey: ['tenant_stats'] });
        } catch (err: any) {
            setError(err.message || 'Error al procesar el archivo global');
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border-2 border-purple-500/20">
                <div className="px-6 py-4 border-b border-purple-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
                    <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-700 to-indigo-700 flex items-center gap-2">
                        <Package size={20} className="text-purple-600" />
                        Importación Global A-Medida
                    </h3>
                    <button onClick={onClose} disabled={isUploading} className="p-1.5 text-gray-400 hover:text-purple-700 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {!result ? (
                        <div className="space-y-6">
                            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-5 rounded-xl border border-purple-100 shadow-inner">
                                <h4 className="font-bold text-purple-900 mb-3 text-sm flex items-center gap-2">
                                    <FileSpreadsheet size={18} className="text-purple-600" /> 
                                    Formato del Archivo Único
                                </h4>
                                <p className="text-xs text-purple-800 mb-3 leading-relaxed">
                                    Este módulo lee <b>un solo archivo</b> que contiene el catálogo maestro y los stock de todas tus sucursales.
                                </p>
                                <ul className="list-disc list-inside text-xs text-purple-800/90 space-y-1.5 ml-1">
                                    <li>Las categorías que no existan <b>se crearán solas</b>.</li>
                                    <li>Cabeceras obligatorias: <b>CODIGO CORTO</b>, <b>DESCRIPCION</b>, <b>PRECIO PUBLICO</b>, <b>CATEGORIA</b></li>
                                    <li>Para Inyectar inventario, nombra tus cabeceras así: <b>INV_CENTRAL</b>, <b>INV_LAPAZ</b> (el nombre tras "INV_" debe coincidir con el nombre de tu sucursal).</li>
                                </ul>
                            </div>

                            <div 
                                {...getRootProps()} 
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden
                                    ${isDragActive ? 'border-purple-500 bg-purple-50 shadow-inner' : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/30'}
                                    ${isUploading ? 'opacity-80 pointer-events-none' : ''}`}
                            >
                                <input {...getInputProps()} />
                                {isUploading ? (
                                    <div className="flex flex-col items-center text-purple-600 z-10">
                                        <Loader2 size={32} className="animate-spin mb-3" />
                                        <p className="font-bold text-sm">Procesando Ecosistema...</p>
                                        <p className="text-[10px] opacity-70 mt-1">Sincronizando catálogos y calculando kárdex multi-sucursal</p>
                                    </div>
                                ) : (
                                    <div className="z-10 flex flex-col items-center">
                                        <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-600 rounded-full flex items-center justify-center mb-4 shadow-sm border border-purple-200">
                                            <Upload size={24} />
                                        </div>
                                        <p className="font-bold text-gray-800 mb-1">Cargar Sistema Completo</p>
                                        <p className="text-xs text-gray-500 font-medium">Arrastra el mega-excel aquí (.xlsx)</p>
                                    </div>
                                )}
                                {isUploading && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 animate-pulse"></div>
                                )}
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50/80 text-red-700 text-sm rounded-xl border border-red-200 font-bold flex items-start gap-2 shadow-sm">
                                    <X size={18} className="shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 p-5 rounded-2xl shadow-sm">
                                <h4 className="font-black text-emerald-900 flex items-center gap-2 mb-4 text-base">
                                    <Check size={20} className="text-emerald-500 bg-emerald-100 rounded-full p-1" />
                                    Sincronización Terminada
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                    <div className="bg-white p-3 rounded-xl shadow-sm border border-emerald-50/50">
                                        <div className="text-2xl font-black text-gray-800">{result.resumen.filas_leidas}</div>
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mt-1 tracking-wider">Filas Leídas</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl shadow-sm border border-emerald-50/50">
                                        <div className="text-2xl font-black text-purple-600">{result.resumen.productos_catalogo_afectados}</div>
                                        <div className="text-[10px] text-purple-600/80 font-bold uppercase mt-1 tracking-wider">Productos<br/>Catálogo</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl shadow-sm border border-emerald-50/50">
                                        <div className="text-2xl font-black text-emerald-600">{result.resumen.ajustes_inventario_generados}</div>
                                        <div className="text-[10px] text-emerald-600/80 font-bold uppercase mt-1 tracking-wider">Ajustes de<br/>Stock Kárdex</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl shadow-sm border border-emerald-50/50">
                                        <div className="text-2xl font-black text-red-500">{result.errores?.length || 0}</div>
                                        <div className="text-[10px] text-red-500/80 font-bold uppercase mt-1 tracking-wider">Errores<br/>Omitidos</div>
                                    </div>
                                </div>
                                
                                {result.resumen.detalles && result.resumen.detalles.length > 0 && (
                                    <div className="mt-4 p-3 bg-white/60 rounded-lg border border-emerald-200/50 text-[11px] text-emerald-800 font-medium">
                                        {result.resumen.detalles[0]}
                                    </div>
                                )}
                            </div>

                            {result.errores && result.errores.length > 0 && (
                                <div className="animate-in fade-in duration-700">
                                    <h5 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                        Filas con Incidencias ({result.errores.length})
                                    </h5>
                                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="max-h-[220px] overflow-y-auto bg-white hover:bg-gray-50/50 transition-colors">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-gray-100/50 border-b border-gray-200 sticky top-0 backdrop-blur-md">
                                                    <tr>
                                                        <th className="px-4 py-2 font-bold text-gray-700 w-20 text-center">Fila n°</th>
                                                        <th className="px-4 py-2 font-bold text-gray-700">Motivo Reportado</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {result.errores.map((err: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-red-50/50 transition-colors">
                                                            <td className="px-4 py-2.5 text-center font-mono text-gray-600 font-bold bg-gray-50/30">{err.fila}</td>
                                                            <td className="px-4 py-2.5 text-red-600 font-medium">{err.motivo}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <button onClick={onClose} className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2">
                                    <Check size={18} />
                                    Finalizar Módulo
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
