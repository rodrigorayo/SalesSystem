import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSucursales, createSucursal, updateSucursal, deleteSucursal } from '../api/api';
import type { SucursalCreate } from '../api/types';
import { Plus, Store, MapPin, Phone, Pencil, X, Loader2, KeyRound, Copy, Check, AlertTriangle, Building, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PasswordField from '../components/PasswordField';
import Pagination from '../components/Pagination';

interface CreatedCredentials {
    username: string;
    password: string;
    sucursal_nombre: string;
    ciudad: string;
}

const BLANK_FORM: SucursalCreate = {
    nombre: '', ciudad: '', direccion: '', telefono: '', admin_username: '', admin_password: '',
};

export default function SucursalesPage() {
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [credentials, setCredentials] = useState<CreatedCredentials | null>(null);
    const [copied, setCopied] = useState(false);
    const [form, setForm] = useState<SucursalCreate>(BLANK_FORM);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [editForm, setEditForm] = useState<{ nombre: string; ciudad: string; direccion: string; telefono: string }>({ nombre: '', ciudad: '', direccion: '', telefono: '' });
    
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 6; // usually fewer branches than products

    const { data: sucursales = [], isLoading } = useQuery({ queryKey: ['sucursales'], queryFn: getSucursales });

    const paginatedSucursales = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return sucursales.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [sucursales, currentPage]);

    const createMut = useMutation({
        mutationFn: (data: SucursalCreate) => createSucursal(data as any),
        onSuccess: (res: any) => {
            qc.invalidateQueries({ queryKey: ['sucursales'] });
            setShowCreate(false);
            setCredentials({ username: res.admin_credentials.username, password: res.admin_credentials.password, sucursal_nombre: res.sucursal.nombre, ciudad: res.sucursal.ciudad });
            setForm(BLANK_FORM);
            setConfirmPassword('');
        },
    });
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: typeof editForm }) => updateSucursal(id, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['sucursales'] }); setEditId(null); },
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => deleteSucursal(id),
        onSuccess: () => { 
            qc.invalidateQueries({ queryKey: ['sucursales'] }); 
            toast.success("Sucursal desactivada exitosamente");
        },
    });

    const handleDelete = (id: string, name: string) => {
        if (confirm(`¿Estás seguro de que deseas desactivar la sucursal "${name}"? El superadmin puede reactivarla después.`)) {
            deleteMut.mutate(id);
        }
    };

    const handleCopy = () => {
        if (!credentials) return;
        navigator.clipboard.writeText(`Sucursal: ${credentials.sucursal_nombre} (${credentials.ciudad})\nUsuario: ${credentials.username}\nContraseña: ${credentials.password}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const startEdit = (s: any) => {
        setEditId(s._id);
        setEditForm({ nombre: s.nombre, ciudad: s.ciudad ?? '', direccion: s.direccion ?? '', telefono: s.telefono ?? '' });
    };

    const field = (key: keyof SucursalCreate, val: string) =>
        setForm(f => ({ ...f, [key]: val }));

    const canSubmit = form.admin_password === confirmPassword && form.admin_password.length >= 8;

    // Bolivian cities suggestions
    const CIUDADES = ['Cochabamba', 'La Paz', 'Santa Cruz', 'Oruro', 'Potosí', 'Sucre', 'Tarija', 'Trinidad', 'Cobija'];

    return (
        <div className="max-w-7xl mx-auto p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Sucursales</h1>
                    <p className="text-gray-500 mt-1 text-sm">Gestiona las sucursales de tu empresa</p>
                </div>
                <button onClick={() => { setShowCreate(true); setEditId(null); setForm(BLANK_FORM); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors text-sm shadow-sm">
                    <Plus size={16} /> Nueva Sucursal
                </button>
            </div>

            {/* ── Credentials Modal ─────────────────────────────────────────────── */}
            {credentials && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                <KeyRound size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Credenciales creadas</h2>
                                <p className="text-sm text-gray-500">{credentials.sucursal_nombre} — {credentials.ciudad}</p>
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

            {/* ── Create Modal ──────────────────────────────────────────────────── */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-gray-900">Nueva Sucursal</h2>
                            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); if (!canSubmit) return; createMut.mutate(form); }} className="space-y-4">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Datos de la Sucursal</p>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                <input value={form.nombre} onChange={e => field('nombre', e.target.value)} required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder="Sucursal Norte" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                                <select value={form.ciudad} onChange={e => field('ciudad', e.target.value)} required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white">
                                    <option value="">Selecciona una ciudad…</option>
                                    {CIUDADES.map(c => <option key={c} value={c}>{c}</option>)}
                                    <option value="Otra">Otra</option>
                                </select>
                                {form.ciudad === 'Otra' && (
                                    <input value="" onChange={e => field('ciudad', e.target.value)} required
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm mt-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        placeholder="Nombre de la ciudad" />
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                                <input value={form.direccion} onChange={e => field('direccion', e.target.value)} required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder="Av. Blanco Galindo 1234" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (Opcional)</label>
                                <input value={form.telefono ?? ''} onChange={e => field('telefono', e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder="+591 4 4123456" />
                            </div>

                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2 border-t border-gray-100">Administrador de Sucursal</p>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                                Se creará un usuario <strong>ADMIN_SUCURSAL</strong> automáticamente con estas credenciales.
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email del Administrador</label>
                                <input type="email" value={form.admin_username} onChange={e => field('admin_username', e.target.value)} required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder="admin@sucursal.com" />
                            </div>

                            <PasswordField
                                value={form.admin_password}
                                onChange={v => field('admin_password', v)}
                                confirmValue={confirmPassword}
                                onConfirmChange={setConfirmPassword}
                                label="Contraseña del Administrador"
                            />

                            {createMut.isError && (
                                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                    {((createMut.error as any)?.detail as string) ?? 'Error al crear la sucursal'}
                                </p>
                            )}

                            <button type="submit" disabled={createMut.isPending || !canSubmit}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors">
                                {createMut.isPending ? <Loader2 size={18} className="animate-spin" /> : <><Check size={18} /> Crear Sucursal</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Edit Modal ────────────────────────────────────────────────────── */}
            {editId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-gray-900">Editar Sucursal</h2>
                            <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); updateMut.mutate({ id: editId, data: editForm }); }} className="space-y-4">
                            {[
                                { label: 'Nombre', key: 'nombre', required: true },
                                { label: 'Ciudad', key: 'ciudad', required: true },
                                { label: 'Dirección', key: 'direccion', required: true },
                                { label: 'Teléfono (Opcional)', key: 'telefono', required: false },
                            ].map(({ label, key, required }) => (
                                <div key={key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                                    <input value={(editForm as any)[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} required={required}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                                </div>
                            ))}
                            <button type="submit" disabled={updateMut.isPending}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2">
                                {updateMut.isPending ? <Loader2 size={18} className="animate-spin" /> : <><Check size={18} /> Guardar</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── List ─────────────────────────────────────────────────────────── */}
            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
            ) : sucursales.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <Store size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-gray-500">No hay sucursales. Crea la primera.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {paginatedSucursales.map(s => (
                            <div key={s._id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow group">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                        <Store size={20} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{s.nombre}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                            {s.is_active ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </div>
                                </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEdit(s)}
                                            className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50">
                                            <Pencil size={15} />
                                        </button>
                                        <button onClick={() => handleDelete(s._id, s.nombre)} disabled={deleteMut.isPending}
                                            className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            <div className="flex items-center gap-2 text-gray-600 text-sm mt-2 font-medium">
                                <Building size={13} className="text-gray-400" /> {s.ciudad}
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                                <MapPin size={13} className="shrink-0" /> {s.direccion}
                            </div>
                            {s.telefono && (
                                <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                                    <Phone size={13} /> {s.telefono}
                                </div>
                            )}
                        </div>
                    ))}
                    </div>
                    {sucursales.length > ITEMS_PER_PAGE && (
                        <Pagination 
                            currentPage={currentPage}
                            totalPages={Math.ceil(sucursales.length / ITEMS_PER_PAGE)}
                            onPageChange={setCurrentPage}
                            totalItems={sucursales.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
