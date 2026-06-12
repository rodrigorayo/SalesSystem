import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMealPlanTemplates, createMealPlanTemplate, updateMealPlanTemplate, deleteMealPlanTemplate } from '../api/api';
import { Plus, Trash2, Loader2, CalendarRange, X, Edit3, HeartHandshake } from 'lucide-react';
import type { MealPlanTemplate, MealPlanTemplateCreate } from '../api/types';
import { useConfirm } from '../components/ConfirmModal';


export default function MealPlansPage() {
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [cantidadComidas, setCantidadComidas] = useState(20);
    const [diasVigencia, setDiasVigencia] = useState(30);
    const [precioSugerido, setPrecioSugerido] = useState(120.00);
    const [esFlexible, setEsFlexible] = useState(true);

    // Fetch Templates
    const { data: templates, isLoading } = useQuery({
        queryKey: ['meal-plan-templates'],
        queryFn: getMealPlanTemplates
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: MealPlanTemplateCreate) => createMealPlanTemplate(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meal-plan-templates'] });
            closeModal();
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string; template: Partial<MealPlanTemplateCreate> }) => updateMealPlanTemplate(data.id, data.template),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meal-plan-templates'] });
            closeModal();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteMealPlanTemplate(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meal-plan-templates'] });
        }
    });

    const openCreateModal = () => {
        setEditingId(null);
        setNombre('');
        setDescripcion('');
        setCantidadComidas(20);
        setDiasVigencia(30);
        setPrecioSugerido(120.00);
        setEsFlexible(true);
        setIsModalOpen(true);
    };

    const openEditModal = (tpl: MealPlanTemplate) => {
        setEditingId(tpl._id);
        setNombre(tpl.nombre);
        setDescripcion(tpl.descripcion || '');
        setCantidadComidas(tpl.cantidad_comidas);
        setDiasVigencia(tpl.dias_vigencia);
        setPrecioSugerido(tpl.precio_sugerido);
        setEsFlexible(tpl.es_flexible);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const templateData: MealPlanTemplateCreate = {
            nombre,
            descripcion,
            cantidad_comidas: cantidadComidas,
            dias_vigencia: diasVigencia,
            precio_sugerido: precioSugerido,
            es_flexible: esFlexible
        };

        if (editingId) {
            updateMutation.mutate({ id: editingId, template: templateData });
        } else {
            createMutation.mutate(templateData);
        }
    };

    const filteredTemplates = (templates || []).filter(t => 
        t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto px-3 py-4 md:p-4 space-y-4 pb-20 md:pb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Planes de Comidas</h1>
                    <p className="text-gray-500 mt-1">Crea planes alimenticios mensuales o semanales que tus clientes pueden adquirir</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-bold shadow-lg hover:bg-gray-900 transition-all active:scale-95 shrink-0"
                >
                    <Plus size={20} /> Nuevo Plan
                </button>
            </div>

            {/* Buscador */}
            <div className="relative">
                <input
                    type="text"
                    placeholder="Buscar planes por nombre o descripción..."
                    className="w-full bg-white border border-gray-200 rounded-full pl-6 pr-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900 shadow-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="bg-white rounded-[40px] p-6 md:p-8 shadow-sm border border-gray-200/60">
                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTemplates.map(tpl => (
                            <div key={tpl._id} className="group p-6 bg-gray-50 rounded-3xl border border-transparent hover:border-gray-200 hover:bg-white transition-all hover:shadow-lg flex flex-col justify-between h-full relative overflow-hidden">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                                                <CalendarRange size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900 truncate max-w-[150px]" title={tpl.nombre}>{tpl.nombre}</h3>
                                                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${tpl.es_flexible ? 'bg-amber-100/50 text-amber-700' : 'bg-blue-100/50 text-blue-700'}`}>
                                                    {tpl.es_flexible ? 'Flexible' : 'Días Consecutivos'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{tpl.descripcion || 'Sin descripción'}</p>
                                    
                                    <div className="grid grid-cols-2 gap-4 mt-4 bg-white/60 p-4 rounded-2xl border border-gray-100">
                                        <div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Comidas Totales</div>
                                            <div className="text-xl font-extrabold text-gray-900">{tpl.cantidad_comidas} bowl(s)</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vigencia</div>
                                            <div className="text-xl font-extrabold text-gray-900">{tpl.dias_vigencia} días</div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-gray-900">${tpl.precio_sugerido.toFixed(2)}</span>
                                        <span className="text-xs text-gray-400 font-bold">precio sugerido</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-gray-100/60 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openEditModal(tpl)}
                                        className="p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
                                        title="Editar Plan"
                                    >
                                        <Edit3 size={15} /> Editar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (await confirm({
                                                title: '¿Eliminar plantilla de plan?',
                                                message: '¿Estás seguro de que deseas eliminar esta plantilla de plan?',
                                                type: 'danger',
                                                confirmLabel: 'Eliminar',
                                                cancelLabel: 'Cancelar'
                                            })) {
                                                deleteMutation.mutate(tpl._id);
                                            }
                                        }}
                                        className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={15} /> Eliminar
                                    </button>
                                </div>
                            </div>
                        ))}
                        {filteredTemplates.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-400">
                                <HeartHandshake size={48} className="mx-auto mb-4 opacity-20" />
                                <p>No se encontraron plantillas de planes.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] p-6 md:p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">{editingId ? 'Editar Plan' : 'Nuevo Plan de Comidas'}</h2>
                            <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Nombre del Plan</label>
                                <input
                                    type="text" required autoFocus
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                    placeholder="Ej. Plan Almuerzos Completo (20 comidas)"
                                    value={nombre}
                                    onChange={e => setNombre(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Descripción</label>
                                <textarea
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 min-h-[80px] text-gray-900"
                                    placeholder="Detalles sobre qué incluye o condiciones..."
                                    value={descripcion}
                                    onChange={e => setDescripcion(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Comidas Totales</label>
                                    <input
                                        type="number" required min="1"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                        placeholder="20"
                                        value={cantidadComidas}
                                        onChange={e => setCantidadComidas(Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Días de Vigencia</label>
                                    <input
                                        type="number" required min="1"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                        placeholder="30"
                                        value={diasVigencia}
                                        onChange={e => setDiasVigencia(Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Precio Sugerido ($)</label>
                                    <input
                                        type="number" step="0.01" min="0" required
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                        placeholder="0.00"
                                        value={precioSugerido}
                                        onChange={e => setPrecioSugerido(Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Flexibilidad</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                        value={esFlexible ? 'true' : 'false'}
                                        onChange={e => setEsFlexible(e.target.value === 'true')}
                                    >
                                        <option value="true">Flexible (El cliente elige los días)</option>
                                        <option value="false">Días Consecutivos (Automático)</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-900 transition-all flex items-center justify-center gap-2"
                            >
                                {createMutation.isPending || updateMutation.isPending ? <Loader2 className="animate-spin" /> : editingId ? 'Guardar Cambios' : 'Crear Plan'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
