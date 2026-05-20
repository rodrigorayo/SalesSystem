import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getExpensesReport, getCategoriasGasto, getSucursales, createCategoriaGasto, updateCategoriaGasto, deleteCategoriaGasto } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { 
    Calendar, Loader2, ArrowDownCircle, FileDown, 
    Tag, Edit2, Trash2, X, Check, Receipt
} from 'lucide-react';
import { getBoliviaTodayISO } from '../utils/dateUtils';
import { descargarPDFGastos } from '../utils/reportPDF';
import { motion, AnimatePresence } from 'framer-motion';

const formatBs = (num?: number) => `Bs. ${(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ExpensesReportView() {
    const { role, sucursal_id } = useAuthStore();
    
    // Filters
    const today = getBoliviaTodayISO();
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [selectedCategory, setSelectedCategory] = useState('all');
    
    const esMatriz = ['SUPERADMIN', 'ADMIN', 'ADMIN_MATRIZ'].includes(role || '');
    const defaultSucursal = esMatriz ? 'all' : (sucursal_id || 'CENTRAL');
    const [selectedSucursal, setSelectedSucursal] = useState(defaultSucursal);

    // Categories CRUD state
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [newCatName, setNewCatName] = useState('');
    const [newCatDesc, setNewCatDesc] = useState('');

    // Queries
    const { data: sucursales = [] } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales,
        enabled: esMatriz
    });

    const { data: categories = [], refetch: refetchCats } = useQuery({
        queryKey: ['categorias-gasto'],
        queryFn: getCategoriasGasto
    });

    const { data: report, isLoading } = useQuery({
        queryKey: ['expenses-report', startDate, endDate, selectedSucursal, selectedCategory],
        queryFn: () => getExpensesReport(startDate, endDate, selectedSucursal, selectedCategory)
    });

    // Mutations
    const createCatMut = useMutation({
        mutationFn: createCategoriaGasto,
        onSuccess: () => { refetchCats(); setNewCatName(''); setNewCatDesc(''); }
    });
    const updateCatMut = useMutation({
        mutationFn: ({ id, data }: any) => updateCategoriaGasto(id, data),
        onSuccess: () => { refetchCats(); setEditingCategory(null); }
    });
    const deleteCatMut = useMutation({
        mutationFn: deleteCategoriaGasto,
        onSuccess: () => refetchCats()
    });

    const handleDownloadPDF = () => {
        if (!report) return;
        const sucNombre = selectedSucursal === 'all' ? 'Todas las Sucursales' : (sucursales.find(s => s._id === selectedSucursal)?.nombre || selectedSucursal);
        const catNombre = selectedCategory === 'all' ? 'Todas' : (categories.find(c => c._id === selectedCategory)?.nombre || 'Desconocida');
        descargarPDFGastos(report, startDate, endDate, sucNombre, catNombre);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-gray-900">Reporte de Gastos Detallado</h2>
                    <p className="text-xs text-gray-500 font-medium">Análisis de egresos y control de categorías</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setShowCategoryManager(!showCategoryManager)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${showCategoryManager ? 'bg-amber-100 text-amber-700' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                    >
                        <Tag size={16} /> Gestionar Categorías
                    </button>
                    <button 
                        onClick={handleDownloadPDF}
                        disabled={!report || report.count === 0}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200 disabled:opacity-50"
                    >
                        <FileDown size={16} /> Descargar PDF
                    </button>
                </div>
            </div>

            {/* Category Manager (Accordion-like) */}
            <AnimatePresence>
                {showCategoryManager && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-amber-50/50 border-2 border-amber-100 rounded-[24px] p-6 mb-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-black text-amber-900 flex items-center gap-2 uppercase tracking-widest text-xs">
                                    <Tag size={16} /> Administración de Categorías
                                </h3>
                                <button onClick={() => setShowCategoryManager(false)} className="text-amber-400 hover:text-amber-600">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Form to add */}
                                <div className="space-y-4">
                                    <p className="text-xs font-bold text-amber-700 uppercase">Nueva Categoría</p>
                                    <div className="space-y-3">
                                        <input 
                                            type="text" 
                                            placeholder="Nombre (ej. Limpieza)"
                                            value={newCatName}
                                            onChange={e => setNewCatName(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                        />
                                        <input 
                                            type="text" 
                                            placeholder="Descripción corta"
                                            value={newCatDesc}
                                            onChange={e => setNewCatDesc(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                        />
                                        <button 
                                            onClick={() => createCatMut.mutate({ nombre: newCatName, descripcion: newCatDesc })}
                                            disabled={!newCatName || createCatMut.isPending}
                                            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                                        >
                                            {createCatMut.isPending ? 'Agregando...' : 'Agregar Categoría'}
                                        </button>
                                    </div>
                                </div>

                                {/* List of categories */}
                                <div className="lg:col-span-2">
                                    <p className="text-xs font-bold text-amber-700 uppercase mb-4">Categorías Existentes</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                                        {categories.map((cat: any) => (
                                            <div key={cat._id} className="bg-white p-3 rounded-xl border border-amber-100 flex items-center justify-between group hover:shadow-sm transition-all">
                                                {editingCategory?._id === cat._id ? (
                                                    <div className="flex-1 flex gap-2">
                                                        <input 
                                                            autoFocus
                                                            className="flex-1 text-xs font-bold px-2 py-1 bg-amber-50 border border-amber-200 rounded text-amber-950"
                                                            value={editingCategory.nombre}
                                                            onChange={e => setEditingCategory({...editingCategory, nombre: e.target.value})}
                                                        />
                                                        <button onClick={() => updateCatMut.mutate({ id: cat._id, data: { nombre: editingCategory.nombre, descripcion: editingCategory.descripcion } })} className="text-green-600 p-1"><Check size={16}/></button>
                                                        <button onClick={() => setEditingCategory(null)} className="text-red-400 p-1"><X size={16}/></button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                                                <Receipt size={14} />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-800">{cat.nombre}</p>
                                                                {cat.descripcion && <p className="text-[10px] text-gray-400">{cat.descripcion}</p>}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => setEditingCategory(cat)} className="p-1.5 text-gray-400 hover:text-indigo-600"><Edit2 size={14}/></button>
                                                            <button onClick={() => { if(confirm('¿Eliminar esta categoría?')) deleteCatMut.mutate(cat._id); }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14}/></button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Filters Bar */}
            <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                    <span className="text-gray-400 font-bold">al</span>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                </div>

                <div className="h-6 w-px bg-gray-100 mx-2 hidden md:block" />

                {esMatriz && (
                    <select
                        value={selectedSucursal}
                        onChange={(e) => setSelectedSucursal(e.target.value)}
                        className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                        <option value="all">Todas las Sucursales</option>
                        <option value="CENTRAL">Central</option>
                        {sucursales.filter(s => s.is_active).map(s => (
                            <option key={s._id} value={s._id}>{s.nombre}</option>
                        ))}
                    </select>
                )}

                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                    <option value="all">Todas las Categorías</option>
                    {categories.map((c: any) => (
                        <option key={c._id} value={c._id}>{c.nombre}</option>
                    ))}
                </select>

                <div className="ml-auto flex items-center gap-3">
                    <div className="bg-red-50 px-4 py-2 rounded-xl border border-red-100 flex items-center gap-3">
                        <ArrowDownCircle size={20} className="text-red-500" />
                        <div>
                            <p className="text-[10px] uppercase font-bold text-red-400 leading-none mb-1">Total Gastos</p>
                            <p className="text-sm font-black text-red-900 leading-none">{formatBs(report?.total)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[32px] border border-gray-100 shadow-sm">
                    <Loader2 size={40} className="animate-spin text-indigo-500 mb-4" />
                    <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Compilando gastos...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Table */}
                    <div className="lg:col-span-2 bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <Receipt size={18} className="text-indigo-500" /> Detalle de Movimientos
                            </h3>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{report?.count} REGISTROS</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Fecha/Hora</th>
                                        <th className="px-6 py-4">Categoría</th>
                                        <th className="px-6 py-4">Descripción</th>
                                        <th className="px-6 py-4 text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {report?.detalle?.map((g: any) => (
                                        <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-bold text-gray-800">{g.fecha.split('T')[0]}</div>
                                                <div className="text-[10px] text-gray-400 font-mono">{g.hora}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold uppercase">{g.categoria}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-gray-700 font-medium line-clamp-1">{g.descripcion}</div>
                                                <div className="text-[10px] text-gray-400">Cajero: {g.cajero}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-red-600">{formatBs(g.monto)}</td>
                                        </tr>
                                    ))}
                                    {(!report?.detalle || report.detalle.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-20 text-center text-gray-400 font-medium italic">No se encontraron gastos con estos filtros.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right: Summary by category */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 uppercase tracking-widest text-[10px] text-gray-400">
                                Gastos por Categoría
                            </h3>
                            <div className="space-y-4">
                                {Object.entries(report?.por_categoria || {}).sort((a:any, b:any) => b[1] - a[1]).map(([cat, monto]) => (
                                    <div key={cat} className="space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-gray-700">{cat}</span>
                                            <span className="font-black text-gray-900">{formatBs(monto as number)}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-red-500 rounded-full" 
                                                style={{ width: `${((monto as number) / (report?.total || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {Object.keys(report?.por_categoria || {}).length === 0 && (
                                    <p className="text-center text-xs text-gray-400 py-10 italic">Sin datos de categorías</p>
                                )}
                            </div>
                        </div>

                        {/* Audit Note */}
                        <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-[24px]">
                            <p className="text-[10px] font-bold text-indigo-400 uppercase mb-2 tracking-widest">Nota de Auditoría</p>
                            <p className="text-[11px] text-indigo-700 font-medium leading-relaxed">
                                Los gastos mostrados en este reporte son registrados manualmente por los cajeros durante sus sesiones. 
                                La suma de estos egresos debe coincidir con los recibos físicos presentados al cierre de caja.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
