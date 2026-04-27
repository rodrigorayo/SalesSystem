import { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useQuery } from '@tanstack/react-query';
import { getStaffPerformanceReport, getSucursales } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { Loader2, AlertTriangle, Calendar, Users, Briefcase } from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Cell
} from 'recharts';

const formatBs = (num?: number) => `Bs. ${(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function StaffPerformanceView() {
    const { role, sucursal_id } = useAuthStore();
    
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
    const [dateType, setDateType] = useState<'single' | 'range'>('single');
    const [date, setDate] = useState<string>(today);
    const [startDate, setStartDate] = useState<string>(today);
    const [endDate, setEndDate] = useState<string>(today);
    
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
        queryKey: ['staff-performance', dateType, date, startDate, endDate, selectedSucursal],
        queryFn: () => getStaffPerformanceReport(
            dateType === 'single' ? date : undefined, 
            selectedSucursal === 'all' ? undefined : selectedSucursal,
            dateType === 'range' ? startDate : undefined,
            dateType === 'range' ? endDate : undefined
        ),
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                    <h2 className="text-xl font-black text-gray-900">Desempeño de Personal</h2>
                    <p className="text-xs text-gray-500 font-medium">
                        {dateType === 'single' ? `Reporte del día ${date}` : `Periodo del ${startDate} al ${endDate}`}
                    </p>
                </div>
            </div>
            {/* Header Filters */}
            <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                    {/* Selector de Tipo de Fecha */}
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button 
                            onClick={() => setDateType('single')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                dateType === 'single' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            Un día
                        </button>
                        <button 
                            onClick={() => setDateType('range')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                dateType === 'range' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            Rango
                        </button>
                    </div>

                    {dateType === 'single' ? (
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
                    ) : (
                        <div className="flex items-center gap-2 flex-1 md:flex-none">
                            <div className="relative">
                                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="date" 
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    max={endDate || today}
                                    className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                />
                            </div>
                            <span className="text-gray-400 font-bold">al</span>
                            <div className="relative">
                                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="date" 
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    min={startDate}
                                    max={today}
                                    className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                />
                            </div>
                        </div>
                    )}
                    
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
                <div className="space-y-8">
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
                                                    <Cell key={`cell-${index}`} fill="#10b981" />
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
                                                    <Cell key={`cell-${index}`} fill="#818cf8" />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Detalle Desglosado */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-6">Detalle Cajeros</h4>
                            {data?.cajeros?.map(staff => (
                                <StaffDetailCard key={staff.nombre} staff={staff} color="emerald" />
                            ))}
                        </div>
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-6">Detalle Vendedores</h4>
                            {data?.vendedores?.map(staff => (
                                <StaffDetailCard key={staff.nombre} staff={staff} color="indigo" />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StaffDetailCard({ staff, color }: { staff: any, color: 'emerald' | 'indigo' }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-white rounded-[24px] border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-md">
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 text-left"
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white",
                        color === 'emerald' ? "bg-emerald-500" : "bg-indigo-500"
                    )}>
                        {staff.nombre[0].toUpperCase()}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900">{staff.nombre}</p>
                        <p className="text-xs text-gray-500 font-medium">{staff.cantidad_ventas} ventas registradas</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-black text-gray-900">{formatBs(staff.total_ventas)}</p>
                    <p className={cn(
                        "text-[10px] font-bold uppercase",
                        isExpanded ? "text-indigo-600" : "text-gray-400"
                    )}>
                        {isExpanded ? 'Ocultar Detalle ▲' : 'Ver Detalle ▼'}
                    </p>
                </div>
            </button>

            {isExpanded && (
                <div className="px-4 pb-5 border-t border-gray-50 bg-gray-50/50">
                    <div className="space-y-4 mt-4">
                        {staff.categorias?.map((cat: any) => (
                            <div key={cat.nombre} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-50">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">{cat.nombre}</span>
                                    <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{formatBs(cat.total)}</span>
                                </div>
                                <div className="space-y-1">
                                    {cat.productos?.map((p: any) => (
                                        <div key={p.nombre} className="flex justify-between items-center text-xs">
                                            <span className="text-gray-600">{p.nombre} <span className="text-gray-400 ml-1">x{p.cantidad}</span></span>
                                            <span className="font-mono font-bold text-gray-900">{formatBs(p.total)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {(!staff.categorias || staff.categorias.length === 0) && (
                            <p className="text-center text-xs text-gray-400 py-4">No hay desglose de productos disponible.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

