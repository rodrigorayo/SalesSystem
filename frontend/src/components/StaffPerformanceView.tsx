import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStaffPerformanceReport, getSucursales } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { Loader2, AlertTriangle, Calendar, Users, Briefcase } from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Cell
} from 'recharts';

const formatBs = (num?: number) => `Bs. ${(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StaffPerformanceView() {
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
        queryKey: ['staff-performance', date, selectedSucursal],
        queryFn: () => getStaffPerformanceReport(date, selectedSucursal === 'all' ? undefined : selectedSucursal),
    });

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-xl">
                    <p className="text-gray-900 font-bold mb-1 text-sm flex items-center gap-2">
                        {label}
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
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-80 bg-white rounded-[32px] border border-gray-100">
                    <Loader2 size={40} className="animate-spin text-indigo-400 mb-4" />
                    <p className="text-sm text-gray-400 font-medium">Calculando desempeño...</p>
                </div>
            ) : isError ? (
                <div className="flex flex-col items-center justify-center h-80 text-red-500 bg-red-50 rounded-[32px]">
                    <AlertTriangle size={40} className="mb-2" />
                    <p className="font-bold">Error al cargar datos</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Cajeros */}
                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <Briefcase size={18} className="text-emerald-500" /> 
                            Rendimiento por Cajero
                        </h3>

                        {!data?.cajeros || data.cajeros.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <Briefcase size={32} className="text-gray-300 mb-3" />
                                <p className="font-bold text-gray-500">Sin datos de cajeros</p>
                            </div>
                        ) : (
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.cajeros} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                        <XAxis type="number" tickFormatter={(val) => `Bs ${val}`} tick={{fontSize: 11, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="nombre" type="category" width={120} tick={{fontSize: 11, fill: '#374151', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{fill: '#f8fafc'}} content={<CustomTooltip />} />
                                        <Bar dataKey="total_ventas" radius={[0, 6, 6, 0]} maxBarSize={30}>
                                            {data.cajeros.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill="#10b981" className="transition-all duration-300 hover:opacity-80" />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Vendedores */}
                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <Users size={18} className="text-indigo-500" /> 
                            Rendimiento por Vendedor
                        </h3>

                        {!data?.vendedores || data.vendedores.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <Users size={32} className="text-gray-300 mb-3" />
                                <p className="font-bold text-gray-500">Sin datos de vendedores</p>
                            </div>
                        ) : (
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.vendedores} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                        <XAxis type="number" tickFormatter={(val) => `Bs ${val}`} tick={{fontSize: 11, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="nombre" type="category" width={120} tick={{fontSize: 11, fill: '#374151', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{fill: '#f8fafc'}} content={<CustomTooltip />} />
                                        <Bar dataKey="total_ventas" radius={[0, 6, 6, 0]} maxBarSize={30}>
                                            {data.vendedores.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill="#818cf8" className="transition-all duration-300 hover:opacity-80" />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
