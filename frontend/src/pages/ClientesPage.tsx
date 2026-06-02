import React, { useState } from 'react';
import { 
    Users, Search, Plus, Edit2, Trash2, Mail, Phone, MapPin, CreditCard, 
    X, ShoppingBag, ShieldCheck 
} from 'lucide-react';
import { useClientes, useCreateCliente, useUpdateCliente, useDeleteCliente } from '../hooks/useClientes';
import type { Cliente } from '../api/clientes';
import { AnimatePresence, motion } from 'framer-motion';

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): [T] {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    React.useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return [debouncedValue];
}

export default function ClientesPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch] = useDebounce(searchTerm, 500);
    const [page] = useState(1);
    
    // API
    const { data: clientes = [], isLoading } = useClientes(page, 50, debouncedSearch);
    const createMut = useCreateCliente();
    const updateMut = useUpdateCliente();
    const deleteMut = useDeleteCliente();

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
    const [formData, setFormData] = useState({
        nombre: '',
        telefono: '',
        email: '',
        nit_ci: '',
        direccion: '',
        notas: ''
    });

    const openModal = (cliente?: Cliente) => {
        if (cliente) {
            setEditingCliente(cliente);
            setFormData({
                nombre: cliente.nombre,
                telefono: cliente.telefono || '',
                email: cliente.email || '',
                nit_ci: cliente.nit_ci || '',
                direccion: cliente.direccion || '',
                notas: cliente.notas || ''
            });
        } else {
            setEditingCliente(null);
            setFormData({ nombre: '', telefono: '', email: '', nit_ci: '', direccion: '', notas: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCliente(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingCliente) {
            updateMut.mutate({ id: editingCliente._id, data: formData }, {
                onSuccess: () => closeModal()
            });
        } else {
            createMut.mutate(formData, {
                onSuccess: () => closeModal()
            });
        }
    };

    const handleDelete = (id: string, nombre: string) => {
        if (window.confirm(`¿Estás seguro de eliminar a ${nombre}?`)) {
            deleteMut.mutate(id);
        }
    };

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount);
    };

    return (
        <div className="flex flex-col h-full bg-[#f8f9fc] text-gray-800">
            {/* ── Header ── */}
            <div className="bg-white px-6 py-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-inner">
                        <Users size={24} className="text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Directorio de Clientes</h1>
                        <p className="text-sm text-gray-500 font-medium mt-0.5">Gestiona la base de datos de compradores</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, NIT o teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-gray-900 placeholder-gray-400"
                        />
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-95 whitespace-nowrap"
                    >
                        <Plus size={18} /> Nuevo Cliente
                    </button>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        <p className="text-sm font-medium">Cargando clientes...</p>
                    </div>
                ) : clientes.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-4">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                            <Users size={32} className="text-gray-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">No se encontraron clientes</h3>
                            <p className="text-gray-500 text-sm mt-1 max-w-sm">
                                {searchTerm ? 'Intenta usar otros términos de búsqueda.' : 'Comienza añadiendo tu primer cliente a la base de datos.'}
                            </p>
                        </div>
                        {!searchTerm && (
                            <button onClick={() => openModal()} className="mt-2 text-indigo-600 font-bold text-sm hover:underline">
                                + Añadir Cliente
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {clientes.map((cliente: Cliente) => (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={cliente._id} 
                                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-all group flex flex-col"
                            >
                                <div className="p-5 flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-50 flex items-center justify-center text-indigo-700 font-black text-lg">
                                            {cliente.nombre.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openModal(cliente)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(cliente._id, cliente.nombre)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <h3 className="font-bold text-gray-900 text-base leading-tight mb-1 line-clamp-1" title={cliente.nombre}>
                                        {cliente.nombre}
                                    </h3>
                                    
                                    <div className="space-y-2 mt-4">
                                        {cliente.nit_ci && (
                                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                                <CreditCard size={14} className="text-gray-400 shrink-0" />
                                                <span className="font-mono">{cliente.nit_ci}</span>
                                            </div>
                                        )}
                                        {cliente.telefono && (
                                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                                <Phone size={14} className="text-gray-400 shrink-0" />
                                                <span>{cliente.telefono}</span>
                                            </div>
                                        )}
                                        {cliente.email && (
                                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                                <Mail size={14} className="text-gray-400 shrink-0" />
                                                <span className="truncate">{cliente.email}</span>
                                            </div>
                                        )}
                                        {cliente.direccion && (
                                            <div className="flex items-start gap-2 text-xs text-gray-600">
                                                <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
                                                <span className="line-clamp-2">{cliente.direccion}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <p className="text-gray-400 font-medium mb-0.5 flex items-center gap-1"><ShoppingBag size={10}/> Compras</p>
                                        <p className="font-bold text-gray-900">{cliente.cantidad_compras}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 font-medium mb-0.5 flex items-center gap-1"><ShieldCheck size={10}/> Valor Total</p>
                                        <p className="font-bold text-indigo-600 font-mono">{formatMoney(cliente.total_compras)}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Modal ── */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
                        >
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                    {editingCliente ? <Edit2 size={20} className="text-indigo-600"/> : <Plus size={20} className="text-indigo-600"/>}
                                    {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
                                </h2>
                                <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 bg-white hover:bg-gray-100 p-1.5 rounded-xl transition-colors shadow-sm border border-gray-200">
                                    <X size={18} />
                                </button>
                            </div>
                            
                            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Nombre o Razón Social *</label>
                                    <input 
                                        type="text" required autoFocus
                                        value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})}
                                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm font-medium"
                                        placeholder="Ej: Juan Pérez o Empresa S.A."
                                    />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">NIT / CI</label>
                                        <input 
                                            type="text" 
                                            value={formData.nit_ci} onChange={e => setFormData({...formData, nit_ci: e.target.value})}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm font-mono"
                                            placeholder="Documento"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Teléfono</label>
                                        <input 
                                            type="tel" 
                                            value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm font-mono"
                                            placeholder="Ej: 71234567"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Email</label>
                                    <input 
                                        type="email" 
                                        value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                        placeholder="correo@ejemplo.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Dirección</label>
                                    <textarea 
                                        value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})}
                                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm resize-none"
                                        placeholder="Dirección física..."
                                        rows={2}
                                    />
                                </div>

                                <div className="mt-4 flex gap-3">
                                    <button 
                                        type="button" onClick={closeModal}
                                        className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={createMut.isPending || updateMut.isPending}
                                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors shadow-md shadow-indigo-200 disabled:opacity-50"
                                    >
                                        {createMut.isPending || updateMut.isPending ? 'Guardando...' : 'Guardar Cliente'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
