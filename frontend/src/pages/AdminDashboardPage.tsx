import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTenants, client } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { Building, Layers, AlertCircle, TrendingUp } from 'lucide-react';
import type { Tenant } from '../api/types';

export default function AdminDashboardPage() {
    const { user } = useAuthStore();

    const { data: tenants, isLoading: isLoadingTenants } = useQuery({
        queryKey: ['tenants'],
        queryFn: getTenants,
    });

    const { isLoading: isLoadingPlans } = useQuery({
        queryKey: ['admin-plans'],
        queryFn: () => client<any[]>('/tenants/admin/plans'),
    });

    const metrics = useMemo(() => {
        if (!tenants) return { total: 0, active: 0, inactive: 0, popularPlan: '-', expiring: [] as Tenant[] };
        
        const active = tenants.filter(t => t.is_active).length;
        const inactive = tenants.length - active;
        
        // Count plans
        const planCounts = tenants.reduce((acc, t) => {
            acc[t.plan] = (acc[t.plan] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        let popularPlan = '-';
        let maxCount = 0;
        for (const [plan, count] of Object.entries(planCounts)) {
            if (count > maxCount) {
                maxCount = count;
                popularPlan = plan;
            }
        }

        // Expiring logic (next 7 days or already expired)
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);

        const expiring = tenants.filter(t => {
            if (!t.plan_expires_at) return false;
            const expires = new Date(t.plan_expires_at);
            return expires <= nextWeek;
        }).sort((a, b) => new Date(a.plan_expires_at!).getTime() - new Date(b.plan_expires_at!).getTime());

        return { total: tenants.length, active, inactive, popularPlan, expiring };
    }, [tenants]);

    if (user?.role !== 'SUPERADMIN') return <div className="p-8 text-center text-red-500">Acceso Restringido</div>;

    if (isLoadingTenants || isLoadingPlans) {
        return <div className="p-8 flex justify-center text-gray-500 font-bold animate-pulse">Cargando métricas...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-20 md:pb-8">
            <div className="mb-4">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Panel de Control SaaS</h1>
                <p className="text-gray-500 font-medium mt-1">Visión general del estado de tus clientes y modelo de negocio.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                        <Building size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Empresas</p>
                        <p className="text-2xl font-black text-gray-900">{metrics.total}</p>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Empresas Activas</p>
                        <p className="text-2xl font-black text-gray-900">{metrics.active}</p>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Empresas Inactivas</p>
                        <p className="text-2xl font-black text-gray-900">{metrics.inactive}</p>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                        <Layers size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Plan Más Popular</p>
                        <p className="text-xl font-black text-gray-900 truncate max-w-[120px]">{metrics.popularPlan}</p>
                    </div>
                </div>
            </div>

            {/* Alertas de Expiración */}
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900">Alertas de Vencimiento de Pago</h3>
                        <p className="text-sm text-gray-500">Clientes cuyo plan ya expiró o expirará en los próximos 7 días.</p>
                    </div>
                </div>

                {metrics.expiring.length === 0 ? (
                    <div className="bg-gray-50 rounded-2xl p-6 text-center text-gray-500 font-bold">
                        No hay pagos próximos a vencer.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {metrics.expiring.map(tenant => {
                            const isExpired = new Date(tenant.plan_expires_at!) < new Date();
                            return (
                                <div key={tenant._id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white ${isExpired ? 'bg-red-500' : 'bg-amber-500'}`}>
                                            {tenant.name.substring(0, 1)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">{tenant.name}</p>
                                            <p className={`text-xs font-bold ${isExpired ? 'text-red-600' : 'text-amber-600'}`}>
                                                {isExpired ? 'Pago Expirado el ' : 'Vence el '} 
                                                {new Date(tenant.plan_expires_at!).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600">
                                        Plan: {tenant.plan}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
