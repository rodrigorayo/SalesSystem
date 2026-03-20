import { useQuery } from '@tanstack/react-query';
import {
    LayoutDashboard, Package, ShieldAlert,
    TrendingUp, Boxes, IndianRupee, RotateCcw
} from 'lucide-react';
import { getSaleStatsToday, getInventario } from '../api/api';
import { useAuthStore } from '../store/authStore';

export default function DashboardSucursal() {
    const { user } = useAuthStore();

    // Solo carga estadísticas de la sucursal asignada
    const { data: stats } = useQuery({
        queryKey: ['sales-stats-today', user?.sucursal_id],
        queryFn: () => getSaleStatsToday(user?.sucursal_id),
        enabled: !!user?.sucursal_id
    });

    const { data: invData } = useQuery({
        queryKey: ['inventario', user?.sucursal_id],
        queryFn: () => getInventario(user?.sucursal_id, 1, 1000),
        enabled: !!user?.sucursal_id
    });
    const inv = invData?.items || [];

    // Productos con stock <= 5 (Alerta)
    const stockBajo = inv.filter(i => i.cantidad <= 5);

    return (
        <div className="max-w-7xl mx-auto px-3 py-4 md:p-4 space-y-4 pb-20 md:pb-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Mi Sucursal</h1>
                    <p className="text-gray-500 mt-1 text-sm">Resumen operativo del día para gestionar tu tienda.</p>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Ventas Hoy</p>
                        <h3 className="text-2xl font-bold text-gray-900">
                            ${(stats?.today_sales || 0).toFixed(2)}
                        </h3>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                        <LayoutDashboard size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Transacciones</p>
                        <h3 className="text-2xl font-bold text-gray-900">{stats?.transaction_count || 0}</h3>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                        <Boxes size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Items en Catálogo Físico</p>
                        <h3 className="text-2xl font-bold text-gray-900">{inv.length}</h3>
                    </div>
                </div>
            </div>

            {/* Quick Actions / Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Alertas de Stock Bajo */}
                <div className="bg-white border text-red-900 border-red-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-red-50 bg-red-50/50 flex items-center gap-2">
                        <ShieldAlert className="text-red-500" size={18} />
                        <h3 className="font-bold">Alertas de Stock ({stockBajo.length})</h3>
                    </div>
                    <div className="p-0">
                        {stockBajo.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                <Package className="mx-auto mb-2 opacity-30" size={32} />
                                <p>Tu stock está saludable.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-red-50">
                                {stockBajo.map(item => (
                                    <li key={item.inventario_id} className="p-4 flex justify-between items-center bg-white hover:bg-red-50/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                                            ) : (
                                                <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center"><Package size={14} className="text-gray-400" /></div>
                                            )}
                                            <span className="font-medium text-sm text-gray-800">{item.producto_nombre}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.cantidad === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {item.cantidad} en almacén
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    {stockBajo.length > 0 && (
                        <div className="bg-orange-50 p-3 flex justify-between items-center text-orange-800 text-sm border-t border-orange-100">
                            <span>Sugerimos hacer un Pedido Interno hoy.</span>
                            <a href="/pedidos" className="font-bold underline">Hacer Pedido</a>
                        </div>
                    )}
                </div>

                {/* Acciones Rápidas */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4">Acciones Rápidas</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <a href="/ventas" className="flex flex-col items-center justify-center p-4 bg-gray-50 border border-gray-100 rounded-xl hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-600 transition-colors group">
                            <RotateCcw className="mb-2 text-gray-400 group-hover:text-indigo-500" size={24} />
                            <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-600">Ver/Anular Ventas</span>
                        </a>
                        <a href="/caja" className="flex flex-col items-center justify-center p-4 bg-gray-50 border border-gray-100 rounded-xl hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-600 transition-colors group">
                            <IndianRupee className="mb-2 text-gray-400 group-hover:text-indigo-500" size={24} />
                            <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-600">Arqueo de Caja</span>
                        </a>
                        <a href="/pos" className="flex flex-col items-center justify-center p-4 bg-gray-50 border border-gray-100 rounded-xl hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-600 transition-colors group">
                            <LayoutDashboard className="mb-2 text-gray-400 group-hover:text-indigo-500" size={24} />
                            <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-600">Abrir POS</span>
                        </a>
                        <a href="/catalogo" className="flex flex-col items-center justify-center p-4 bg-gray-50 border border-gray-100 rounded-xl hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-600 transition-colors group">
                            <Package className="mb-2 text-gray-400 group-hover:text-indigo-500" size={24} />
                            <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-600">Ver Precios</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
