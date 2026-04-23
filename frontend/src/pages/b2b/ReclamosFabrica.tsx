import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMermasReclamos, compensarMermaReclamo } from '../../api/api';
import { Loader2, TrendingDown, CheckCircle2, Factory, Store, FileWarning } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const formatDate = (dateStr: string) => {
    const isoStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    return new Date(isoStr).toLocaleString();
};

export default function ReclamosFabrica() {
    const qc = useQueryClient();
    const [page, setPage] = useState(1);
    const [filterEstado, setFilterEstado] = useState<'' | 'PENDIENTE' | 'COMPENSADO'>('PENDIENTE');

    const { data, isLoading } = useQuery({
        queryKey: ['mermas', page, filterEstado],
        queryFn: () => getMermasReclamos(page, 20, filterEstado || undefined)
    });

    const mermas = data?.items || [];
    const deudaGlobal = data?.deuda_pendiente_global || 0;

    const compensarMut = useMutation({
        mutationFn: (id: string) => compensarMermaReclamo(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['mermas'] });
        },
        onError: (err: any) => alert(err.message || 'Error al compensar reclamo.')
    });

    const handleCompensar = (id: string) => {
        if(window.confirm("¿Confirmas que la fábrica Taboada pagó o repuso esta merma? El reclamo bajará de la cuenta por cobrar.")){
            compensarMut.mutate(id);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                        <Factory className="text-indigo-600" />
                        Reclamos a Fábrica
                    </h1>
                    <p className="text-gray-500 mt-1">Control de deuda por vencidos y mermas (B2B)</p>
                </div>
            </div>

            {/* Tarjeta de Saldo Principal */}
            <div className="bg-gradient-to-br from-gray-900 to-indigo-900 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden text-white border border-indigo-500/20">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Factory size={120} />
                </div>
                <div className="relative z-10">
                    <p className="text-indigo-200 font-bold tracking-widest uppercase text-xs mb-2">Deuda Pendiente de Taboada a Favor Nuestro</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-5xl md:text-7xl font-black tracking-tighter">Bs. {deudaGlobal.toFixed(2)}</span>
                    </div>
                    <p className="text-indigo-200 mt-4 text-sm max-w-lg">
                        Monto calculado matemáticamente con el <strong>Precio de Costo Base</strong> de todos los productos vencidos recogidos en los supermercados que aún no han sido repuestos por la central.
                    </p>
                </div>
            </div>

            <div className="flex gap-2">
                <button 
                    onClick={() => { setFilterEstado('PENDIENTE'); setPage(1); }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterEstado === 'PENDIENTE' ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                >
                    Exigibilidad Pendiente
                </button>
                <button 
                    onClick={() => { setFilterEstado('COMPENSADO'); setPage(1); }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterEstado === 'COMPENSADO' ? 'bg-emerald-500 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                >
                    Historial Compensado
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" /></div>
            ) : mermas.length === 0 ? (
                <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-12 text-center text-gray-400">
                    <TrendingDown className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <p>No hay registros en esta categoría.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <AnimatePresence>
                        {mermas.map((m: any) => (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={m.id} 
                                className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4 relative overflow-hidden"
                            >
                                {m.estado_reclamo === 'COMPENSADO' && (
                                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black uppercase px-6 py-1 rotate-45 translate-x-4 translate-y-2 shadow-sm">
                                        PAGADO
                                    </div>
                                )}
                                
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium mb-1">
                                            <Store size={14} className="text-orange-500" /> 
                                            {m.supermercado_nombre} 
                                            <span className="text-gray-300">|</span> 
                                            <span className="text-xs uppercase">{formatDate(m.fecha_recuperacion)}</span>
                                        </div>
                                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                            <FileWarning size={16} className="text-rose-500" />
                                            Reclamo por Devolución de Mermas
                                        </h3>
                                        <p className="text-xs text-gray-400 font-mono mt-1">ID: #{m.id.substring(m.id.length-8).toUpperCase()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">A cobrar a Fábrica</p>
                                        <p className="text-2xl font-black text-indigo-600">Bs. {m.costo_total_merma.toFixed(2)}</p>
                                    </div>
                                </div>
                                
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">Desglose de Productos Vencidos</h4>
                                    <div className="space-y-1">
                                        {m.items.map((i: any, idx: number) => (
                                            <div key={idx} className="flex justify-between text-xs">
                                                <span className="text-gray-700">{i.cantidad}x {i.producto_nombre}</span>
                                                <span className="font-mono text-gray-500">
                                                    (Costo c/u: Bs. {i.costo_unitario.toFixed(2)})
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                {m.estado_reclamo === 'PENDIENTE' && (
                                    <div className="flex justify-end mt-2">
                                        <button 
                                            onClick={() => handleCompensar(m.id)}
                                            disabled={compensarMut.isPending}
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-bold transition-colors"
                                        >
                                            {compensarMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                            Marcar como Compensado por Taboada
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
