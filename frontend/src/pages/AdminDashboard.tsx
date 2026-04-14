import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTenants, createTenant, updateTenant, deleteTenant, client } from '../api/api';
import { Plus, Users, Building, Loader2, X, Check, Edit2, Trash2, ShieldAlert, KeyRound, AlertTriangle, Copy, Zap, Star, ShieldCheck, Crown, Gem, Settings } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import type { Tenant, TenantCreate, TenantUpdate } from '../api/types';
import { toast } from 'sonner';
import PasswordField from '../components/PasswordField';
import Pagination from '../components/Pagination';

interface Plan {
    code: string;
    name: string;
    is_public: boolean;
    features: string[];
}

const PlanBadge = ({ plan }: { plan: string }) => {
    const config: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
        'BASICO':     { label: 'Básico',     icon: ShieldCheck, color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-100' },
        'PRO':        { label: 'Pro',        icon: Crown,       color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-100' },
        'ENTERPRISE': { label: 'Enterprise', icon: Gem,         color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-100' },
        'ILIMITADO':  { label: 'Ilimitado',  icon: Star,        color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200' },
    };

    const s = config[plan] || { label: plan, icon: ShieldAlert, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-100' };
    const Icon = s.icon;

    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.bg} ${s.color} ${s.border}`}>
            <Icon size={12} strokeWidth={3} />
            {s.label}
        </span>
    );
};

export default function AdminDashboard() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [credentials, setCredentials] = useState<{ username: string; password: string; name: string } | null>(null);
    const [copied, setCopied] = useState(false);

    // Queries
    const { data: tenants, isLoading } = useQuery({
        queryKey: ['tenants'],
        queryFn: getTenants,
    });

    const { data: dbPlans } = useQuery({
        queryKey: ['admin-plans'],
        queryFn: () => client<Plan[]>('/tenants/admin/list-plans'),
    });

    // Form State (Create)
    const [formData, setFormData] = useState<TenantCreate>({
        name: '',
        plan: 'BASICO',
        admin_username: '',
        admin_password: ''
    });

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const paginatedTenants = useMemo(() => {
        if (!tenants) return [];
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return tenants.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [tenants, currentPage]);

    // Mutations
    const createTenantMutation = useMutation({
        mutationFn: (newTenant: TenantCreate) => createTenant(newTenant),
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            setIsModalOpen(false);
            setCredentials({ username: vars.admin_username, password: vars.admin_password, name: vars.name });
            setFormData({ name: '', plan: 'BASICO', admin_username: '', admin_password: '' });
            setConfirmPassword('');
        }
    });

    const updateTenantMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: TenantUpdate }) => updateTenant(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            setEditingTenant(null);
            toast.success("Empresa actualizada exitosamente");
        }
    });

    const deleteTenantMutation = useMutation({
        mutationFn: (id: string) => deleteTenant(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            toast.success("Empresa eliminada exitosamente");
        }
    });

    const seedPlansMutation = useMutation({
        mutationFn: () => client<any>('/tenants/admin/seed-plans', { method: 'POST' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
            toast.success('Planes sembrados y actualizados');
        }
    });

    const assignIlimitadoMutation = useMutation({
        mutationFn: () => client<any>('/tenants/admin/assign-ilimitado', { method: 'POST' }),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            toast.success(`Plan ILIMITADO asignado a "${res.tenant}"`);
        }
    });

    /*
    const syncAbonosMutation = useMutation({
        mutationFn: () => client<{ ok: boolean, synced_count: number }>('/sales/admin/sync-orphan-abonos', { method: 'POST' }),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] }); 
            toast.success(`Sincronización completa: ${res.synced_count} abonos recuperados.`);
        },
        onError: () => toast.error('Error al sincronizar abonos')
    });
    */


    // Fallback de planes por si el API aún no cargó o está fallando
    const plansList = useMemo(() => {
        if (dbPlans && dbPlans.length > 0) return dbPlans;
        return [
            { code: 'BASICO', name: 'Plan Básico', is_public: true, features: [] },
            { code: 'PRO', name: 'Plan Profesional', is_public: true, features: [] },
            { code: 'ENTERPRISE', name: 'Plan Enterprise', is_public: true, features: [] },
            { code: 'ILIMITADO', name: 'Plan Ilimitado', is_public: false, features: [] },
        ];
    }, [dbPlans]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.admin_password !== confirmPassword) return;
        createTenantMutation.mutate(formData);
    };

    const handleCopy = () => {
        if (!credentials) return;
        navigator.clipboard.writeText(`Empresa: ${credentials.name}\nUsuario: ${credentials.username}\nContraseña: ${credentials.password}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTenant) return;
        updateTenantMutation.mutate({
            id: editingTenant._id,
            data: {
                name: editingTenant.name,
                plan: editingTenant.plan,
                is_active: editingTenant.is_active
            }
        });
    };

    const handleDelete = (tenant: Tenant) => {
        if (confirm(`¿Eliminar permanentemente "${tenant.name}"?`)) {
            deleteTenantMutation.mutate(tenant._id);
        }
    };

    if (user?.role !== 'SUPERADMIN') return <div className="p-8 text-center text-red-500">Acceso Restringido</div>;

    const activeTenants = tenants?.filter(t => t.is_active).length || 0;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-20 md:pb-8">

            {credentials && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
                                <KeyRound size={28} className="text-amber-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900 leading-tight">Empresa Creada</h2>
                                <p className="text-sm text-gray-500">{credentials.name}</p>
                            </div>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
                            <div className="flex items-start gap-3 text-amber-800 text-xs mb-4 font-medium uppercase tracking-wider">
                                <AlertTriangle size={16} className="shrink-0" />
                                <span>Guarda estas credenciales. No se mostrarán de nuevo.</span>
                            </div>
                            <div className="space-y-3">
                                {[{ label: 'USUARIO', val: credentials.username }, { label: 'CONTRASEÑA', val: credentials.password }].map(({ label, val }) => (
                                    <div key={label} className="bg-white rounded-xl px-4 py-3 border border-amber-200">
                                        <p className="text-[10px] font-bold text-gray-400 mb-1">{label}</p>
                                        <p className="font-mono font-bold text-gray-900 break-all">{val}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleCopy} className="flex items-center gap-2 flex-1 justify-center bg-gray-100 hover:bg-gray-200 text-gray-800 py-3.5 rounded-2xl text-sm font-bold transition-all">
                                {copied ? <><Check size={18} className="text-green-600" /> Copiado</> : <><Copy size={18} /> Copiar</>}
                            </button>
                            <button onClick={() => setCredentials(null)} className="flex-1 bg-black hover:bg-gray-800 text-white py-3.5 rounded-2xl text-sm font-bold shadow-lg shadow-black/20">
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Panel SaaS</h1>
                    <p className="text-gray-500 font-medium">Control global de empresas y facturación</p>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-8 py-4 bg-black text-white rounded-2xl font-bold shadow-xl shadow-black/15 hover:bg-gray-800 hover:-translate-y-0.5 transition-all active:scale-95">
                    <Plus size={20} /> Nueva Empresa
                </button>
            </div>

            {/* Métrica Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Empresas Activas', val: activeTenants, icon: Building, color: 'blue' },
                    { label: 'Crecimiento Mes', val: '+12%', icon: Zap, color: 'purple' },
                    { label: 'Rev. Proyectado', val: '$ --', icon: Gem, color: 'emerald' }
                ].map((stat) => (
                    <div key={stat.label} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                        <div className={`w-12 h-12 bg-${stat.color}-50 rounded-2xl flex items-center justify-center text-${stat.color}-600 mb-4 group-hover:scale-110 transition-transform`}>
                            <stat.icon size={24} />
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 mb-1">{stat.val}</h3>
                        <p className="text-gray-500 text-sm font-bold uppercase tracking-wider">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Configuración Rápida / Seeders */}
            <div className="bg-gray-900 rounded-[32px] p-8 border border-gray-800 shadow-inner overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Settings size={120} className="text-white animate-spin-slow" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center">
                            <Zap size={20} className="text-black" />
                        </div>
                        <div>
                            <h3 className="text-white font-black text-xl">Configuración del Sistema</h3>
                            <p className="text-gray-400 text-sm">Ejecuta tareas de mantenimiento y auditoría global.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <button onClick={() => seedPlansMutation.mutate()} disabled={seedPlansMutation.isPending} className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-50">
                            {seedPlansMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={18} className="text-blue-400" />}
                            Actualizar Catálogo de Planes
                        </button>
                        <button onClick={() => assignIlimitadoMutation.mutate()} disabled={assignIlimitadoMutation.isPending} className="flex items-center gap-2 px-6 py-3 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/20 text-amber-400 rounded-2xl font-bold text-sm transition-all disabled:opacity-50">
                            {assignIlimitadoMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Star size={18} />}
                            Forzar Plan Ilimitado a Taboada
                        </button>
                    </div>
                </div>
            </div>

            {/* Lista Principal */}
            <div className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-black text-gray-900">Empresas Registradas</h3>
                    <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 uppercase tracking-widest">
                        {tenants?.length || 0} Total
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="animate-spin text-gray-200" size={48} />
                        <p className="text-gray-400 font-bold animate-pulse">CARGANDO EMPRESAS...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {paginatedTenants.map(tenant => (
                            <div key={tenant._id} className="flex items-center justify-between p-5 rounded-[32px] hover:bg-gray-100 transition-all border border-transparent hover:border-gray-100 group">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 bg-gray-900 rounded-[22px] flex items-center justify-center font-black text-white text-xl shadow-lg shadow-black/5 flex-shrink-0">
                                        {tenant.name.substring(0, 1).toUpperCase()}
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-3">
                                            <h4 className="font-black text-gray-900 text-lg leading-none">{tenant.name}</h4>
                                            {!tenant.is_active && <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[10px] font-black uppercase">Inactiva</span>}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <PlanBadge plan={tenant.plan} />
                                            <span className="text-gray-300">|</span>
                                            <p className="text-xs text-gray-400 font-bold tracking-tighter uppercase">ID: {tenant._id.substring(0,8)}...</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setEditingTenant(tenant)} className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-black hover:bg-white hover:shadow-md rounded-2xl transition-all border border-transparent hover:border-gray-200">
                                        <Edit2 size={20} />
                                    </button>
                                    <button onClick={() => handleDelete(tenant)} className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all">
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {tenants?.length === 0 && (
                            <div className="text-center py-20 space-y-3">
                                <Building size={48} className="mx-auto text-gray-100" />
                                <p className="text-gray-400 font-bold">Aún no hay empresas en el sistema.</p>
                            </div>
                        )}
                        {tenants && tenants.length > ITEMS_PER_PAGE && (
                            <div className="pt-6 border-t border-gray-100 mt-6">
                                <Pagination 
                                    currentPage={currentPage}
                                    totalPages={Math.ceil(tenants.length / ITEMS_PER_PAGE)}
                                    onPageChange={setCurrentPage}
                                    totalItems={tenants.length}
                                    itemsPerPage={ITEMS_PER_PAGE}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal: Crear Empresa */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] p-10 w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Nueva Empresa</h2>
                            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 rounded-2xl text-gray-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 tracking-widest uppercase ml-1">Nombre Comercial</label>
                                    <input type="text" required placeholder="ej. Chocolates Para Ti" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-black/5 text-gray-900 font-bold transition-all" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 tracking-widest uppercase ml-1">Suscripción Inicial</label>
                                    <select className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-black/5 text-gray-900 font-bold transition-all appearance-none cursor-pointer" value={formData.plan} onChange={e => setFormData({ ...formData, plan: e.target.value })}>
                                        {plansList.filter(p => p.is_public).map(p => (
                                            <option key={p.code} value={p.code}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="p-8 bg-gray-50 rounded-[32px] border border-gray-100 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white"><Users size={16}/></div>
                                    <p className="text-sm font-black text-gray-900 uppercase tracking-widest">Admin Principal</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Email de Acceso</label>
                                        <input type="email" required placeholder="admin@empresa.com" className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-black/5 text-gray-900 font-bold transition-all" value={formData.admin_username} onChange={e => setFormData({ ...formData, admin_username: e.target.value })} />
                                    </div>
                                    <PasswordField value={formData.admin_password} onChange={v => setFormData({ ...formData, admin_password: v })} confirmValue={confirmPassword} onConfirmChange={setConfirmPassword} label="Contraseña Secreta" inputClassName="bg-white border-gray-200" />
                                </div>
                            </div>

                            <button type="submit" disabled={createTenantMutation.isPending || formData.admin_password !== confirmPassword || formData.admin_password.length < 8} className="w-full bg-black text-white py-5 rounded-2xl font-black text-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-3 mt-6 shadow-xl shadow-black/10 disabled:opacity-30">
                                {createTenantMutation.isPending ? <Loader2 className="animate-spin" /> : <>Crear Empresa <Check size={24} /></>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Editar Empresa */}
            {editingTenant && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] p-10 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Gestionar Empresa</h2>
                            <button onClick={() => setEditingTenant(null)} className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 rounded-2xl text-gray-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase ml-1">Nombre Comercial</label>
                                <input type="text" required className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-black/5 text-gray-900 font-bold" value={editingTenant.name} onChange={e => setEditingTenant({ ...editingTenant, name: e.target.value })} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase ml-1">Ajustar Plan</label>
                                <select className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 outline-none text-gray-900 font-black cursor-pointer" value={editingTenant.plan} onChange={e => setEditingTenant({ ...editingTenant, plan: e.target.value as any })}>
                                    {plansList.map(p => (
                                        <option key={p.code} value={p.code}>{p.name} {!p.is_public ? '(Interno)' : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-[28px] border border-gray-200 mt-4">
                                <label className="flex items-center gap-4 cursor-pointer group">
                                    <div className="relative">
                                        <input type="checkbox" className="sr-only peer" checked={editingTenant.is_active} onChange={e => setEditingTenant({ ...editingTenant, is_active: e.target.checked })} />
                                        <div className="w-14 h-8 bg-gray-300 rounded-full peer peer-checked:bg-green-500 transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-6"></div>
                                    </div>
                                    <span className="font-black text-gray-700 uppercase tracking-wider">Estado de la cuenta</span>
                                </label>
                                {!editingTenant.is_active && (
                                    <p className="text-[10px] text-red-500 mt-4 font-bold flex items-center gap-1.5 uppercase tracking-tighter">
                                        <ShieldAlert size={14}/> Acceso bloqueado para todos los usuarios de esta empresa.
                                    </p>
                                )}
                            </div>

                            <button type="submit" disabled={updateTenantMutation.isPending} className="w-full bg-black text-white py-5 rounded-2xl font-black text-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-3 mt-4 shadow-xl shadow-black/10">
                                {updateTenantMutation.isPending ? <Loader2 className="animate-spin" /> : <>Guardar Cambios <Check size={24} /></>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
