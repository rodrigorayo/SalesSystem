import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../../api/api';
import { toast } from 'sonner';
import { Plus, Check, Loader2, Trash2, Calculator, Layers, Edit2, Save } from 'lucide-react';

const FEATURE_PRICES: Record<string, { label: string; price: number; type: 'core' | 'pro' | 'enterprise' }> = {
    'VENTAS': { label: 'Ventas y POS', price: 15, type: 'core' },
    'INVENTARIO': { label: 'Inventario Completo', price: 15, type: 'core' },
    'CAJA': { label: 'Caja Básica', price: 10, type: 'core' },
    'CLIENTES': { label: 'CRM Clientes', price: 10, type: 'core' },
    'CREDITOS': { label: 'Módulo Créditos', price: 15, type: 'core' },
    
    'CAJA_AVANZADA': { label: 'Caja Avanzada (Arqueos)', price: 15, type: 'pro' },
    'DESCUENTOS_AVANZADOS': { label: 'Descuentos Dinámicos', price: 15, type: 'pro' },
    'LISTAS_PRECIOS': { label: 'Listas de Precios', price: 10, type: 'pro' },
    'REPORTES_AVANZADOS': { label: 'Reportes y BI', price: 20, type: 'pro' },
    'AUDITORIA': { label: 'Auditoría / Log', price: 10, type: 'pro' },
    
    'MULTI_SUCURSAL': { label: 'Gestión Multi-Sucursal', price: 40, type: 'enterprise' },
    'PEDIDOS_INTERNOS': { label: 'Logística / Pedidos', price: 30, type: 'enterprise' },
    'CONTROL_QR': { label: 'Control Validación QR', price: 15, type: 'enterprise' },
    'API_ACCESO': { label: 'Acceso a API externa', price: 50, type: 'enterprise' },
    'PRICE_REQUESTS': { label: 'Solicitudes de Precio', price: 10, type: 'enterprise' }
};

interface PlanBuilderProps {
    existingPlans: any[];
}

