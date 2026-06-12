import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    getDailyProductionReport, getMealSchedules, createMealSchedule, 
    updateMealSchedule, markScheduleAsDelivered, getRecipes, getClientes, getClientMealPlans
} from '../api/api';
import { 
    Loader2, Utensils, CheckCircle, X, Plus, ChevronLeft, ChevronRight, ClipboardList
} from 'lucide-react';
import type { MealSchedule } from '../api/types';
import { toast } from 'sonner';
import { useConfirm } from '../components/ConfirmModal';


export default function ProductionCalendarPage() {
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const today = new Date();
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed
    const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().split('T')[0]);

    // Modal state for rescheduling or editing
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState<MealSchedule | null>(null);
    const [editRecipes, setEditRecipes] = useState<string[]>([]);

    // Modal state for scheduling new bowl
    const [isNewScheduleModalOpen, setIsNewScheduleModalOpen] = useState(false);
    const [selectedCliente, setSelectedCliente] = useState<string>('');
    const [selectedPlanId, setSelectedPlanId] = useState<string>('');
    const [newScheduleDate, setNewScheduleDate] = useState<string>(today.toISOString().split('T')[0]);
    const [newScheduleRecipes, setNewScheduleRecipes] = useState<string[]>([]);
    const [clientSearch, setClientSearch] = useState('');

    // Fetch recipes for dropdown selection
    const { data: recipes } = useQuery({
        queryKey: ['recipes'],
        queryFn: getRecipes
    });

    // Fetch clients for dropdown selection
    const { data: clients } = useQuery({
        queryKey: ['clients-for-scheduler', clientSearch],
        queryFn: () => getClientes(clientSearch),
        enabled: isNewScheduleModalOpen
    });

    // Fetch active plans for selected client
    const { data: clientPlans } = useQuery({
        queryKey: ['client-plans-for-scheduler', selectedCliente],
        queryFn: () => getClientMealPlans(selectedCliente),
        enabled: isNewScheduleModalOpen && !!selectedCliente
    });

    const { data: monthSchedules } = useQuery({
        queryKey: ['meal-schedules-month', currentYear, currentMonth],
        queryFn: () => getMealSchedules({})
    });

    // Fetch details for selected day
    const { data: dailyReport, isLoading: isLoadingReport } = useQuery({
        queryKey: ['daily-production-report', selectedDate],
        queryFn: () => getDailyProductionReport(selectedDate)
    });

    const { data: dailySchedules, isLoading: isLoadingDailySchedules } = useQuery({
        queryKey: ['meal-schedules-day', selectedDate],
        queryFn: () => getMealSchedules({ fecha_programada: selectedDate })
    });

    // Mutations
    const deliverMutation = useMutation({
        mutationFn: (id: string) => markScheduleAsDelivered(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meal-schedules-day'] });
            queryClient.invalidateQueries({ queryKey: ['meal-schedules-month'] });
            queryClient.invalidateQueries({ queryKey: ['daily-production-report'] });
        }
    });

    const updateScheduleMutation = useMutation({
        mutationFn: (data: { id: string; update: any }) => updateMealSchedule(data.id, data.update),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meal-schedules-day'] });
            queryClient.invalidateQueries({ queryKey: ['meal-schedules-month'] });
            queryClient.invalidateQueries({ queryKey: ['daily-production-report'] });
            setIsEditModalOpen(false);
        }
    });

    const createScheduleMutation = useMutation({
        mutationFn: (data: any) => createMealSchedule(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meal-schedules-day'] });
            queryClient.invalidateQueries({ queryKey: ['meal-schedules-month'] });
            queryClient.invalidateQueries({ queryKey: ['daily-production-report'] });
            setIsNewScheduleModalOpen(false);
            // Reset fields
            setSelectedCliente('');
            setSelectedPlanId('');
            setNewScheduleRecipes([]);
        }
    });

    const handleMonthChange = (direction: 'prev' | 'next') => {
        if (direction === 'prev') {
            if (currentMonth === 0) {
                setCurrentMonth(11);
                setCurrentYear(currentYear - 1);
            } else {
                setCurrentMonth(currentMonth - 1);
            }
        } else {
            if (currentMonth === 11) {
                setCurrentMonth(0);
                setCurrentYear(currentYear + 1);
            } else {
                setCurrentMonth(currentMonth + 1);
            }
        }
    };

    // Calculate calendar days
    const days = [];
    const date = new Date(currentYear, currentMonth, 1);
    const startDay = date.getDay(); // 0 = Sun, 1 = Mon...
    const padding = startDay === 0 ? 6 : startDay - 1; // Mon=0, Sun=6
    for (let i = 0; i < padding; i++) {
        days.push(null);
    }
    while (date.getMonth() === currentMonth) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }

    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    // Group month schedules by date for badge display
    const schedulesByDate: Record<string, number> = {};
    if (monthSchedules) {
        monthSchedules.forEach(s => {
            if (s.estado === 'PROGRAMADO') {
                schedulesByDate[s.fecha_programada] = (schedulesByDate[s.fecha_programada] || 0) + 1;
            }
        });
    }

    const handleDeliver = async (id: string) => {
        if (await confirm({
            title: '¿Marcar como entregado?',
            message: 'Esto descontará automáticamente los ingredientes del inventario.',
            type: 'info',
            confirmLabel: 'Entregar',
            cancelLabel: 'Cancelar'
        })) {
            deliverMutation.mutate(id);
        }
    };

    const handlePostpone = (s: MealSchedule) => {
        const motivo = prompt('Especifica el motivo de postergación (opcional):');
        updateScheduleMutation.mutate({
            id: s._id,
            update: { estado: 'POSTPERGADO', motivo_postergacion: motivo || 'Postergado por el usuario' }
        });
    };

    const handleOpenEditModal = (s: MealSchedule) => {
        setSelectedSchedule(s);
        setEditRecipes(s.recetas_ids || []);
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = () => {
        if (!selectedSchedule) return;
        updateScheduleMutation.mutate({
            id: selectedSchedule._id,
            update: { recetas_ids: editRecipes }
        });
    };

    const handleCreateScheduleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCliente || !selectedPlanId || newScheduleRecipes.length === 0) {
            toast.warning('Por favor selecciona un cliente, su plan de comida, e introduce al menos una receta para el bowl.');
            return;
        }

        createScheduleMutation.mutate({
            cliente_id: selectedCliente,
            client_meal_plan_id: selectedPlanId,
            fecha_programada: newScheduleDate,
            recetas_ids: newScheduleRecipes
        });
    };

    return (
        <div className="max-w-7xl mx-auto px-3 py-4 md:p-4 space-y-4 pb-20 md:pb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Calendario de Producción</h1>
                    <p className="text-gray-500 mt-1">Planifica la cocina y gestiona las entregas diarias a clientes</p>
                </div>
                <button
                    onClick={() => setIsNewScheduleModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-bold shadow-lg hover:bg-gray-900 transition-all active:scale-95 shrink-0"
                >
                    <Plus size={20} /> Programar Bowl
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Calendario Grid */}
                <div className="lg:col-span-2 bg-white rounded-[40px] p-6 shadow-sm border border-gray-200/60">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900">{monthNames[currentMonth]} {currentYear}</h2>
                        <div className="flex gap-2">
                            <button onClick={() => handleMonthChange('prev')} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
                                <ChevronLeft size={20} />
                            </button>
                            <button onClick={() => handleMonthChange('next')} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Días de la semana */}
                    <div className="grid grid-cols-7 gap-2 text-center mb-2">
                        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
                            <span key={d} className="text-xs font-bold text-gray-400 uppercase tracking-wider">{d}</span>
                        ))}
                    </div>

                    {/* Días del mes */}
                    <div className="grid grid-cols-7 gap-2">
                        {days.map((d, index) => {
                            if (!d) return <div key={index} className="aspect-square bg-gray-50/50 rounded-2xl" />;
                            
                            const dateStr = d.toISOString().split('T')[0];
                            const isSelected = selectedDate === dateStr;
                            const isToday = today.toISOString().split('T')[0] === dateStr;
                            const programadosCount = schedulesByDate[dateStr] || 0;

                            return (
                                <button
                                    key={index}
                                    onClick={() => setSelectedDate(dateStr)}
                                    className={`aspect-square p-2 rounded-2xl border flex flex-col justify-between items-start transition-all hover:scale-[1.02] active:scale-[0.98] ${
                                        isSelected 
                                            ? 'bg-black border-black text-white shadow-lg shadow-black/10'
                                            : isToday
                                                ? 'bg-gray-100 border-gray-300 text-gray-900'
                                                : 'bg-white border-gray-100 text-gray-900 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="text-sm font-extrabold">{d.getDate()}</span>
                                    {programadosCount > 0 && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${
                                            isSelected ? 'bg-white text-black' : 'bg-emerald-500 text-white'
                                        }`}>
                                            {programadosCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Reportes de Producción / BOM / Entregas */}
                <div className="space-y-6">
                    {/* Consolidado de Ingredientes (BOM) */}
                    <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-200/60">
                        <div className="flex items-center gap-2 mb-4">
                            <ClipboardList className="text-emerald-600" size={20} />
                            <h2 className="text-lg font-bold text-gray-900">Ingredientes necesarios ({selectedDate})</h2>
                        </div>

                        {isLoadingReport ? (
                            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-400" /></div>
                        ) : (
                            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                                {dailyReport?.ingredients?.map((ing: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                                        <div>
                                            <div className="text-xs font-bold text-gray-900">{ing.descripcion}</div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase">{ing.tipo_almacen_origen}</div>
                                        </div>
                                        <div className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                                            {ing.cantidad_total.toFixed(3)} {ing.unidad}
                                        </div>
                                    </div>
                                ))}
                                {(!dailyReport?.ingredients || dailyReport.ingredients.length === 0) && (
                                    <div className="text-center py-6 text-gray-400 text-xs italic">
                                        No hay ingredientes consolidados para este día.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Entregas y Schedules */}
                    <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-200/60">
                        <div className="flex items-center gap-2 mb-4">
                            <Utensils className="text-indigo-600" size={20} />
                            <h2 className="text-lg font-bold text-gray-900">Entregas del Día ({selectedDate})</h2>
                        </div>

                        {isLoadingDailySchedules ? (
                            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-400" /></div>
                        ) : (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                {dailySchedules?.map(s => (
                                    <div key={s._id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="text-sm font-bold text-gray-900">{s.client_name}</div>
                                                <div className="text-[10px] text-gray-400">Recetas: {s.recipe_names?.join(', ') || 'Sin seleccionar'}</div>
                                            </div>
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${
                                                s.estado === 'ENTREGADO' 
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : s.estado === 'POSTPERGADO'
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-indigo-100 text-indigo-700'
                                            }`}>
                                                {s.estado}
                                            </span>
                                        </div>

                                        {s.estado === 'PROGRAMADO' && (
                                            <div className="flex gap-2 justify-end pt-2 border-t border-gray-200/50">
                                                <button
                                                    onClick={() => handleOpenEditModal(s)}
                                                    className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    Editar Recetas
                                                </button>
                                                <button
                                                    onClick={() => handlePostpone(s)}
                                                    className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    Posponer
                                                </button>
                                                <button
                                                    onClick={() => handleDeliver(s._id)}
                                                    className="px-2.5 py-1.5 bg-black hover:bg-gray-900 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                                >
                                                    Entregar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(!dailySchedules || dailySchedules.length === 0) && (
                                    <div className="text-center py-8 text-gray-400 text-xs italic">
                                        No hay entregas programadas para este día.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal: Editar Recetas del Bowl */}
            {isEditModalOpen && selectedSchedule && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] p-6 md:p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Editar Recetas en Bowl</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="space-y-4 mb-6">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Recetas / Componentes</label>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {recipes?.map(r => {
                                    const isSelected = editRecipes.includes(r._id);
                                    return (
                                        <button
                                            key={r._id}
                                            type="button"
                                            onClick={() => {
                                                if (isSelected) {
                                                    setEditRecipes(editRecipes.filter(id => id !== r._id));
                                                } else {
                                                    setEditRecipes([...editRecipes, r._id]);
                                                }
                                            }}
                                            className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex justify-between items-center transition-colors ${
                                                isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-100 text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            {r.nombre}
                                            {isSelected && <CheckCircle size={16} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            onClick={handleSaveEdit}
                            disabled={updateScheduleMutation.isPending}
                            className="w-full bg-black text-white py-3.5 rounded-xl font-bold hover:bg-gray-900 transition-all flex items-center justify-center gap-2"
                        >
                            {updateScheduleMutation.isPending ? <Loader2 className="animate-spin" /> : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>
            )}

            {/* Modal: Programar Bowl Manual (Nuevo Schedule) */}
            {isNewScheduleModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] p-6 md:p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Programar Bowl</h2>
                            <button onClick={() => setIsNewScheduleModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateScheduleSubmit} className="space-y-4">
                            {/* Buscar cliente */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Buscar Cliente</label>
                                <input
                                    type="text"
                                    placeholder="Nombre, NIT o teléfono..."
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900 mb-2"
                                    value={clientSearch}
                                    onChange={e => setClientSearch(e.target.value)}
                                />
                                <select
                                    required
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                    value={selectedCliente}
                                    onChange={e => setSelectedCliente(e.target.value)}
                                >
                                    <option value="">-- Seleccionar Cliente --</option>
                                    {clients?.map(c => (
                                        <option key={c._id} value={c._id}>{c.nombre} ({c.telefono || 'sin tel.'})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Seleccionar Plan Activo */}
                            {selectedCliente && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Plan de Comidas del Cliente</label>
                                    <select
                                        required
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                        value={selectedPlanId}
                                        onChange={e => setSelectedPlanId(e.target.value)}
                                    >
                                        <option value="">-- Seleccionar Plan --</option>
                                        {clientPlans?.map(p => (
                                            <option key={p._id} value={p._id}>{p.template_name} ({p.comidas_consumidas}/{p.comidas_totales} comidas)</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Seleccionar Fecha */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Fecha Programada</label>
                                <input
                                    type="date" required
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-black/5 text-gray-900"
                                    value={newScheduleDate}
                                    onChange={e => setNewScheduleDate(e.target.value)}
                                />
                            </div>

                            {/* Seleccionar Recetas */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Componentes del Bowl</label>
                                <div className="space-y-1 max-h-[120px] overflow-y-auto bg-gray-50 p-2.5 rounded-xl border border-gray-150">
                                    {recipes?.map(r => {
                                        const isSelected = newScheduleRecipes.includes(r._id);
                                        return (
                                            <button
                                                key={r._id}
                                                type="button"
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setNewScheduleRecipes(newScheduleRecipes.filter(id => id !== r._id));
                                                    } else {
                                                        setNewScheduleRecipes([...newScheduleRecipes, r._id]);
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
        </div>
    );
}
