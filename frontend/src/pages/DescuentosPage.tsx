import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDescuentos, useCreateDescuento, useUpdateDescuento, useDeleteDescuento } from '../hooks/useDescuentos';
import { Tag, Plus, Loader2, Edit2, Trash2, ShieldCheck, Power, Percent, DollarSign, AlertCircle, CalendarDays, Lock, Store } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { getSucursales } from '../api/api';

export default function DescuentosPage() {
    const { role } = useAuthStore();
    const isAuthorized = role === 'ADMIN' || role === 'SUPERADMIN' || role === 'ADMIN_SUCURSAL';

    const { data: descuentos = [], isLoading } = useDescuentos();
    const createMut = useCreateDescuento();
    const updateMut = useUpdateDescuento();
    const deleteMut = useDeleteDescuento();

    const [isMultiModalOpen, setMultiModalOpen] = useState(false);

    // Form state
    const [editId, setEditId] = useState<string | null>(null);
    const [nombre, setNombre] = useState('');
    const [tipo, setTipo] = useState<'MONTO' | 'PORCENTAJE'>('PORCENTAJE');
    const [valor, setValor] = useState('');
    const [activoState, setActivoState] = useState(true);
    const [aplicaTodas, setAplicaTodas] = useState(false);
    const [isIndefinido, setIsIndefinido] = useState(true);
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [sucursalId, setSucursalId] = useState('');
    
    // Check if user is matrix admin
    const esMatriz = ['ADMIN', 'SUPERADMIN', 'ADMIN_MATRIZ'].includes(role || '');

    const { data: sucursales = [] } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales,
        enabled: esMatriz
    });

    if (!isAuthorized) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <ShieldCheck size={48} className="mb-4 opacity-20" />
                <p>No tienes acceso a este módulo.</p>
            </div>
        );
    }

    const openCreateModal = () => {
        setEditId(null);
        setNombre('');
        setTipo('PORCENTAJE');
        setValor('');
        setActivoState(true);
        setAplicaTodas(false);
        setIsIndefinido(true);
        setFechaInicio('');
        setFechaFin('');
        setSucursalId('');
        setMultiModalOpen(true);
    };

    const openEditModal = (d: any) => {
        setEditId(d._id);
        setNombre(d.nombre);
        setTipo(d.tipo);
        setValor(d.valor.toString());
        setActivoState(d.activo);
        setAplicaTodas(d.aplica_todas_sucursales || false);
        setIsIndefinido(!d.fecha_inicio && !d.fecha_fin);
        setFechaInicio(d.fecha_inicio ? d.fecha_inicio.split('T')[0] : '');
        setFechaFin(d.fecha_fin ? d.fecha_fin.split('T')[0] : '');
        setSucursalId(d.sucursal_id || '');
        setMultiModalOpen(true);
    };

    const handleSave = () => {
        if (!nombre || !valor || parseFloat(valor) <= 0) return;
        if (esMatriz && !aplicaTodas && !sucursalId) return;

        const data = {
            nombre,
            tipo,
            valor: parseFloat(valor),
            activo: activoState,
            aplica_todas_sucursales: aplicaTodas,
            sucursal_id: esMatriz ? (aplicaTodas ? undefined : sucursalId) : undefined,
            fecha_inicio: isIndefinido || !fechaInicio ? undefined : new Date(fechaInicio + 'T00:00:00').toISOString(),
            fecha_fin: isIndefinido || !fechaFin ? undefined : new Date(fechaFin + 'T23:59:59').toISOString(),
        };

        if (editId) {
            updateMut.mutate({ id: editId, data }, {
                onSuccess: () => setMultiModalOpen(false)
            });
        } else {
            createMut.mutate(data, {
                onSuccess: () => setMultiModalOpen(false)
            });
        }
    };

    const toggleActivo = (id: string, currentActivo: boolean) => {
        updateMut.mutate({ id, data: { activo: !currentActivo } });
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f2f4f7]">
            <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col min-h-0">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between shrink-0 rounded-b-2xl shadow-sm">
                    <div>
                        <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                            <Tag className="text-indigo-600" /> Descuentos Predefinidos
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">
                            Configura las reglas de descuento (porcentaje o monto fijo) permitidas en el POS de esta sucursal.
                        </p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm shadow-indigo-200 active:scale-95"
                    >
                        <Plus size={16} /> Nuevo Descuento
                    </button>
                </header>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Loader2 className="animate-spin text-indigo-600" size={32} />
                        </div>
                    ) : descuentos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-sm">
                            <Tag size={48} className="mb-4 opacity-20" />
                            <h3 className="text-lg font-bold text-gray-900">No hay descuentos configurados</h3>
                            <p className="text-sm text-gray-500 mt-1 mb-4 text-center max-w-sm">
                                El cajero no podrá aplicar rebajas en el punto de venta hasta que crees opciones predefinidas.
                            </p>
                            <button onClick={openCreateModal} className="text-indigo-600 font-bold hover:underline">
                                Crear mi primer descuento
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {descuentos.map((d: any) => {
                                const isFromMatriz = ['ADMIN', 'SUPERADMIN', 'ADMIN_MATRIZ'].includes(d.creado_por_rol);
                                const isLocked = !esMatriz && isFromMatriz;
                                
                                return (
                                <div key={d._id} className={`bg-white rounded-2xl border ${d.activo ? 'border-indigo-100 shadow-sm' : 'border-gray-200 opacity-60'} p-5 flex flex-col relative transition-all hover:shadow-md`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-2 rounded-xl ${d.tipo === 'PORCENTAJE' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                                                {d.tipo === 'PORCENTAJE' ? <Percent size={18} /> : <DollarSign size={18} />}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 leading-tight flex items-center gap-1.5">
                                                    {d.nombre} {isLocked && <span title="Controlado por Empresa"><Lock size={12} className="text-gray-400" /></span>}
                                                </h3>
                                                <p className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
                                                    {d.tipo === 'PORCENTAJE' ? 'PORCENTAJE' : 'MONTO FIJO'}
                                                    {d.aplica_todas_sucursales ? (
                                                        <span className="text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md ml-1 inline-flex items-center gap-1"><Store size={10} /> GLOBAL</span>
                                                    ) : (
                                                        <span className="text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-md ml-1 inline-flex items-center gap-1 border border-gray-100">
                                                            <Store size={10} /> 
                                                            {esMatriz ? sucursales.find((s:any) => s._id === d.sucursal_id)?.nombre || 'Específico' : 'Mi Sucursal'}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="my-2 flex flex-col">
                                        <span className="text-3xl font-black text-gray-900 tracking-tighter">
                                            {d.tipo === 'PORCENTAJE' ? '' : 'Bs. '}{d.valor}{d.tipo === 'PORCENTAJE' ? '%' : ''}
                                        </span>
                                        <span className="text-xs text-gray-500 mt-1 flex items-center gap-1 font-medium bg-gray-50 w-fit px-2 py-0.5 rounded-md border border-gray-100">
                                            <CalendarDays size={12} />
                                            {d.fecha_inicio && d.fecha_fin ? `${new Date(d.fecha_inicio).toLocaleDateString()} al ${new Date(d.fecha_fin).toLocaleDateString()}` : 'Indefinido'}
                                        </span>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                                        <button
                                            onClick={() => { if(!isLocked) toggleActivo(d._id, d.activo); }}
                                            disabled={isLocked}
                                            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${d.activo ? 'text-green-700 bg-green-50 hover:bg-green-100' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'} ${isLocked && 'opacity-50 cursor-not-allowed'}`}
                                            title={isLocked ? "Bloqueado (Matriz)" : (d.activo ? "Desactivar" : "Activar")}
                                        >
                                            <Power size={12} /> {d.activo ? 'Activo' : 'Inactivo'}
                                        </button>
                                        <div className="flex gap-2">
                                            {!isLocked && (
                                                <>
                                                <button onClick={() => openEditModal(d)} className="text-gray-400 hover:text-indigo-600 transition-colors bg-gray-50 hover:bg-indigo-50 p-1.5 rounded-lg border border-gray-100">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`¿Deseas borrar permanentemente el descuento "${d.nombre}"?`)) {
                                                            deleteMut.mutate(d._id);
                                                        }
                                                    }}
                                                    className="text-gray-400 hover:text-red-600 transition-colors bg-gray-50 hover:bg-red-50 p-1.5 rounded-lg border border-gray-100"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                </div>

                {/* Modal Crear/Editar */}
                <AnimatePresence>
                    {isMultiModalOpen && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                    <h3 className="font-bold text-gray-900">{editId ? 'Editar Descuento' : 'Nuevo Descuento'}</h3>
                                    <button onClick={() => setMultiModalOpen(false)} className="text-gray-400 hover:text-gray-600"><Trash2 size={16} className="hidden" />✕</button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre Promocional</label>
                                        <input
                                            type="text"
                                            value={nombre}
                                            onChange={e => setNombre(e.target.value)}
                                            placeholder="Ej: Tercera Edad, Lunes Loco, etc."
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-400 outline-none transition-all placeholder:text-gray-300"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tipo</label>
                                            <select
                                                value={tipo}
                                                onChange={e => setTipo(e.target.value as any)}
                                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-400 outline-none transition-all cursor-pointer font-bold"
                                            >
                                                <option value="PORCENTAJE">Porcentaje (%)</option>
                                                <option value="MONTO">Monto (Bs.)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Valor</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
                                                    {tipo === 'PORCENTAJE' ? '%' : 'Bs'}
                                                </span>
                                                <input
                                                    type="number" step="0.5" min="0.1"
                                                    value={valor}
                                                    onChange={e => setValor(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm font-black font-mono text-gray-900 focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {esMatriz && !aplicaTodas && (
                                        <div className="pt-1">
                                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Sucursal Destino</label>
                                            <select
                                                value={sucursalId}
                                                onChange={e => setSucursalId(e.target.value)}
                                                className={`w-full border rounded-xl px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-400 outline-none transition-all cursor-pointer font-bold ${!sucursalId ? 'border-red-300' : 'border-gray-200'}`}
                                            >
                                                <option value="" disabled>Seleccione una sucursal...</option>
                                                {sucursales.map(s => (
                                                    <option key={s._id} value={s._id}>{s.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {tipo === 'PORCENTAJE' && parseFloat(valor) > 50 && (
                                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 text-[11px] p-2 rounded-lg font-medium border border-amber-200">
                                            <AlertCircle size={14} className="shrink-0" />
                                            Estás configurando un descuento mayor al 50%.
                                        </div>
                                    )}

                                    {/* Dates */}
                                    <div className="pt-2 border-t border-gray-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Duración del descuento</label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="checkbox" checked={isIndefinido} onChange={() => setIsIndefinido(!isIndefinido)} className="accent-indigo-600 cursor-pointer" />
                                                <span className="text-[10px] font-bold text-gray-700">Indefinido</span>
                                            </label>
                                        </div>
                                        
                                        {!isIndefinido && (
                                            <div className="grid grid-cols-2 gap-3 mt-2">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Desde</label>
                                                    <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400 outline-none" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Hasta</label>
                                                    <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400 outline-none" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {esMatriz && (
                                        <div className="flex items-center gap-2 mt-2 bg-gray-50 border border-gray-100 p-3 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setAplicaTodas(!aplicaTodas)}>
                                            <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-all ${aplicaTodas ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>
                                                {aplicaTodas && <ShieldCheck size={12} className="text-white" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">Aplicar en todas las sucursales</p>
                                                <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Si se marca, este descuento estará disponible en el POS de cualquier sucursal.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 border-t border-gray-100 flex gap-2">
                                    <button onClick={() => setMultiModalOpen(false)} className="flex-1 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-100 transition-colors text-sm">Cancelar</button>
                                    <button
                                        onClick={handleSave}
                                        disabled={createMut.isPending || updateMut.isPending || !nombre || !valor || parseFloat(valor) <= 0 || (esMatriz && !aplicaTodas && !sucursalId)}
                                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-sm active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        {(createMut.isPending || updateMut.isPending) ? <Loader2 size={16} className="animate-spin" /> : 'Guardar'}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
