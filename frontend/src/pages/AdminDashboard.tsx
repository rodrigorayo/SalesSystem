import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTenants, createTenant, updateTenant, deleteTenant } from '../api/api';
import { Plus, Users, Building, Loader2, X, Check, Edit2, Trash2, ShieldAlert, KeyRound, AlertTriangle, Copy } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import type { Tenant, TenantCreate, TenantUpdate } from '../api/types';
import { toast } from 'sonner';
import PasswordField from '../components/PasswordField';

export default function AdminDashboard() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [credentials, setCredentials] = useState<{ username: string; password: string; name: string } | null>(null);
    const [copied, setCopied] = useState(false);

    // Form State (Create)
    const [formData, setFormData] = useState<TenantCreate>({
        name: '',
        plan: 'BASIC',
        admin_username: '',
        admin_password: ''
    });

    // Fetch Tenants
    const { data: tenants, isLoading } = useQuery({
        queryKey: ['tenants'],
        queryFn: getTenants,
    });

    // Create Tenant Mutation
    const createTenantMutation = useMutation({
        mutationFn: (newTenant: TenantCreate) => createTenant(newTenant),
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            setIsModalOpen(false);
            setCredentials({ username: vars.admin_username, password: vars.admin_password, name: vars.name });
            setFormData({ name: '', plan: 'BASIC', admin_username: '', admin_password: '' });
            setConfirmPassword('');
        },
        onError: () => {
            // Sonner toast already triggered in client.ts
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
        if (confirm(`¿Estás seguro de que deseas eliminar permanentemente la empresa "${tenant.name}"? Esta acción no se puede deshacer de forma sencilla.`)) {
            deleteTenantMutation.mutate(tenant._id);
        }
    };

    const canSubmit = formData.admin_password === confirmPassword && formData.admin_password.length >= 8;

    if (user?.role !== 'SUPERADMIN') {
        return <div className="p-8 text-center text-red-500">Acceso Restringido</div>
    }

    const activeTenants = tenants?.filter(t => t.is_active).length || 0;

    return (
        <div className="max-w-7xl mx-auto p-4 space-y-4 relative">

            {/* ── Credentials Modal ─────────────────────────────────────── */}
            {credentials && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                <KeyRound size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Empresa creada</h2>
                                <p className="text-sm text-gray-500">{credentials.name}</p>
                            </div>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                            <div className="flex items-start gap-2 text-amber-800 text-sm mb-3">
                                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                <span>Guarda estas credenciales ahora. La contraseña no se mostrará nuevamente.</span>
                            </div>
                            <div className="space-y-2">
                                {[{ label: 'Usuario', val: credentials.username }, { label: 'Contraseña', val: credentials.password }].map(({ label, val }) => (
                                    <div key={label} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-200">
                                        <span className="text-xs text-gray-500">{label}</span>
                                        <span className="font-mono font-semibold text-gray-900">{val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleCopy}
                                className="flex items-center gap-2 flex-1 justify-center bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-xl text-sm font-medium transition-colors">
                                {copied ? <><Check size={16} className="text-green-600" /> Copiado</> : <><Copy size={16} /> Copiar</>}
                            </button>
                            <button onClick={() => setCredentials(null)}
                                className="flex-1 bg-black hover:bg-gray-900 text-white py-2 rounded-xl text-sm font-medium">
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Panel de Control SaaS</h1>
                    <p className="text-gray-500 mt-1">Gestiona empresas y suscripciones</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-bold shadow-lg hover:bg-gray-900 transition-all active:scale-95"
                >
                    <Plus size={20} /> Nueva Empresa
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
                        <Building size={24} />
                    </div>
                    <h3 className="text-3xl font-bold mb-1">{activeTenants}</h3>
                    <p className="text-gray-500 font-medium">Empresas Activas</p>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                    <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-4">
                        <Users size={24} />
                    </div>
                    <h3 className="text-3xl font-bold mb-1">--</h3> {/* Placeholder for user count */}
                    <p className="text-gray-500 font-medium">Usuarios Totales</p>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                    <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 mb-4">
                        <Users size={24} />
                    </div>
                    <h3 className="text-3xl font-bold mb-1">$--</h3>
                    <p className="text-gray-500 font-medium">Ingresos Mensuales</p>
                </div>
            </div>

            {/* Tenants List */}
            <div className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-200/60">
                <h3 className="text-xl font-bold mb-6">Empresas Registradas</h3>
                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400" /></div>
                ) : (
                    <div className="space-y-4">
                        {tenants?.map(tenant => (
                            <div key={tenant._id} className="flex items-center justify-between p-4 rounded-3xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 group">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500">
                                        {tenant.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">{tenant.name}</h4>
                                        <p className="text-xs text-gray-500 flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${tenant.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            {tenant.plan}
                                            {/* • {tenant.users} Usuarios */}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setEditingTenant(tenant)}
                                        className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                        title="Editar Empresa"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(tenant)}
                                        className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                        title="Eliminar Empresa"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {tenants?.length === 0 && (
                            <p className="text-center text-gray-400 py-8">No hay empresas registradas.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Create Tenant Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Nueva Empresa</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Nombre del Negocio</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="ej. Chocolates Para Ti"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Plan</label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                    value={formData.plan}
                                    onChange={e => setFormData({ ...formData, plan: e.target.value as 'BASIC' | 'PRO' })}
                                >
                                    <option value="BASIC">Básico (3 Sucursales)</option>
                                    <option value="PRO">Pro (Ilimitado)</option>
                                </select>
                            </div>

                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Usuario Administrador</p>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Email del Administrador</label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="admin@empresa.com"
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                        value={formData.admin_username}
                                        onChange={e => setFormData({ ...formData, admin_username: e.target.value })}
                                    />
                                </div>
                                <PasswordField
                                    value={formData.admin_password}
                                    onChange={v => setFormData({ ...formData, admin_password: v })}
                                    confirmValue={confirmPassword}
                                    onConfirmChange={setConfirmPassword}
                                    label="Contraseña"
                                    inputClassName="bg-white border-gray-200"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={createTenantMutation.isPending || !canSubmit}
                                className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-900 transition-all flex items-center justify-center gap-2 mt-4"
                            >
                                {createTenantMutation.isPending ? <Loader2 className="animate-spin" /> : <>Crear Empresa <Check size={20} /></>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Tenant Modal */}
            {editingTenant && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Editar Empresa</h2>
                            <button onClick={() => setEditingTenant(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Nombre del Negocio</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                    value={editingTenant.name}
                                    onChange={e => setEditingTenant({ ...editingTenant, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Plan</label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                    value={editingTenant.plan}
                                    onChange={e => setEditingTenant({ ...editingTenant, plan: e.target.value as 'BASIC' | 'PRO' })}
                                >
                                    <option value="BASIC">Básico (3 Sucursales)</option>
                                    <option value="PRO">Pro (Ilimitado)</option>
                                </select>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black"
                                        checked={editingTenant.is_active}
                                        onChange={e => setEditingTenant({ ...editingTenant, is_active: e.target.checked })}
                                    />
                                    <span className="font-bold text-gray-700">Empresa Activa</span>
                                </label>
                                {!editingTenant.is_active && (
                                    <p className="text-xs text-red-500 mt-2 ml-8 flex items-center gap-1">
                                        <ShieldAlert size={14}/>
                                        Los usuarios de esta empresa no podrán iniciar sesión.
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={updateTenantMutation.isPending}
                                className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-900 transition-all flex items-center justify-center gap-2 mt-4"
                            >
                                {updateTenantMutation.isPending ? <Loader2 className="animate-spin" /> : <>Guardar Cambios <Check size={20} /></>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
