import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAlmacenes, createAlmacen, updateAlmacen, deleteAlmacen } from '../api/api';
import type { Almacen, Sucursal } from '../api/types';
import { Plus, Package, MapPin, Pencil, Trash2, X, Check, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from './ConfirmModal';


export function AlmacenesManager({ sucursales }: { sucursales: Sucursal[] }) {
    const confirm = useConfirm();
    const qc = useQueryClient();
    const [selectedSucursalId, setSelectedSucursalId] = useState<string>(sucursales[0]?._id || '');
    const [showCreate, setShowCreate] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<{ nombre: string; ubicacion: string; is_default: boolean }>({ nombre: '', ubicacion: '', is_default: false });

    const { data: almacenes = [], isLoading } = useQuery({
        queryKey: ['almacenes', selectedSucursalId],
        queryFn: () => getAlmacenes(selectedSucursalId),
        enabled: !!selectedSucursalId
    });

    const createMut = useMutation({
        mutationFn: () => createAlmacen(selectedSucursalId, form),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['almacenes', selectedSucursalId] });
            setShowCreate(false);
            setForm({ nombre: '', ubicacion: '', is_default: false });
            toast.success("Almacén creado");
        }
    });

    const updateMut = useMutation({
        mutationFn: (id: string) => updateAlmacen(id, form),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['almacenes', selectedSucursalId] });
            setEditId(null);
            toast.success("Almacén actualizado");
        }
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => deleteAlmacen(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['almacenes', selectedSucursalId] });
            toast.success("Almacén eliminado");
        }
    });

    if (sucursales.length === 0) return <div className="p-4 text-gray-500">No hay sucursales creadas.</div>;

    const startEdit = (a: Almacen) => {
        setForm({ nombre: a.nombre, ubicacion: a.ubicacion || '', is_default: a.is_default || false });
        setEditId(a.id!);
        setShowCreate(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar Sucursal</label>
                    <select
                        value={selectedSucursalId}
                        onChange={e => setSelectedSucursalId(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    >
                        {sucursales.map(s => <option key={s._id} value={s._id}>{s.nombre}</option>)}
                    </select>
                </div>
                <button onClick={() => { setForm({ nombre: '', ubicacion: '', is_default: false }); setEditId(null); setShowCreate(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors text-sm shadow-sm whitespace-nowrap">
                    <Plus size={16} /> Nuevo Almacén
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
            ) : almacenes.length === 0 ? (
                <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl text-gray-400">
                    <Package size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-gray-500">No hay almacenes configurados en esta sucursal.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {almacenes.map(a => (
                        <div key={a.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow group relative">
                            {a.is_default && (
                                <div className="absolute top-0 right-0 translate-x-2 -translate-y-2 bg-indigo-100 text-indigo-700 p-1.5 rounded-full" title="Almacén Principal">
                                    <Star size={14} className="fill-indigo-600" />
                                </div>
                            )}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                        <Package size={20} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{a.nombre}</h3>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-blue-100 text-blue-700">
                                            Almacén Virtual
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEdit(a)}
                                        className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50">
                                        <Pencil size={15} />
                                    </button>
                                    <button onClick={async () => {
                                         if (await confirm({
                                             title: '¿Eliminar almacén?',
                                             message: 'Esta acción no se puede deshacer y eliminará el almacén seleccionado.',
                                             type: 'danger',
                                             confirmLabel: 'Eliminar',
                                             cancelLabel: 'Cancelar'
                                         })) {
                                             deleteMut.mutate(a.id!);
                                         }
                                     }} disabled={deleteMut.isPending}
                                        className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50">
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                            {a.ubicacion && (
                                <div className="flex items-center gap-2 text-gray-500 text-sm mt-2">
                                    <MapPin size={13} className="shrink-0" /> {a.ubicacion}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showCreate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-gray-900">{editId ? 'Editar Almacén' : 'Nuevo Almacén'}</h2>
                            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
                        </div>
                        <form onSubmit={e => {
                            e.preventDefault();
                            if (editId) updateMut.mutate(editId);
                            else createMut.mutate();
                        }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder="Ej. Congelados, Mostrador" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación (Opcional)</label>
                                <input value={form.ubicacion} onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder="Pasillo 3, Trastienda..." />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer mt-2">
                                <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                <span className="text-sm font-medium text-gray-700">Almacén Principal (Por defecto)</span>
                            </label>

                            <button type="submit" disabled={createMut.isPending || updateMut.isPending}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors mt-4">
                                {(createMut.isPending || updateMut.isPending) ? <Loader2 size={18} className="animate-spin" /> : <><Check size={18} /> Guardar</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
