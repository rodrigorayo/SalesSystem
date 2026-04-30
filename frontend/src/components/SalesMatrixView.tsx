import { useState, useMemo } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useQuery } from '@tanstack/react-query';
import { getSalesMatrix, getSucursales } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { Loader2, AlertTriangle, Calendar, Download } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function SalesMatrixView() {
    const { role, sucursal_id } = useAuthStore();
    
    // Default to last 7 days including today
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 6);
    
    const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
    const lastWeekStr = lastWeek.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
    
    const [startDate, setStartDate] = useState<string>(lastWeekStr);
    const [endDate, setEndDate] = useState<string>(todayStr);
    
    const esMatriz = ['SUPERADMIN', 'ADMIN', 'ADMIN_MATRIZ'].includes(role || '');
    const defaultSucursal = esMatriz ? 'all' : (sucursal_id || 'CENTRAL');
    const [selectedSucursal, setSelectedSucursal] = useState<string>(defaultSucursal);

    const { data: sucursales = [] } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales,
        enabled: esMatriz
    });

    const { data, isLoading, isError } = useQuery({
        queryKey: ['sales-matrix', startDate, endDate, selectedSucursal],
        queryFn: () => getSalesMatrix(startDate, endDate, selectedSucursal),
    });

    const dateList = useMemo(() => {
        const dates = [];
        let curr = new Date(startDate);
        const end = new Date(endDate);
        curr.setHours(12, 0, 0, 0); // avoid timezone shifts
        end.setHours(12, 0, 0, 0);
        
        while (curr <= end) {
            dates.push(curr.toLocaleDateString('en-CA'));
            curr.setDate(curr.getDate() + 1);
        }
        return dates;
    }, [startDate, endDate]);

    const handleDownloadCSV = () => {
        if (!data || !data.products) return;
        
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Header
        const header = ["Producto", ...dateList, "Total"];
        csvContent += header.join(",") + "\n";
        
        // Rows
        data.products.forEach(p => {
            const row = [`"${p.descripcion.replace(/"/g, '""')}"`];
            let rowTotal = 0;
            dateList.forEach(d => {
                const qty = p.days[d] || 0;
                row.push(qty.toString());
                rowTotal += qty;
            });
            row.push(rowTotal.toString());
            csvContent += row.join(",") + "\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `matriz_ventas_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                    <h2 className="text-xl font-black text-gray-900">Progreso de Ventas por Día (Matriz)</h2>
                    <p className="text-xs text-gray-500 font-medium">
                        Periodo del {startDate} al {endDate}
                    </p>
                </div>
                <button 
                    onClick={handleDownloadCSV}
                    disabled={!data || data.products.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download size={16} />
                    Exportar a CSV
                </button>
            </div>
            
            {/* Header Filters */}
            <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                    <div className="flex items-center gap-2 flex-1 md:flex-none">
                        <div className="relative">
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input 
                                type="date" 
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                max={endDate || todayStr}
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
                                max={todayStr}
                                className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            />
                        </div>
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
                    <p className="text-sm text-gray-400 font-medium">Cargando matriz...</p>
                </div>
            ) : isError ? (
                <div className="flex flex-col items-center justify-center h-80 text-red-500 bg-red-50 rounded-[32px]">
                    <AlertTriangle size={40} className="mb-2" />
                    <p className="font-bold">Error al cargar datos</p>
                </div>
            ) : (
                <div className="bg-white rounded-[24px] border border-gray-100 overflow-hidden shadow-sm">
                    {data?.products.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 font-medium">
                            No se encontraron ventas en este periodo.
                        </div>
                    ) : (
                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 sticky top-0 z-10 text-gray-500 text-[11px] uppercase tracking-wider font-black shadow-sm">
                                    <tr>
                                        <th className="p-4 border-b border-r border-gray-200 sticky left-0 bg-gray-50 z-20 min-w-[200px]">
                                            Producto
                                        </th>
                                        {dateList.map(d => {
                                            const parts = d.split('-');
                                            return (
                                                <th key={d} className="p-3 border-b border-gray-200 text-center min-w-[60px]">
                                                    {parts[2]}/{parts[1]}
                                                </th>
                                            );
                                        })}
                                        <th className="p-3 border-b border-l border-gray-200 bg-indigo-50 text-indigo-700 text-center sticky right-0 z-20">
                                            Total
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                                    {data?.products.map((p, i) => {
                                        let rowTotal = 0;
                                        return (
                                            <tr key={p.producto_id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4 border-r border-gray-100 sticky left-0 bg-white z-10 max-w-[300px] truncate" title={p.descripcion}>
                                                    {p.descripcion}
                                                </td>
                                                {dateList.map(d => {
                                                    const qty = p.days[d] || 0;
                                                    rowTotal += qty;
                                                    return (
                                                        <td key={d} className="p-3 text-center">
                                                            {qty > 0 ? (
                                                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                                                    {qty}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300">-</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className="p-3 border-l border-gray-100 text-center font-black text-indigo-700 bg-indigo-50/30 sticky right-0 z-10">
                                                    {rowTotal}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