export default function PlanBuilder({ existingPlans }: PlanBuilderProps) {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
    const [manualPrice, setManualPrice] = useState<string>('');
    const [maxSucursales, setMaxSucursales] = useState<string>('1');
    const [maxUsuariosPorSucursal, setMaxUsuariosPorSucursal] = useState<string>('5');
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'catalog' | 'builder'>('catalog');

    const resetForm = () => {
        setEditingPlanId(null);
        setName('');
        setSelectedFeatures([]);
        setManualPrice('');
        setMaxSucursales('1');
        setMaxUsuariosPorSucursal('5');
        setActiveTab('catalog');
    };

    // Calculadora Automática
    const recommendedPrice = useMemo(() => {
        return selectedFeatures.reduce((acc, feat) => acc + (FEATURE_PRICES[feat]?.price || 0), 0);
    }, [selectedFeatures]);

    const finalPrice = manualPrice !== '' ? parseFloat(manualPrice) : recommendedPrice;

    const toggleFeature = (feat: string) => {
        if (selectedFeatures.includes(feat)) {
            setSelectedFeatures(selectedFeatures.filter(f => f !== feat));
        } else {
            setSelectedFeatures([...selectedFeatures, feat]);
        }
    };

    const selectAll = () => setSelectedFeatures(Object.keys(FEATURE_PRICES));
    const clearAll = () => setSelectedFeatures([]);

    const createPlanMutation = useMutation({
        mutationFn: async () => {
            if (!name.trim()) throw new Error('El plan necesita un nombre');
            if (selectedFeatures.length === 0) throw new Error('Debes seleccionar al menos 1 módulo');
            
            return client('/tenants/admin/plans', {
                method: 'POST',
                body: {
                    name: name.trim(),
                    max_sucursales: parseInt(maxSucursales, 10),
                    max_usuarios_por_sucursal: parseInt(maxUsuariosPorSucursal, 10),
                    features: selectedFeatures,
                    precio_mensual: finalPrice
                }
            });
        },
        onSuccess: () => {
            toast.success("Plan Atómico creado exitosamente");
            queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
            resetForm();
        },
        onError: (err: any) => {
            toast.error(err.message || "Error al crear el plan");
        }
    });

    const updatePlanMutation = useMutation({
        mutationFn: async () => {
            if (!name.trim()) throw new Error('El plan necesita un nombre');
            if (selectedFeatures.length === 0) throw new Error('Debes seleccionar al menos 1 módulo');
            if (!editingPlanId) throw new Error('No hay plan en edición');
            
            return client(`/tenants/admin/plans/${editingPlanId}`, {
                method: 'PUT',
                body: {
                    name: name.trim(),
                    max_sucursales: parseInt(maxSucursales, 10),
                    max_usuarios_por_sucursal: parseInt(maxUsuariosPorSucursal, 10),
                    features: selectedFeatures,
                    precio_mensual: finalPrice
                }
            });
        },
        onSuccess: () => {
            toast.success("Plan actualizado exitosamente");
            queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
            resetForm();
        },
        onError: (err: any) => {
            toast.error(err.message || "Error al crear el plan");
        }
    });

    const deletePlanMutation = useMutation({
        mutationFn: (planId: string) => client(`/tenants/admin/plans/${planId}`, { method: 'DELETE' }),
        onSuccess: () => {
            toast.success("Plan eliminado");
            queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
        },
        onError: (err: any) => toast.error(err.message || "Error al eliminar (Puede estar en uso)")
    });



    const handleEdit = (plan: any) => {
        setEditingPlanId(plan.id);
        setName(plan.name);
        setSelectedFeatures(plan.features);
        setManualPrice(plan.precio_mensual?.toString() || '');
        setMaxSucursales(plan.max_sucursales?.toString() || '-1');
        setMaxUsuariosPorSucursal(plan.max_usuarios_por_sucursal?.toString() || '-1');
        setActiveTab('builder');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-100 mt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                        <Layers size={24} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-gray-900">Gestión de Planes</h3>
                        <p className="text-gray-500 font-medium">Administra tu catálogo o diseña nuevos planes</p>
                    </div>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-2xl">
                    <button 
                        onClick={() => { setActiveTab('catalog'); setEditingPlanId(null); }}
                        className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'catalog' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        Catálogo Actual
                    </button>
                    <button 
                        onClick={() => setActiveTab('builder')}
                        className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'builder' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        {editingPlanId ? 'Editando Plan' : 'Crear Plan'}
                    </button>
                </div>
            </div>

            {activeTab === 'builder' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
                    {/* Formulario (2 Columnas) */}
                    <div className="lg:col-span-2 space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nombre del Plan</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                placeholder="Ej. Emprendedor Básico" 
                                className="w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl text-gray-900 font-bold focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Máx. Sucursales (-1 ilimitado)</label>
                                <input 
                                    type="number" 
                                    value={maxSucursales} 
                                    onChange={e => setMaxSucursales(e.target.value)} 
                                    className="w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl text-gray-900 font-bold focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Personal por Sucursal (-1 ilim.)</label>
                                <input 
                                    type="number" 
                                    value={maxUsuariosPorSucursal} 
                                    onChange={e => setMaxUsuariosPorSucursal(e.target.value)} 
                                    className="w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl text-gray-900 font-bold focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Módulos (Vistas Atómicas)</label>
                                <div className="flex gap-2 text-xs font-bold">
                                    <button onClick={selectAll} className="text-indigo-600 hover:underline">Seleccionar Todos</button>
                                    <span className="text-gray-300">|</span>
                                    <button onClick={clearAll} className="text-gray-400 hover:text-red-500">Limpiar</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {Object.entries(FEATURE_PRICES).map(([code, meta]) => {
                                    const selected = selectedFeatures.includes(code);
                                    return (
                                        <button 
                                            key={code}
                                            onClick={() => toggleFeature(code)}
                                            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                                                selected 
                                                    ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                                                    : 'bg-white border-gray-100 hover:border-gray-200 opacity-75'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${selected ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-50 border-gray-200'}`}>
                                                    {selected && <Check size={12} className="text-white" />}
                                                </div>
                                                <div>
                                                    <p className={`text-xs font-bold ${selected ? 'text-indigo-900' : 'text-gray-600'}`}>{meta.label}</p>
                                                    <p className="text-[9px] text-gray-400 uppercase">{meta.type}</p>
                                                </div>
                                            </div>
                                            <div className={`text-xs font-black font-mono ${selected ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                ${meta.price}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Calculadora (1 Columna) */}
                    <div className="bg-gray-900 rounded-3xl p-6 text-white shadow-xl flex flex-col">
                        <div className="flex items-center gap-2 mb-6 text-indigo-300">
                            <Calculator size={20} />
                            <h4 className="font-bold text-sm tracking-wide uppercase">Calculadora SaaS</h4>
                        </div>

                        <div className="flex-1">
                            <div className="bg-white/10 rounded-2xl p-4 mb-4">
                                <p className="text-xs text-gray-400 font-medium mb-1">Módulos Seleccionados</p>
                                <p className="text-2xl font-black">{selectedFeatures.length}</p>
                            </div>
                            
                            <div className="bg-white/10 rounded-2xl p-4 mb-6 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                                <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider mb-1">Sugerencia Mensual</p>
                                <p className="text-4xl font-black text-white font-mono tracking-tight">${recommendedPrice}</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ajuste Manual / Descuento (Opcional)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                    <input 
                                        type="number" 
                                        value={manualPrice}
                                        onChange={e => setManualPrice(e.target.value)}
                                        placeholder={recommendedPrice.toString()}
                                        className="w-full bg-white/5 border border-white/10 px-8 py-3 rounded-xl text-white font-bold font-mono focus:bg-white/10 focus:border-indigo-400 outline-none transition-all placeholder:text-gray-600"
                                    />
                                </div>
                            </div>
                        </div>

                        {editingPlanId ? (
                            <div className="mt-6 flex flex-col gap-2">
                                <button 
                                    onClick={() => updatePlanMutation.mutate()}
                                    disabled={updatePlanMutation.isPending || selectedFeatures.length === 0}
                                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black uppercase tracking-wider text-sm transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {updatePlanMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                    Guardar Cambios
                                </button>
                                <button 
                                    onClick={resetForm}
                                    className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-2xl font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-50"
                                >
                                    Cancelar Edición
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => createPlanMutation.mutate()}
                                disabled={createPlanMutation.isPending || selectedFeatures.length === 0}
                                className="mt-6 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black uppercase tracking-wider text-sm transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {createPlanMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                                Guardar y Crear Plan
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {existingPlans.map(plan => (
                            <div key={plan.id || plan.code} className="border border-gray-200 rounded-2xl p-4 flex flex-col justify-between hover:border-gray-300 transition-colors bg-gray-50">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h5 className="font-black text-gray-900 text-lg">{plan.name}</h5>
                                        {plan.precio_mensual !== undefined && (
                                            <span className="bg-indigo-100 text-indigo-700 font-black font-mono text-xs px-2 py-1 rounded-lg">
                                                ${plan.precio_mensual}/mo
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-4 mb-3 text-xs text-gray-500 font-medium">
                                        <span>Sucursales: {plan.max_sucursales === -1 ? '∞' : plan.max_sucursales || '∞'}</span>
                                        <span>Personal: {plan.max_usuarios_por_sucursal === -1 ? '∞' : plan.max_usuarios_por_sucursal || '∞'} c/u</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-3">{plan.features.length} módulos habilitados.</p>
                                    <div className="flex flex-wrap gap-1 mb-4">
                                        {plan.features.slice(0, 5).map((f: string) => (
                                            <span key={f} className="text-[9px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded uppercase">{f}</span>
                                        ))}
                                        {plan.features.length > 5 && <span className="text-[9px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded uppercase">+{plan.features.length - 5}</span>}
                                    </div>
                                </div>
                                {!plan.is_public && plan.code !== 'ILIMITADO' && (
                                    <div className="flex items-center gap-2 self-end mt-4">
                                        <button 
                                            onClick={() => handleEdit(plan)}
                                            className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={12} /> Editar
                                        </button>
                                        <button 
                                            onClick={() => deletePlanMutation.mutate(plan.id)}
                                            disabled={deletePlanMutation.isPending}
                                            className="flex items-center gap-1 text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={12} /> Eliminar
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
