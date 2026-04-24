import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSalesByHour, getSucursales } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { Loader2, AlertTriangle, Calendar, Clock, BarChart3, TrendingUp } from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Cell, LabelList
} from 'recharts';

const formatBs = (num?: number) => `Bs. ${(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function HourlySalesView() {
    const { role, sucursal_id } = useAuthStore();
    
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
    const [date, setDate] = useState<string>(today);
    
    // Only Matriz/Superadmin can filter by all branches
    const esMatriz = ['SUPERADMIN', 'ADMIN', 'ADMIN_MATRIZ'].includes(role || '');
    const defaultSucursal = esMatriz ? 'all' : (sucursal_id || 'CENTRAL');
    const [selectedSucursal, setSelectedSucursal] = useState<string>(defaultSucursal);

    const { data: sucursales = [] } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales,
        enabled: esMatriz
    });

    const { data, isLoading, isError } = useQuery({
        queryKey: ['sales-by-hour', date, selectedSucursal],
        queryFn: () => getSalesByHour(date, selectedSucursal === 'all' ? undefined : selectedSucursal),
    });

    const totalVentas = useMemo(() => {
        if (!data) return 0;
        return data.reduce((acc, curr) => acc + curr.total_ventas, 0);
    }, [data]);

    const picoHora = useMemo(() => {
        if (!data || data.length === 0) return null;
        let max = data[0];
        for (const h of data) {
            if (h.total_ventas > max.total_ventas) max = h;
        }
        return max;
    }, [data]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-xl">
                    <p className="text-gray-900 font-bold mb-1 text-sm flex items-center gap-2">
                        <Clock size={14} className="text-indigo-500" /> {label}
                    </p>
                    <p className="text-indigo-700 font-bold font-mono">
                        {formatBs(payload[0].value)}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                        {payload[0].payload.cantidad_ventas} transacciones
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Filters */}
            <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="date" 
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            max={today}
                            className="w-full md:w-auto pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all cursor-pointer"
                        />
                    </div>
                    
                    {esMatriz && (
                        <select
                            value={selectedSucursal}
                            onChange={(e) => setSelectedSucursal(e.target.value)}
                            className="flex-1 md:w-48 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all cursor-pointer"
                        >
                            <option value="all">Todas las Sucursales</option>
                            <option value="CENTRAL">Central</option>
                            {sucursales.filter(s => s.is_active).map(s => (
                                <option key={s._id} value={s._id}>{s.nombre}</option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                    <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 flex items-center gap-3">
                        <BarChart3 size={20} className="text-indigo-500" />
                        <div>
                            <p className="text-[10px] uppercase font-bold text-indigo-400 leading-none mb-1">Total del Día</p>
                            <p className="text-sm font-black text-indigo-900 leading-none">{formatBs(totalVentas)}</p>
                        </div>
                    </div>
                    {picoHora && picoHora.total_ventas > 0 && (
                        <div className="bg-amber-50 px-4 py-2 rounded-xl border border-amber-100 flex items-center gap-3">
                            <TrendingUp size={20} className="text-amber-500" />
                            <div>
                                <p className="text-[10px] uppercase font-bold text-amber-500 leading-none mb-1">Hora Pico</p>
                                <p className="text-sm font-black text-amber-900 leading-none">{picoHora.hour}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Chart Area */}
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Clock size={18} className="text-indigo-500" /> 
                    Flujo de Ventas por Hora
                </h3>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-80">
                        <Loader2 size={40} className="animate-spin text-indigo-400 mb-4" />
                        <p className="text-sm text-gray-400 font-medium">Cargando flujos...</p>
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center h-80 text-red-500 bg-red-50 rounded-2xl">
                        <AlertTriangle size={40} className="mb-2" />
                        <p className="font-bold">Error al cargar datos</p>
                    </div>
                ) : !data || totalVentas === 0 ? (
                    <div className="flex flex-col items-center justify-center h-80 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <BarChart3 size={40} className="text-gray-300 mb-3" />
                        <p className="font-bold text-gray-500">Sin ventas en este día</p>
                    </div>
                ) : (
                    <div className="h-96 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis 
                                    dataKey="hour" 
                                    tick={{fontSize: 12, fill: '#6b7280', fontWeight: 'bold'}} 
                                    axisLine={false} 
                                    tickLine={false}
                                />
                                <YAxis 
                                    hide 
                                />
                                <Tooltip cursor={{fill: '#f8fafc'}} content={<CustomTooltip />} />
                                <Bar 
                                    dataKey="total_ventas" 
                                    radius={[6, 6, 6, 6]} 
                                    maxBarSize={40}
                                >
                                    {data.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.total_ventas === picoHora?.total_ventas && entry.total_ventas > 0 ? '#f59e0b' : '#818cf8'} 
                                            className="transition-all duration-300 hover:opacity-80"
                                        />
                                    ))}
                                    <LabelList 
                                        dataKey="total_ventas" 
                                        position="top" 
                                        formatter={(val: any) => Number(val) > 0 ? `Bs. ${Number(val).toLocaleString('en-US', {maximumFractionDigits:0})}` : ''}
                                        style={{ fontSize: '10px', fill: '#6b7280', fontWeight: 'bold' }}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
