import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createEmployee } from '../api/api';
import { Users, Plus, Loader2, X, KeyRound, AlertTriangle, Copy, Check } from 'lucide-react';
import type { EmployeeCreate } from '../api/types';
import PasswordField from '../components/PasswordField';
import { toast } from 'sonner';
import Pagination from '../components/Pagination';

interface NewCredentials {
    username: string;
    password: string;
    full_name: string;
}

const BLANK: EmployeeCreate = { username: '', email: '', password: '', full_name: '' };

export default function UsersPage() {
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState<EmployeeCreate>(BLANK);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [credentials, setCredentials] = useState<NewCredentials | null>(null);
    const [copied, setCopied] = useState(false);
    
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 12;

    const { data: employees, isLoading } = useQuery({ queryKey: ['employees'], queryFn: getUsers });

    const paginatedEmployees = useMemo(() => {
        if (!employees) return [];
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return employees.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [employees, currentPage]);

    const passwordsMatch = form.password === confirmPassword;
    const canSubmit = form.password.length >= 8 && passwordsMatch;

    const createMutation = useMutation({
        mutationFn: (data: EmployeeCreate) => createEmployee(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            setCredentials({ username: form.username, password: form.password, full_name: form.full_name });
            setShowModal(false);
            setForm(BLANK);
            setConfirmPassword('');
        },
        onError: () => {
            toast.error('Error al crear el cajero');
        }
    });

    const handleCopy = () => {
        if (!credentials) return;
        navigator.clipboard.writeText(`Nombre: ${credentials.full_name}\nUsuario: ${credentials.username}\nContraseña: ${credentials.password}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {paginatedEmployees.map(emp => (
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
                    
                    {employees && employees.length > ITEMS_PER_PAGE && (
                        <Pagination 
                            currentPage={currentPage}
                            totalPages={Math.ceil(employees.length / ITEMS_PER_PAGE)}
                            onPageChange={setCurrentPage}
                            totalItems={employees.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                        />
                    )}
                </div>
            )}

            {/* ── Credentials Modal ───────────────────────────────────────────── */}
            {credentials && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                <KeyRound size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Cajero creado</h2>
                                <p className="text-sm text-gray-500">{credentials.full_name}</p>
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
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-sm font-medium">
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Create Modal ────────────────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-lg font-bold text-gray-900">Nuevo Cajero</h2>
                            <button onClick={() => { setShowModal(false); setConfirmPassword(''); setForm(BLANK); }} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"><X size={18} /></button>
                        </div>
                        <form onSubmit={e => {
                            e.preventDefault();
                            if (!canSubmit) return;
                            createMutation.mutate(form);
                        }} className="space-y-4">
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

                            <PasswordField
                                value={form.password}
                                onChange={v => setForm({ ...form, password: v })}
                                confirmValue={confirmPassword}
                                onConfirmChange={setConfirmPassword}
                            />

                            {createMutation.isError && (
                                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                                    {((createMutation.error as any)?.detail as string) ?? 'Error al crear el cajero'}
                                </p>
                            )}

                            <button type="submit" disabled={createMutation.isPending || !canSubmit}
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
