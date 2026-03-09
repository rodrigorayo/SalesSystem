import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSolicitudesPrecio, responderSolicitudPrecio } from '../api/api';
import { Tag, Check, X, Loader2, MessageSquare, Clock, MapPin } from 'lucide-react';

const formatDate = (dateStr: string) => {
    const isoStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    return new Date(isoStr).toLocaleString();
};

export default function PriceRequestsPage() {
    const queryClient = useQueryClient();
    const [filterEstado, setFilterEstado] = useState<string>('PENDIENTE');

    const { data: solicitudes = [], isLoading } = useQuery({
        queryKey: ['price-requests', filterEstado],
        queryFn: () => getSolicitudesPrecio(filterEstado),
    });

    const [respondModal, setRespondModal] = useState<any>(null);

    const handleRespondSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['price-requests'] });
        setRespondModal(null);
    };

    return (
        <div className="max-w-7xl mx-auto p-4 space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Solicitudes de Cambio de Precio</h1>
                    <p className="text-xs text-gray-500">Revisa y aprueba propuestas de precios de las sucursales.</p>
                </div>

                <div className="flex bg-white p-1 rounded-lg border border-gray-100 shadow-sm">
                    {['PENDIENTE', 'APROBADO', 'RECHAZADO'].map(e => (
                        <button
                            key={e}
                            onClick={() => setFilterEstado(e)}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${filterEstado === e ? 'bg-indigo-50 text-indigo-700' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {e}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                </div>
            ) : solicitudes.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                    <Tag className="mx-auto text-gray-200 mb-4" size={48} />
                    <p className="text-gray-500 font-medium">No hay solicitudes {filterEstado.toLowerCase()}s</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {solicitudes.map((req) => (
                        <div key={req._id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-4 flex-1 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2 text-indigo-600">
                                        <Tag size={16} />
                                        <span className="text-xs font-bold uppercase tracking-wider">Cambio de Precio</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${req.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' :
                                        req.estado === 'APROBADO' ? 'bg-green-100 text-green-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>
                                        {req.estado}
                                    </span>
                                </div>

                                <div>
                                    <h3 className="font-bold text-gray-900 text-sm leading-tight">{req.producto_nombre}</h3>
                                    <div className="flex items-center gap-1.5 text-gray-500 text-[10px] items-center mt-1">
                                        <MapPin size={10} />
                                        <span>Sucursal {req.sucursal_id}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded-lg">
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Actual</p>
                                        <p className="text-xs font-mono font-bold text-gray-500 line-through">Bs. {req.precio_actual.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-indigo-400 uppercase">Propuesta</p>
                                        <p className="text-sm font-mono font-bold text-indigo-600 underline">Bs. {req.precio_propuesto.toFixed(2)}</p>
                                    </div>
                                </div>

                                <div className="bg-amber-50 rounded-lg p-2.5 space-y-1.5 border border-amber-100/50">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700">
                                        <MessageSquare size={12} />
                                        Razonamiento:
                                    </div>
                                    <p className="text-xs text-amber-900 leading-snug italic">"{req.motivo_solicitud}"</p>
                                </div>

                                <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                                    <Clock size={10} />
                                    <span>Solicitado el {formatDate(req.created_at)} por {req.solicitado_nombre}</span>
                                </div>

                                {req.motivo_rechazo && (
                                    <div className="bg-red-50 rounded-lg p-2 border border-red-100 mt-2">
                                        <p className="text-[9px] font-bold text-red-700 uppercase">Motivo del rechazo:</p>
                                        <p className="text-xs text-red-900 mt-0.5">{req.motivo_rechazo}</p>
                                    </div>
                                )}
                            </div>

                            {req.estado === 'PENDIENTE' && (
                                <div className="p-3 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setRespondModal({ id: req._id, action: 'RECHAZADO', name: req.producto_nombre, prop: req.precio_propuesto })}
                                        className="flex items-center justify-center gap-1.5 py-2 bg-white hover:bg-red-50 text-red-600 border border-gray-200 hover:border-red-200 rounded-lg text-[10px] font-bold uppercase transition-all"
                                    >
                                        <X size={14} /> Rechazar
                                    </button>
                                    <button
                                        onClick={() => setRespondModal({ id: req._id, action: 'APROBADO', name: req.producto_nombre, prop: req.precio_propuesto })}
                                        className="flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm"
                                    >
                                        <Check size={14} /> Aprobar
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {respondModal && (
                <RespondModal
                    solicitud={respondModal}
                    onClose={() => setRespondModal(null)}
                    onSuccess={handleRespondSuccess}
                />
            )}
        </div>
    );
}

function RespondModal({ solicitud, onClose, onSuccess }: any) {
    const [motivo, setMotivo] = useState('');
    const respMut = useMutation({
        mutationFn: (data: any) => responderSolicitudPrecio(solicitud.id, data),
        onSuccess,
    });

    const isApprove = solicitud.action === 'APROBADO';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className={`px-4 py-3 border-b border-gray-100 flex items-center justify-between ${isApprove ? 'bg-indigo-50' : 'bg-red-50'}`}>
                    <div>
                        <h3 className={`text-sm font-bold ${isApprove ? 'text-indigo-900' : 'text-red-900'}`}>
                            {isApprove ? 'Confirmar Aprobación' : 'Rechazar Solicitud'}
                        </h3>
                        <p className={`text-[10px] ${isApprove ? 'text-indigo-700' : 'text-red-700'}`}>
                            {solicitud.name} &rarr; Bs. {solicitud.prop.toFixed(2)}
                        </p>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {!isApprove && (
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Motivo del rechazo (opcional)</label>
                            <textarea
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300 transition-all resize-none"
                                rows={3}
                                value={motivo}
                                onChange={e => setMotivo(e.target.value)}
                                placeholder="Explica por qué no se puede aplicar este precio..."
                            />
                        </div>
                    )}

                    {isApprove && (
                        <p className="text-xs text-gray-600 leading-relaxed">
                            Al aprobar, el precio de este producto en la sucursal correspondiente se actualizará inmediatamente a <span className="font-bold text-indigo-600">Bs. {solicitud.prop.toFixed(2)}</span>. This will override the global price for that branch.
                        </p>
                    )}

                    <div className="flex gap-2">
                        <button onClick={onClose} className="flex-1 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-lg transition-colors">Cancelar</button>
                        <button
                            onClick={() => respMut.mutate({ estado: solicitud.action, motivo_rechazo: motivo })}
                            disabled={respMut.isPending}
                            className={`flex-2 px-6 py-2 rounded-lg text-xs font-bold text-white transition-all shadow-sm flex items-center justify-center gap-2 ${isApprove ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700'}`}
                        >
                            {respMut.isPending ? <Loader2 size={14} className="animate-spin" /> : isApprove ? <Check size={14} /> : <X size={14} />}
                            {isApprove ? 'Confirmar y Aplicar' : 'Confirmar Rechazo'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
