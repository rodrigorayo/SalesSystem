import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEtiquetas, actualizarEtiquetasPedido } from '../api/api';
import { Tag, Loader2, Check } from 'lucide-react';
import { useOnClickOutside } from 'usehooks-ts';
import { toast } from 'sonner';

interface Props {
    pedidoId: string;
    etiquetasIds: string[];
}

export default function EtiquetasSelector({ pedidoId, etiquetasIds }: Props) {
    const qc = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useOnClickOutside(ref, () => setIsOpen(false));

    const { data: etiquetas = [] } = useQuery({
        queryKey: ['etiquetas'],
        queryFn: getEtiquetas,
    });

    const mut = useMutation({
        mutationFn: (newIds: string[]) => actualizarEtiquetasPedido(pedidoId, newIds),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['pedidos'] });
        },
        onError: () => toast.error('Error al actualizar etiquetas')
    });

    const toggleEtiqueta = (id: string) => {
        const has = etiquetasIds.includes(id);
        const next = has ? etiquetasIds.filter(x => x !== id) : [...etiquetasIds, id];
        mut.mutate(next);
    };

    const asignadas = etiquetas.filter(e => etiquetasIds.includes(e._id));

    return (
        <div className="relative flex items-center gap-1.5 flex-wrap" ref={ref}>
            {asignadas.map(e => (
                <span key={e._id} className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${e.color}`}>
                    {e.nombre}
                </span>
            ))}
            
            <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded-full transition-colors border border-dashed border-transparent hover:border-indigo-200 flex items-center gap-1"
                title="Añadir Etiqueta"
            >
                {mut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
                {asignadas.length === 0 && <span className="text-[10px] font-semibold opacity-0 hover:opacity-100">Añadir</span>}
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                    <div className="px-3 pb-2 border-b border-gray-50 mb-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Asignar Etiquetas</span>
                    </div>
                    {etiquetas.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-400">No hay etiquetas creadas.</div>
                    ) : (
                        <div className="max-h-48 overflow-y-auto">
                            {etiquetas.map(e => {
                                const isSelected = etiquetasIds.includes(e._id);
                                return (
                                    <button 
                                        key={e._id} 
                                        onClick={() => toggleEtiqueta(e._id)}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${e.color.split(' ')[0]}`} />
                                            <span className="text-xs font-semibold text-gray-700">{e.nombre}</span>
                                        </div>
                                        {isSelected && <Check size={14} className="text-indigo-600" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
