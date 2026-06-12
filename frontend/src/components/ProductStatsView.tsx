import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProductStatsReport, getProducts, getSucursales } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

import { 
    Loader2, AlertTriangle, Search, X,
    BarChart3, CheckCircle2, TrendingUp
} from 'lucide-react';
import { 
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, 
    Tooltip, Legend 
} from 'recharts';
import { format, subDays } from 'date-fns';

interface SelectedProduct {
    id: string;
    nombre: string;
    color: string;
}

// A simple color palette for our lines
const CHART_COLORS = [
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ef4444', // Red
    '#0ea5e9', // Sky
];

export default function ProductStatsView() {
    const { role } = useAuthStore();
    const esMatriz = ['SUPERADMIN', 'ADMIN', 'ADMIN_MATRIZ'].includes(role || '');

    const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
    
    // Controles de tiempo
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [intervalo, setIntervalo] = useState<'dia' | 'semana' | 'mes'>('dia');
    const [metric, setMetric] = useState<'cantidad' | 'ingreso_bruto'>('cantidad');
    const [selectedSucursal, setSelectedSucursal] = useState<string>('all');

    // Búsqueda de productos
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: sucursales = [] } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales,
        enabled: esMatriz,
    });

    const { data: searchResults, isLoading: isSearching } = useQuery({
        queryKey: ['products-search-stats', debouncedSearch],
        queryFn: () => getProducts(1, 10, debouncedSearch),
        enabled: debouncedSearch.length > 1
    });

    const addProduct = (prod: any) => {
        if (selectedProducts.find(p => p.id === prod._id)) {
            setSearchTerm('');
            setIsDropdownOpen(false);
            return;
        }
        if (selectedProducts.length >= 7) {
            toast.warning("Puedes comparar hasta 7 productos a la vez.");
            return;
        }
        
        const newColor = CHART_COLORS[selectedProducts.length % CHART_COLORS.length];
        setSelectedProducts([...selectedProducts, { id: prod._id, nombre: prod.descripcion, color: newColor }]);
        setSearchTerm('');
        setIsDropdownOpen(false);
    };

    const removeProduct = (id: string) => {
        setSelectedProducts(selectedProducts.filter(p => p.id !== id));
    };

    // Consulta de estadísticas
    const { data: rawStats = [], isLoading: isLoadingStats } = useQuery({
        queryKey: ['product-stats', selectedProducts.map(p=>p.id), startDate, endDate, intervalo, selectedSucursal],
        queryFn: () => getProductStatsReport({
            producto_ids: selectedProducts.map(p => p.id),
            start_date: startDate,
            end_date: endDate,
            intervalo,
            sucursal_id: selectedSucursal
        }),
        enabled: selectedProducts.length > 0
    });

    // Pivoteo de datos para Recharts
    const chartData = useMemo(() => {
        if (!rawStats || rawStats.length === 0) return [];

        // Agrupar por fecha
        const dateMap: Record<string, any> = {};
        rawStats.forEach((row: any) => {
            if (!dateMap[row.fecha]) {
                dateMap[row.fecha] = { fecha: row.fecha };
            }
            // Agregamos el valor de la métrica como una columna con el ID del producto
            dateMap[row.fecha][row.producto_id] = row[metric];
        });

        // Convertir a array y ordenar
        return Object.values(dateMap).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
    }, [rawStats, metric]);

    // Resumen de Totales
    const productTotals = useMemo(() => {
        const totals: Record<string, { cantidad: number, ingreso: number }> = {};
        selectedProducts.forEach(p => totals[p.id] = { cantidad: 0, ingreso: 0 });

        rawStats.forEach((row: any) => {
            if (totals[row.producto_id]) {
                totals[row.producto_id].cantidad += row.cantidad;
                totals[row.producto_id].ingreso += row.ingreso_bruto;
            }
        });
        return totals;
    }, [rawStats, selectedProducts]);


    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Controles Principales */}
            <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full relative">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Buscar y Comparar Productos</label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Escribe el nombre del producto..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setIsDropdownOpen(true);
                            }}
                            onFocus={() => setIsDropdownOpen(true)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-xl outline-none transition-all text-sm font-medium"
                        />
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        {isSearching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" size={16} />}
                    </div>

                    {isDropdownOpen && debouncedSearch.length > 1 && (
                        <div className="absolute top-full mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                            {searchResults?.items?.length === 0 ? (
                                <div className="p-4 text-center text-sm text-gray-500">No se encontraron productos.</div>
                            ) : (
                                <ul className="divide-y divide-gray-50">
                                    {searchResults?.items?.map((prod: any) => (
                                        <li 
                                            key={prod._id}
                                            onClick={() => addProduct(prod)}
                                            className="p-3 hover:bg-indigo-50 cursor-pointer flex items-center justify-between group"
                                        >
                                            <span className="text-sm font-medium text-gray-900 group-hover:text-indigo-700">{prod.descripcion}</span>
                                            {selectedProducts.find(p => p.id === prod._id) && <CheckCircle2 size={16} className="text-emerald-500" />}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                <div className="w-full md:w-auto flex gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Desde</label>
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Hasta</label>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Píldoras de Productos Seleccionados */}
            {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selectedProducts.map(p => (
                        <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm" style={{ borderLeftColor: p.color, borderLeftWidth: '4px' }}>
                            <span className="text-sm font-bold text-gray-700">{p.nombre}</span>
                            <button onClick={() => removeProduct(p.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Gráfico y Resultados */}
            {selectedProducts.length === 0 ? (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-16 text-center flex flex-col items-center">
                    <BarChart3 size={48} className="text-gray-300 mb-4" />
                    <h3 className="text-lg font-bold text-gray-500">Agrega productos para comparar</h3>
                    <p className="text-sm text-gray-400 mt-2 max-w-sm">Usa el buscador de arriba para seleccionar uno o varios productos y ver su evolución de ventas en el tiempo.</p>
                </div>
            ) : (
                <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col gap-6">
                    {/* Controles Internos del Gráfico */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-100 pb-6">
                        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl">
                            <button onClick={() => setMetric('cantidad')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${metric === 'cantidad' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Unidades Vendidas</button>
                            <button onClick={() => setMetric('ingreso_bruto')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${metric === 'ingreso_bruto' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Ingreso Bruto (Bs.)</button>
                        </div>

                        <div className="flex items-center gap-4">
                            {esMatriz && (
                                <select 
                                    value={selectedSucursal}
                                    onChange={e => setSelectedSucursal(e.target.value)}
                                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 outline-none"
                                >
                                    <option value="all">Todas las Sucursales</option>
                                    <option value="CENTRAL">Almacén Central (Matriz)</option>
                                    {sucursales.map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                                </select>
                            )}

                            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl">
                                {['dia', 'semana', 'mes'].map(int => (
                                    <button 
                                        key={int}
                                        onClick={() => setIntervalo(int as any)}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${intervalo === int ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        {int}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Gráfico */}
                    <div className="h-[400px] w-full">
                        {isLoadingStats ? (
                            <div className="h-full w-full flex flex-col items-center justify-center text-indigo-500">
                                <Loader2 size={32} className="animate-spin mb-4" />
                                <span className="font-medium">Calculando métricas...</span>
                            </div>
                        ) : chartData.length === 0 ? (
                            <div className="h-full w-full flex flex-col items-center justify-center text-gray-400">
                                <AlertTriangle size={32} className="mb-4 opacity-50" />
                                <span className="font-medium text-sm">No se registraron ventas en el periodo seleccionado para estos productos.</span>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis 
                                        dataKey="fecha" 
                                        tick={{fontSize: 12, fill: '#9ca3af', fontWeight: 'bold'}} 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tickMargin={10}
                                    />
                                    <YAxis 
                                        tickFormatter={(val) => metric === 'cantidad' ? `${val} u.` : `Bs. ${val}`} 
                                        tick={{fontSize: 12, fill: '#9ca3af'}} 
                                        axisLine={false} 
                                        tickLine={false} 
                                    />
                                    <Tooltip 
                                        contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                                        formatter={(value: any, name: any) => {
                                            const prodName = selectedProducts.find(p => p.id === name)?.nombre || name;
                                            return [metric === 'cantidad' ? `${value} unidades` : `Bs. ${Number(value).toFixed(2)}`, prodName];
                                        }}
                                        labelStyle={{color: '#374151', fontWeight: 'bold', marginBottom: '8px'}}
                                    />
                                    <Legend 
                                        iconType="circle" 
                                        formatter={(value: string) => {
                                            return <span className="text-xs font-bold text-gray-700 ml-1">{selectedProducts.find(p => p.id === value)?.nombre || value}</span>;
                                        }}
                                    />
                                    {selectedProducts.map((prod) => (
                                        <Line 
                                            key={prod.id}
                                            type="monotone" 
                                            dataKey={prod.id} 
                                            name={prod.id}
                                            stroke={prod.color} 
                                            strokeWidth={3} 
                                            dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                            connectNulls
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Tabla Resumen */}
                    {!isLoadingStats && chartData.length > 0 && (
                        <div className="mt-4 pt-6 border-t border-gray-100">
                            <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <TrendingUp size={16} className="text-indigo-500" /> Totales en el periodo seleccionado
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {selectedProducts.map(prod => {
                                    const t = productTotals[prod.id] || { cantidad: 0, ingreso: 0 };
                                    return (
                                        <div key={prod.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 flex flex-col gap-1 relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: prod.color }}></div>
                                            <p className="text-xs font-bold text-gray-500 truncate" title={prod.nombre}>{prod.nombre}</p>
                                            <div className="flex items-end justify-between mt-2">
                                                <div>
                                                    <p className="text-[10px] uppercase text-gray-400 font-bold">Unidades</p>
                                                    <p className="text-lg font-black text-gray-900">{t.cantidad.toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase text-gray-400 font-bold">Bruto</p>
                                                    <p className="text-lg font-black text-indigo-700">Bs. {t.ingreso.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
