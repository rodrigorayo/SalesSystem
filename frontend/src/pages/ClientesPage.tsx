import React, { useState } from 'react';
import { 
    Users, Search, Plus, Edit2, Trash2, Mail, Phone, MapPin, CreditCard, 
    X, ShoppingBag, ShieldCheck, HeartHandshake, CheckCircle, Calendar, Loader2
} from 'lucide-react';
import { useClientes, useCreateCliente, useUpdateCliente, useDeleteCliente } from '../hooks/useClientes';
import { toast } from 'sonner';
import { useConfirm } from '../components/ConfirmModal';

import type { Cliente } from '../api/clientes';
import { getClientMealPlans, assignPlanToClient, getMealPlanTemplates, getMealSchedules, createMealSchedule, getRecipes } from '../api/api';
import type { ClientMealPlan, MealSchedule } from '../api/types';
import { useQuery, useMutation } from '@tanstack/react-query';
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
    const confirm = useConfirm();
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch] = useDebounce(searchTerm, 500);
    const [page] = useState(1);
    
    // API
    const { data: clientes = [], isLoading } = useClientes(page, 50, debouncedSearch);
    const createMut = useCreateCliente();
    const updateMut = useUpdateCliente();
    const deleteMut = useDeleteCliente();

    // Details/Plans state
    const [selectedClienteDetails, setSelectedClienteDetails] = useState<Cliente | null>(null);
    const [detailsTab, setDetailsTab] = useState<'info' | 'planes'>('info');
    
    // Plan assignment/schedule state
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignTemplateId, setAssignTemplateId] = useState('');
    
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [schedulePlanId, setSchedulePlanId] = useState('');
    const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
    const [scheduleRecipes, setScheduleRecipes] = useState<string[]>([]);

    // Modal state for Edit/Create
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

    // Queries for client plans (only active when details modal is open)
    const { data: clientPlans, refetch: refetchPlans } = useQuery({
        queryKey: ['client-plans-crm', selectedClienteDetails?._id],
        queryFn: () => getClientMealPlans(selectedClienteDetails!._id),
        enabled: !!selectedClienteDetails
    });

    // Queries for client schedules (only active when details modal is open)
    const { data: clientSchedules, refetch: refetchSchedules } = useQuery({
        queryKey: ['client-schedules-crm', selectedClienteDetails?._id],
        queryFn: () => getMealSchedules({ cliente_id: selectedClienteDetails!._id }),
        enabled: !!selectedClienteDetails
    });

    // Fetch recipes for scheduling dropdown
    const { data: recipes } = useQuery({
        queryKey: ['recipes-for-crm'],
        queryFn: getRecipes,
        enabled: showScheduleModal
    });

    // Fetch meal templates for assignment dropdown
    const { data: planTemplates } = useQuery({
        queryKey: ['plan-templates-for-crm'],
        queryFn: getMealPlanTemplates,
        enabled: showAssignModal
    });

    // Mutations for CRM
    const assignPlanMutation = useMutation({
        mutationFn: (data: { templateId: string }) => 
            assignPlanToClient(selectedClienteDetails!._id, data.templateId),
        onSuccess: () => {
            refetchPlans();
            setShowAssignModal(false);
            setAssignTemplateId('');
        }
    });

    const createScheduleMutation = useMutation({
        mutationFn: (data: { planId: string; date: string; recipes: string[] }) =>
            createMealSchedule({
                cliente_id: selectedClienteDetails!._id,
                client_meal_plan_id: data.planId,
                fecha_programada: data.date,
                recetas_ids: data.recipes
            }),
        onSuccess: () => {
            refetchSchedules();
            setShowScheduleModal(false);
            setSchedulePlanId('');
            setScheduleRecipes([]);
        }
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

    const handleDelete = async (id: string, nombre: string) => {
        if (await confirm({
            title: '¿Eliminar cliente?',
            message: `¿Estás seguro de eliminar a ${nombre}?`,
            type: 'danger',
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar'
        })) {
            deleteMut.mutate(id);
        }
    };

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount);
    };

    const handleAssignPlanSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignTemplateId) return;
        assignPlanMutation.mutate({ templateId: assignTemplateId });
    };

    const handleScheduleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!schedulePlanId || scheduleRecipes.length === 0) {
            toast.warning('Por favor selecciona un plan y al menos una receta.');
            return;
        }
        createScheduleMutation.mutate({
            planId: schedulePlanId,
            date: scheduleDate,
            recipes: scheduleRecipes
        });
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
                                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg hover:border-gray-300 transition-all group flex flex-col cursor-pointer"
                                onClick={() => {
                                    setSelectedClienteDetails(cliente);
                                    setDetailsTab('info');
                                }}
                            >
                                <div className="p-5 flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-50 flex items-center justify-center text-indigo-700 font-black text-lg">
                                            {cliente.nombre.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
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

            {/* ── Details & Meal Plans Modal ── */}
            <AnimatePresence>
                {selectedClienteDetails && (
                    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[600px]"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-black text-lg">
                                        {selectedClienteDetails.nombre.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-gray-900 leading-tight">{selectedClienteDetails.nombre}</h2>
                                        <p className="text-xs text-gray-500 font-medium mt-0.5">Expediente de Cliente</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedClienteDetails(null)} className="text-gray-400 hover:text-gray-700 bg-white hover:bg-gray-100 p-1.5 rounded-xl transition-colors shadow-sm border border-gray-200">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Tabs Navigation */}
                            <div className="flex border-b border-gray-100 px-6 shrink-0 bg-white">
                                <button 
                                    onClick={() => setDetailsTab('info')} 
                                    className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                                        detailsTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                                    }`}
                                >
                                    Información General
                                </button>
                                <button 
                                    onClick={() => setDetailsTab('planes')} 
                                    className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                                        detailsTab === 'planes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                                    }`}
                                >
                                    Planes de Comida (Dark Kitchen)
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-gray-50/30">
                                {detailsTab === 'info' ? (
                                    <div className="space-y-4">
                                        <div className="bg-white p-5 rounded-2xl border border-gray-200/60 shadow-sm grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">NIT / CI</div>
                                                <div className="text-sm font-semibold text-gray-900 font-mono">{selectedClienteDetails.nit_ci || 'No registrado'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Teléfono</div>
                                                <div className="text-sm font-semibold text-gray-900">{selectedClienteDetails.telefono || 'No registrado'}</div>
                                            </div>
                                            <div className="col-span-2">
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Email</div>
                                                <div className="text-sm font-semibold text-gray-900">{selectedClienteDetails.email || 'No registrado'}</div>
                                            </div>
                                            <div className="col-span-2">
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Dirección</div>
                                                <div className="text-sm font-semibold text-gray-900 leading-relaxed">{selectedClienteDetails.direccion || 'No registrada'}</div>
                                            </div>
                                        </div>

                                        <div className="bg-white p-5 rounded-2xl border border-gray-200/60 shadow-sm">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Notas del Cliente</div>
                                            <div className="text-xs text-gray-600 leading-relaxed italic">{selectedClienteDetails.notas || 'Sin notas adicionales.'}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Action buttons */}
                                        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200/60 shadow-sm">
                                            <h3 className="text-sm font-bold text-gray-800">Planes contratados</h3>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setShowAssignModal(true)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all"
                                                >
                                                    <HeartHandshake size={14} /> Asignar Plan
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (!clientPlans || clientPlans.length === 0) {
                                                            toast.warning('El cliente debe tener al menos un plan activo para programarle entregas.');
                                                            return;
                                                        }
                                                        setSchedulePlanId(clientPlans[0]._id);
                                                        setShowScheduleModal(true);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-lg text-xs font-bold hover:bg-gray-800 transition-all shadow-sm"
                                                >
                                                    <Calendar size={14} /> Programar Entrega
                                                </button>
                                            </div>
                                        </div>

                                        {/* Active plans list */}
                                        <div className="space-y-3">
                                            {clientPlans?.map((plan: ClientMealPlan) => (
                                                <div key={plan._id} className="bg-white p-5 rounded-2xl border border-gray-200/60 shadow-sm flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-gray-900">{plan.template_name}</h4>
                                                        <div className="flex gap-4 mt-2">
                                                            <div>
                                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Consumido</span>
                                                                <span className="text-sm font-extrabold text-gray-900">{plan.comidas_consumidas} / {plan.comidas_totales} comidas</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Fecha Fin (Est.)</span>
                                                                <span className="text-sm font-semibold text-gray-900">{new Date(plan.fecha_fin_estimada).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase ${
                                                        plan.estado === 'ACTIVO' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {plan.estado}
                                                    </span>
                                                </div>
                                            ))}
                                            {(!clientPlans || clientPlans.length === 0) && (
                                                <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 text-xs italic">
                                                    Este cliente no tiene ningún plan de comidas asignado.
                                                </div>
                                            )}
                                        </div>

                                        {/* Schedules / Deliveries History */}
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-bold text-gray-800">Calendario Personal / Entregas</h3>
                                            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm divide-y divide-gray-100">
                                                {clientSchedules?.map((sch: MealSchedule) => (
                                                    <div key={sch._id} className="p-4 flex justify-between items-center text-xs">
                                                        <div>
                                                            <div className="font-bold text-gray-900">{sch.fecha_programada}</div>
                                                            <div className="text-[10px] text-gray-400">Recetas: {sch.recipe_names?.join(', ') || 'Sin recetas'}</div>
                                                        </div>
                                                        <span className={`px-2.5 py-0.5 rounded-full font-black uppercase text-[9px] ${
                                                            sch.estado === 'ENTREGADO' 
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : sch.estado === 'POSTPERGADO'
                                                                    ? 'bg-amber-100 text-amber-700'
                                                                    : 'bg-indigo-100 text-indigo-700'
                                                        }`}>
                                                            {sch.estado}
                                                        </span>
                                                    </div>
                                                ))}
                                                {(!clientSchedules || clientSchedules.length === 0) && (
                                                    <div className="p-6 text-center text-gray-400 italic">
                                                        No hay comidas programadas en el calendario.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal: Asignar Plan Manual */}
            {showAssignModal && selectedClienteDetails && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] p-6 md:p-8 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Asignar Plan de Comida</h2>
                            <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAssignPlanSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Plantilla de Plan</label>
                                <select
                                    required
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                    value={assignTemplateId}
                                    onChange={e => setAssignTemplateId(e.target.value)}
                                >
                                    <option value="">-- Seleccionar Plantilla --</option>
                                    {planTemplates?.map(tpl => (
                                        <option key={tpl._id} value={tpl._id}>{tpl.nombre} ({tpl.cantidad_comidas} comidas, ${tpl.precio_sugerido})</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={assignPlanMutation.isPending}
                                className="w-full bg-black text-white py-3.5 rounded-xl font-bold hover:bg-gray-900 transition-all flex items-center justify-center gap-2"
                            >
                                {assignPlanMutation.isPending ? <Loader2 className="animate-spin" /> : 'Asignar Plan'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Programar Entrega/Comida */}
            {showScheduleModal && selectedClienteDetails && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] p-6 md:p-8 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Programar Bowl</h2>
                            <button onClick={() => setShowScheduleModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleScheduleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Plan de Comida Activo</label>
                                <select
                                    required
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                    value={schedulePlanId}
                                    onChange={e => setSchedulePlanId(e.target.value)}
                                >
                                    <option value="">-- Seleccionar Plan --</option>
                                    {clientPlans?.map(p => (
                                        <option key={p._id} value={p._id}>{p.template_name} ({p.comidas_consumidas}/{p.comidas_totales} comidas)</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Fecha Programada</label>
                                <input
                                    type="date" required
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                    value={scheduleDate}
                                    onChange={e => setScheduleDate(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Componentes del Bowl</label>
                                <div className="space-y-1 max-h-[100px] overflow-y-auto bg-gray-50 p-2.5 rounded-xl border border-gray-150">
                                    {recipes?.map(r => {
                                        const isSelected = scheduleRecipes.includes(r._id);
                                        return (
                                            <button
                                                key={r._id}
                                                type="button"
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setScheduleRecipes(scheduleRecipes.filter(id => id !== r._id));
                                                    } else {
                                                        setScheduleRecipes([...scheduleRecipes, r._id]);
                                                    }
                                                }}
                                                className={`w-full text-left px-3 py-1.5 rounded-lg text-[10px] font-semibold flex justify-between items-center transition-colors mb-1 ${
                                                    isSelected ? 'bg-indigo-50 border border-indigo-200 text-indigo-700' : 'bg-white border border-transparent text-gray-700 hover:bg-gray-100'
                                                }`}
                                            >
                                                {r.nombre}
                                                {isSelected && <CheckCircle size={12} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={createScheduleMutation.isPending}
                                className="w-full bg-black text-white py-3.5 rounded-xl font-bold hover:bg-gray-900 transition-all flex items-center justify-center gap-2"
                            >
                                {createScheduleMutation.isPending ? <Loader2 className="animate-spin" /> : 'Programar Bowl'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Edit/Create Modal ── */}
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
