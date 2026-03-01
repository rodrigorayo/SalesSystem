import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createEmployee } from '../api/api';
import { Users, Plus, Loader2, X, Eye, EyeOff } from 'lucide-react';
import type { EmployeeCreate } from '../api/types';

export default function UsersPage() {
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState<EmployeeCreate>({ username: '', email: '', password: '', full_name: '' });

    // Cargar personal de la sucursal (o de la matriz) dependiendo del rol
    const { data: employees, isLoading } = useQuery({ queryKey: ['employees'], queryFn: getUsers });

    const createMutation = useMutation({
        mutationFn: (data: EmployeeCreate) => createEmployee(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            setShowModal(false);
            setForm({ username: '', email: '', password: '', full_name: '' });
        },
    });

    return (
        <div className="max-w-7xl mx-auto p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Personal (Cajeros)</h1>
                    <p className="text-gray-500 mt-1 text-sm">Gestiona los cajeros asignados a tu vista.</p>
                </div>
                <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors text-sm shadow-sm">
                    <Plus size={16} /> Nuevo Cajero
                </button>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
            ) : !employees || employees.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <Users size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-gray-500">No hay cajeros registrados aún.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {employees.map(emp => (
                        <div key={emp._id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <Users size={20} className="text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{emp.full_name ?? emp.username}</h3>
                                    <p className="text-sm text-gray-500">@{emp.username}</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-lg uppercase">Activo</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-lg font-bold text-gray-900">Nuevo Cajero</h2>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"><X size={18} /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre Completo</label>
                                <input type="text" placeholder="Ej: Juan Pérez" required
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-gray-900 placeholder-gray-400"
                                    value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Usuario de Login</label>
                                <input type="text" placeholder="juan.perez" required
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-gray-900 placeholder-gray-400"
                                    value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                                <input type="email" placeholder="juan@empresa.com" required
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-gray-900 placeholder-gray-400"
                                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Contraseña</label>
                                <div className="relative">
                                    <input type={showPassword ? "text" : "password"} placeholder="Mínimo 8 caracteres" required
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-gray-900 placeholder-gray-400 pr-10"
                                        value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <button type="submit" disabled={createMutation.isPending}
                                className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60 text-sm mt-2">
                                {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Guardar Cajero'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
