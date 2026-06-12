import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProveedores, createProveedor, updateProveedor, deleteProveedor } from '../api/api';
import type { Proveedor } from '../api/types';
import { 
    Truck, Search, Plus, Edit3, Trash2, Mail, Phone, 
    X, ClipboardList, Info, Loader2, HelpCircle
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { useConfirm } from '../components/ConfirmModal';


// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    React.useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export default function ProveedoresPage() {
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 400);
    const [page] = useState(1);
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
    
    // Form fields
    const [nombre, setNombre] = useState('');
    const [contactoNombre, setContactoNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [email, setEmail] = useState('');
    const [nitCi, setNitCi] = useState('');
    const [direccion, setDireccion] = useState('');
    const [tipoInsumos, setTipoInsumos] = useState('Materia Prima');
    const [notas, setNotas] = useState('');

    // Fetch Providers
    const { data: proveedores = [], isLoading } = useQuery({
        queryKey: ['proveedores', page, debouncedSearch],
        queryFn: () => getProveedores(page, 100, debouncedSearch),
    });

    // Mutations
    const createMut = useMutation({
        mutationFn: createProveedor,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['proveedores'] });
            toast.success('Proveedor registrado exitosamente');
            closeModal();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.detail || 'Error al registrar proveedor');
        }
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Proveedor> }) => updateProveedor(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['proveedores'] });
            toast.success('Proveedor actualizado exitosamente');
            closeModal();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.detail || 'Error al actualizar proveedor');
        }
    });

    const deleteMut = useMutation({
        mutationFn: deleteProveedor,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['proveedores'] });
            toast.success('Proveedor eliminado exitosamente');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.detail || 'Error al eliminar proveedor');
        }
    });

    const openModal = (prov?: Proveedor) => {
        if (prov) {
            setEditingProveedor(prov);
            setNombre(prov.nombre);
            setContactoNombre(prov.contacto_nombre || '');
            setTelefono(prov.telefono || '');
            setEmail(prov.email || '');
            setNitCi(prov.nit_ci || '');
            setDireccion(prov.direccion || '');
            setTipoInsumos(prov.tipo_insumos || 'Materia Prima');
            setNotas(prov.notas || '');
        } else {
            setEditingProveedor(null);
            setNombre('');
            setContactoNombre('');
            setTelefono('');
            setEmail('');
            setNitCi('');
            setDireccion('');
            setTipoInsumos('Materia Prima');
            setNotas('');
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingProveedor(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre.trim()) {
            toast.error('El nombre comercial es obligatorio');
            return;
        }

        const payload = {
            nombre,
            contacto_nombre: contactoNombre || undefined,
            telefono: telefono || undefined,
            email: email || undefined,
            nit_ci: nitCi || undefined,
            direccion: direccion || undefined,
            tipo_insumos: tipoInsumos || undefined,
            notas: notas || undefined
        };

        if (editingProveedor) {
            updateMut.mutate({ id: editingProveedor._id, data: payload });
        } else {
            createMut.mutate(payload);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (await confirm({
            title: '¿Eliminar proveedor?',
            message: `¿Estás seguro de que deseas eliminar al proveedor "${name}"?`,
            type: 'danger',
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar'
        })) {
            deleteMut.mutate(id);
        }
    };

    // Metrics calculation
    const totalCount = proveedores.length;
    const rawMaterialCount = proveedores.filter(p => p.tipo_insumos === 'Materia Prima').length;
    const packagingCount = proveedores.filter(p => p.tipo_insumos === 'Embalaje').length;
    const otherInsumosCount = totalCount - rawMaterialCount - packagingCount;

    return (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 pb-24 md:pb-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Directorio de Proveedores</h1>
                    <p className="text-gray-500 mt-1">Administra los datos de contacto y categorías de tus proveedores de insumos</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-bold shadow-lg hover:bg-gray-800 transition-all active:scale-95 shrink-0"
                >
                    <Plus size={18} /> Nuevo Proveedor
                </button>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-[24px] border border-gray-150 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                        <Truck size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-gray-900">{totalCount}</div>
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Proveedores</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-[24px] border border-gray-150 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                        <ClipboardList size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-gray-900">{rawMaterialCount}</div>
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Materia Prima</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-[24px] border border-gray-150 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                        <Info size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-gray-900">{packagingCount}</div>
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Insumos Embalaje</div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-[24px] border border-gray-150 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0">
                        <HelpCircle size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-gray-900">{otherInsumosCount}</div>
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Otros / Servicios</div>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="Buscar proveedor por nombre comercial, NIT o teléfono..."
                    className="w-full bg-white border border-gray-200 rounded-full pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900 shadow-sm transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Table / Grid list */}
            <div className="bg-white rounded-[32px] border border-gray-200/80 overflow-hidden shadow-sm">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="animate-spin text-gray-400" size={36} />
                        <span className="text-xs text-gray-400 font-bold">Cargando directorio...</span>
                    </div>
                ) : proveedores.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4">
                            <Truck size={28} />
                        </div>
                        <h3 className="text-base font-bold text-gray-900">No se encontraron proveedores</h3>
                        <p className="text-xs text-gray-500 mt-1 max-w-xs">
                            {searchTerm ? 'Intenta utilizar términos diferentes para tu búsqueda.' : 'Haz clic en "Nuevo Proveedor" para comenzar a agregar contactos.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    <th className="py-4 px-6">Proveedor / Razón Social</th>
                                    <th className="py-4 px-6">Contacto</th>
                                    <th className="py-4 px-6">Teléfono & Email</th>
                                    <th className="py-4 px-6">NIT / CI</th>
                                    <th className="py-4 px-6">Tipo Insumos</th>
                                    <th className="py-4 px-6 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                                {proveedores.map((prov) => (
                                    <tr key={prov._id} className="hover:bg-gray-50/50 transition-colors">
                                        {/* Name & Notes */}
                                        <td className="py-4 px-6">
                                            <div className="font-extrabold text-gray-900 text-sm">{prov.nombre}</div>
                                            {prov.notas && (
                                                <div className="text-[10px] text-gray-400 italic line-clamp-1 mt-0.5">{prov.notas}</div>
                                            )}
                                        </td>
                                        {/* Contact Person */}
                                        <td className="py-4 px-6">
                                            <span className="font-semibold text-gray-600">
                                                {prov.contacto_nombre || <span className="text-gray-300 italic">No especificado</span>}
                                            </span>
                                        </td>
                                        {/* Phone & Email */}
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col gap-1">
                                                {prov.telefono ? (
                                                    <a href={`tel:${prov.telefono}`} className="flex items-center gap-1 text-gray-800 hover:text-indigo-600 transition-colors font-semibold">
                                                        <Phone size={12} className="text-gray-400" /> {prov.telefono}
                                                    </a>
                                                ) : null}
                                                {prov.email ? (
                                                    <a href={`mailto:${prov.email}`} className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors">
                                                        <Mail size={12} className="text-gray-400" /> {prov.email}
                                                    </a>
                                                ) : null}
                                                {!prov.telefono && !prov.email && (
                                                    <span className="text-gray-300 italic">Sin contacto</span>
                                                )}
                                            </div>
                                        </td>
                                        {/* Tax identification */}
                                        <td className="py-4 px-6">
                                            <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded text-[10px]">
                                                {prov.nit_ci || 'S/N'}
                                            </span>
                                        </td>
                                        {/* Type of inputs */}
                                        <td className="py-4 px-6">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                prov.tipo_insumos === 'Materia Prima' 
                                                    ? 'bg-emerald-50 text-emerald-700' 
                                                    : prov.tipo_insumos === 'Embalaje' 
                                                        ? 'bg-amber-50 text-amber-700' 
                                                        : 'bg-purple-50 text-purple-700'
                                            }`}>
                                                {prov.tipo_insumos || 'Otros'}
                                            </span>
                                        </td>
                                        {/* Action buttons */}
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => openModal(prov)}
                                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit3 size={15} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(prov._id, prov.nombre)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* CRUD Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="bg-white rounded-[32px] p-6 md:p-8 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                                </h2>
                                <button
                                    onClick={closeModal}
                                    className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nombre Comercial / Razón Social *</label>
                                    <input
                                        type="text" required autoFocus
                                        placeholder="Ej. Distribuidora Alimentos S.A."
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900 transition-all font-semibold"
                                        value={nombre}
                                        onChange={e => setNombre(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nombre de Contacto</label>
                                        <input
                                            type="text"
                                            placeholder="Ej. Juan Pérez"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900 transition-all"
                                            value={contactoNombre}
                                            onChange={e => setContactoNombre(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">NIT o Carnet de Identidad</label>
                                        <input
                                            type="text"
                                            placeholder="Ej. 1029485028"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900 transition-all font-mono"
                                            value={nitCi}
                                            onChange={e => setNitCi(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Teléfono</label>
                                        <input
                                            type="tel"
                                            placeholder="Ej. +591 76543210"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900 transition-all font-semibold"
                                            value={telefono}
                                            onChange={e => setTelefono(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Correo Electrónico</label>
                                        <input
                                            type="email"
                                            placeholder="Ej. contacto@proveedor.com"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900 transition-all"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tipo de Insumos</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900 transition-all font-semibold"
                                        value={tipoInsumos}
                                        onChange={e => setTipoInsumos(e.target.value)}
                                    >
                                        <option value="Materia Prima">Materia Prima</option>
                                        <option value="Embalaje">Embalajes / Envases</option>
                                        <option value="Servicios">Servicios / Logística</option>
                                        <option value="Otros">Otros Insumos</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Dirección Física</label>
                                    <input
                                        type="text"
                                        placeholder="Ej. Av. Blanco Galindo Km 4.5, Cochabamba"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900 transition-all"
                                        value={direccion}
                                        onChange={e => setDireccion(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Notas / Observaciones</label>
                                    <textarea
                                        placeholder="Detalles adicionales sobre el proveedor, condiciones de pago, etc."
                                        rows={3}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900 transition-all resize-none"
                                        value={notas}
                                        onChange={e => setNotas(e.target.value)}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={createMut.isPending || updateMut.isPending}
                                    className="w-full bg-black text-white py-3.5 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 mt-4 text-xs tracking-wide shadow-md"
                                >
                                    {createMut.isPending || updateMut.isPending ? (
                                        <Loader2 className="animate-spin" size={16} />
                                    ) : editingProveedor ? (
                                        'Guardar Cambios'
                                    ) : (
                                        'Registrar Proveedor'
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
