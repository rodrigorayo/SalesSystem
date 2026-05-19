import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, Plus, ArrowRight, Package, CheckCircle2, Clock, XCircle, FileText, Search, Download, Eye, User2, Building2 } from 'lucide-react';
import { getTraslados, despacharTraslado, recibirTraslado, cancelarTraslado } from '../api/traslados';
import { getSucursales, getInventario, getClientes, createCliente } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

export default function InventarioTrasladosPage() {
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<'enviados' | 'recibidos'>('enviados');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState<string | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState<any | null>(null);

    // Queries
    const { data: trasladosData, isLoading } = useQuery({
        queryKey: ['traslados', tab],
        queryFn: () => getTraslados({ tipo: tab }),
    });

    const { data: sucursales = [] } = useQuery({
        queryKey: ['sucursales'],
        queryFn: getSucursales,
    });

    const traslados = (trasladosData as any)?.items || [];

    const handleSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['traslados'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
    };

    const cancelMutation = useMutation({
        mutationFn: cancelarTraslado,
        onSuccess: () => {
            toast.success("Traslado cancelado. Stock devuelto.");
            handleSuccess();
        }
    });

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <Truck className="text-indigo-600" size={32} />
                        Traslados de Inventario
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Mueve stock entre sucursales sin afectar la caja.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 w-full sm:w-auto justify-center"
                >
                    <Plus size={20} />
                    Nuevo Traslado
                </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100/50 p-1 rounded-2xl w-full sm:w-max">
                <button
                    onClick={() => setTab('enviados')}
                    className={`flex-1 sm:px-8 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        tab === 'enviados' ? 'bg-white text-indigo-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Enviados (Salidas)
                </button>
                <button
                    onClick={() => setTab('recibidos')}
                    className={`flex-1 sm:px-8 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        tab === 'recibidos' ? 'bg-white text-indigo-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Recibidos (Entradas)
                </button>
            </div>

            {/* Lista */}
            <div className="grid gap-4">
                {isLoading ? (
                    <div className="text-center py-10 text-gray-400 font-medium">Cargando traslados...</div>
                ) : traslados.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 border-dashed">
                        <Truck size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-700">No hay traslados {tab}</h3>
                        <p className="text-sm text-gray-400 mt-1">Cuando {tab === 'enviados' ? 'envíes' : 'te envíen'} mercadería, aparecerá aquí.</p>
                    </div>
                ) : (
                    traslados.map((t: any) => (
                        <div 
                            key={t._id} 
                            onClick={() => setIsDetailOpen(t)}
                            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all cursor-pointer relative overflow-hidden group"
                        >
                            {/* Decorative Line */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                t.estado === 'COMPLETADO' ? 'bg-emerald-500' :
                                t.estado === 'EN_TRANSITO' ? 'bg-amber-400' : 'bg-red-500'
                            }`} />
                            
                            <div className="flex flex-col md:flex-row gap-6 justify-between">
                                <div className="space-y-3 flex-1">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider ${
                                            t.estado === 'COMPLETADO' ? 'bg-emerald-50 text-emerald-700' :
                                            t.estado === 'EN_TRANSITO' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                                        }`}>
                                            {t.estado.replace('_', ' ')}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono">{new Date(t.created_at).toLocaleString('es-BO')}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 text-gray-700">
                                        <div className="font-bold">{t.sucursal_origen_nombre}</div>
                                        <ArrowRight size={16} className="text-gray-300" />
                                        <div className="font-bold">{t.sucursal_destino_nombre}</div>
                                    </div>

                                    <div className="text-sm text-gray-500 flex items-center gap-2">
                                        <Package size={16} />
                                        <span>{t.items.length} productos diferentes</span>
                                    </div>
                                </div>

                                <div className="flex flex-col items-start md:items-end justify-center gap-3 min-w-[200px] bg-gray-50 p-4 rounded-xl">
                                    <div className="text-xs text-gray-500">Valor al Costo</div>
                                    <div className="text-xl font-black text-gray-900">
                                        Bs. {t.valor_total_enviado?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-indigo-500 font-semibold mt-1">
                                        <Eye size={13} />
                                        <span>Ver detalle</span>
                                    </div>
                                    
                                    {tab === 'recibidos' && t.estado === 'EN_TRANSITO' && (
                                        <button 
                                            onClick={() => setIsReceiveModalOpen(t)}
                                            className="w-full mt-2 bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200"
                                        >
                                            Recibir Mercadería
                                        </button>
                                    )}
                                    {tab === 'enviados' && t.estado === 'EN_TRANSITO' && (
                                        <button 
                                            onClick={() => {
                                                if(confirm("¿Estás seguro de cancelar este traslado? El stock volverá a tu sucursal.")) {
                                                    cancelMutation.mutate(t._id);
                                                }
                                            }}
                                            className="w-full mt-2 text-red-500 font-bold py-1 px-4 text-xs hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            Cancelar Envío
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modals */}
            {isCreateModalOpen && (
                <CreateTrasladoModal 
                    onClose={() => setIsCreateModalOpen(false)} 
                    sucursales={sucursales}
                    onSuccess={handleSuccess}
                />
            )}
            
            {isDetailOpen && (
                <TrasladoDetailModal
                    traslado={isDetailOpen}
                    onClose={() => setIsDetailOpen(null)}
                    onReceive={(t: any) => { setIsDetailOpen(null); setIsReceiveModalOpen(t); }}
                    onCancel={(id: string) => {
                        if(confirm("¿Cancelar este traslado? El stock volverá a tu sucursal.")) {
                            cancelMutation.mutate(id);
                            setIsDetailOpen(null);
                        }
                    }}
                    tab={tab}
                />
            )}
            {isReceiveModalOpen && (
                <ReceiveTrasladoModal 
                    traslado={isReceiveModalOpen}
                    onClose={() => setIsReceiveModalOpen(null)} 
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
}

// ─── Componentes Hijos (Modales) ─────────────────────────────────────────────

function TrasladoDetailModal({ traslado: t, onClose, onReceive, onCancel, tab }: any) {
    const bs = (n: number) => `Bs. ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const handlePDF = async () => {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pw = doc.internal.pageSize.getWidth();

        // Header
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(0, 0, pw, 36, 0, 0, 'F');
        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, 6, 36, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text('TRASLADO DE INVENTARIO', 14, 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(180, 190, 210);
        doc.text(`${t.sucursal_origen_nombre}  →  ${t.sucursal_destino_nombre}`, 14, 23);
        doc.setFontSize(8);
        doc.setTextColor(140, 150, 170);
        doc.text(`Generado: ${new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}`, pw - 14, 23, { align: 'right' });

        // Info cards row
        let y = 44;
        const cards = [
            { label: 'Fecha de Despacho', value: new Date(t.created_at).toLocaleString('es-BO') },
            { label: 'Estado', value: t.estado.replace('_', ' ') },
            { label: 'Despachado por', value: t.despachado_por_nombre },
        ];
        if (t.completado_at) cards.push({ label: 'Recibido por', value: t.recibido_por_nombre || '-' });
        if (t.notas) cards.push({ label: 'Notas', value: t.notas });

        const cardW = (pw - 28 - (cards.length - 1) * 4) / Math.min(cards.length, 3);
        cards.forEach((card, idx) => {
            const col = idx % 3;
            const row = Math.floor(idx / 3);
            const cx = 14 + col * (cardW + 4);
            const cy = y + row * 22;
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(cx, cy, cardW, 18, 2, 2, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(107, 114, 128);
            doc.text(card.label.toUpperCase(), cx + 4, cy + 6);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.text(card.value, cx + 4, cy + 13);
        });
        y += Math.ceil(cards.length / 3) * 22 + 6;

        // Products table
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('Detalle de Productos', 14, y + 6);
        y += 10;

        autoTable(doc, {
            startY: y,
            margin: { left: 14, right: 14 },
            head: [['Producto', 'Cant. Enviada', 'Cant. Recibida', 'Costo Unit.', 'Valor Total']],
            body: t.items.map((item: any) => [
                item.descripcion,
                item.cantidad_enviada,
                item.cantidad_recibida ?? '-',
                bs(item.costo_unitario),
                bs(item.valor_total),
            ]),
            foot: [['', '', '', 'TOTAL ENVIADO', bs(t.valor_total_enviado)]],
            headStyles: { fillColor: [15, 23, 42], textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
            footStyles: { fillColor: [79, 70, 229], textColor: [255,255,255], fontStyle: 'bold', fontSize: 9 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { halign: 'center' },
                2: { halign: 'center' },
                3: { halign: 'right' },
                4: { halign: 'right' },
            },
        });

        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(160, 170, 185);
            doc.text(`Taboada System • Traslado de Inventario • Pág. ${i}/${pageCount}`, pw / 2, 290, { align: 'center' });
        }

        const fecha = new Date(t.created_at).toISOString().split('T')[0];
        doc.save(`traslado_${t.sucursal_origen_nombre}_${fecha}.pdf`);
    };

    const estadoColor = t.estado === 'COMPLETADO' ? 'bg-emerald-100 text-emerald-800' :
        t.estado === 'EN_TRANSITO' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider ${estadoColor}`}>
                                {t.estado.replace('_', ' ')}
                            </span>
                        </div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                            {t.sucursal_origen_nombre}
                            <ArrowRight size={18} className="text-slate-400" />
                            {t.sucursal_destino_nombre}
                        </h2>
                        <p className="text-sm text-slate-400 mt-0.5">{new Date(t.created_at).toLocaleString('es-BO')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-300">
                        <XCircle size={24} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1">
                    {/* Info grid */}
                    <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 bg-gray-50 border-b border-gray-100">
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Despachado por</p>
                            <p className="text-sm font-bold text-gray-800 mt-0.5">{t.despachado_por_nombre}</p>
                        </div>
                        {t.recibido_por_nombre && (
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Recibido por</p>
                                <p className="text-sm font-bold text-gray-800 mt-0.5">{t.recibido_por_nombre}</p>
                            </div>
                        )}
                        {t.completado_at && (
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Completado</p>
                                <p className="text-sm font-bold text-gray-800 mt-0.5">{new Date(t.completado_at).toLocaleString('es-BO')}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Total Enviado</p>
                            <p className="text-lg font-black text-indigo-700 mt-0.5">Bs. {Number(t.valor_total_enviado).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </div>
                        {t.valor_total_recibido > 0 && (
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Total Recibido</p>
                                <p className="text-lg font-black text-emerald-700 mt-0.5">Bs. {Number(t.valor_total_recibido).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                            </div>
                        )}
                        {t.notas && (
                            <div className="col-span-2 sm:col-span-3">
                                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Notas</p>
                                <p className="text-sm text-gray-700 mt-0.5 italic">{t.notas}</p>
                            </div>
                        )}
                    </div>

                    {/* Products table */}
                    <div className="p-6">
                        <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Package size={16} />
                            Detalle de Productos
                        </h3>
                        <div className="border border-gray-200 rounded-2xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-800 text-white text-xs">
                                        <th className="px-4 py-3 text-left">Producto</th>
                                        <th className="px-4 py-3 text-center">Enviado</th>
                                        <th className="px-4 py-3 text-center">Recibido</th>
                                        <th className="px-4 py-3 text-right">Costo Unit.</th>
                                        <th className="px-4 py-3 text-right">Valor Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {t.items.map((item: any, idx: number) => {
                                        const merma = item.cantidad_recibida !== null && item.cantidad_recibida !== undefined && item.cantidad_recibida < item.cantidad_enviada;
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium text-gray-800">{item.descripcion}</td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-600">{item.cantidad_enviada}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {item.cantidad_recibida !== null && item.cantidad_recibida !== undefined ? (
                                                        <span className={`font-bold ${merma ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {item.cantidad_recibida}
                                                            {merma && <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">−{item.cantidad_enviada - item.cantidad_recibida} merma</span>}
                                                        </span>
                                                    ) : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-600">Bs. {Number(item.costo_unitario).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">Bs. {Number(item.valor_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-indigo-600 text-white">
                                        <td colSpan={4} className="px-4 py-3 font-black text-right text-sm">TOTAL ENVIADO</td>
                                        <td className="px-4 py-3 text-right font-black font-mono">Bs. {Number(t.valor_total_enviado).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer actions */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-wrap justify-between items-center gap-3">
                    <div className="flex gap-2">
                        {tab === 'recibidos' && t.estado === 'EN_TRANSITO' && (
                            <button onClick={() => onReceive(t)} className="px-4 py-2 bg-emerald-500 text-white font-bold text-sm rounded-xl hover:bg-emerald-600 transition-colors flex items-center gap-2">
                                <CheckCircle2 size={16} /> Recibir Mercadería
                            </button>
                        )}
                        {tab === 'enviados' && t.estado === 'EN_TRANSITO' && (
                            <button onClick={() => onCancel(t._id)} className="px-4 py-2 bg-red-50 text-red-600 font-bold text-sm rounded-xl hover:bg-red-100 transition-colors">
                                Cancelar Envío
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handlePDF}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-bold text-sm rounded-xl hover:bg-slate-700 transition-colors shadow-lg"
                    >
                        <Download size={16} />
                        Descargar PDF
                    </button>
                </div>
            </div>
        </div>
    );
}

function CreateTrasladoModal({ onClose, sucursales, onSuccess }: any) {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [destinoTipo, setDestinoTipo] = useState<'SUCURSAL' | 'CLIENTE'>('SUCURSAL');
    const [destinoId, setDestinoId] = useState('');
    const [notas, setNotas] = useState('');
    const [items, setItems] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [clienteSearch, setClienteSearch] = useState('');
    const [clienteSeleccionado, setClienteSeleccionado] = useState<any | null>(null);
    const [showNuevoCliente, setShowNuevoCliente] = useState(false);
    const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', telefono: '', ci: '' });
    const [confirmando, setConfirmando] = useState(false);

    const sucursalId = user?.sucursal_id || 'CENTRAL';

    const { data: inventarioResponse, isLoading: isLoadingInventario } = useQuery({
        queryKey: ['inventario-traslado', sucursalId, search],
        queryFn: () => getInventario(sucursalId, 1, 100, search || undefined),
    });
    const inventario = (inventarioResponse as any)?.items || [];
    const productosDisponibles = inventario.filter((inv: any) =>
        !items.find(i => i.producto_id === inv.producto_id)
    );

    const { data: clientesData } = useQuery({
        queryKey: ['clientes-search', clienteSearch],
        queryFn: () => getClientes(clienteSearch || undefined),
        enabled: destinoTipo === 'CLIENTE',
    });
    const clientes = Array.isArray(clientesData) ? clientesData : [];

    const crearClienteMutation = useMutation({
        mutationFn: createCliente,
        onSuccess: (newClient: any) => {
            setClienteSeleccionado(newClient);
            setShowNuevoCliente(false);
            queryClient.invalidateQueries({ queryKey: ['clientes-search'] });
            toast.success(`Cliente "${newClient.nombre}" registrado.`);
        },
        onError: () => toast.error('Error al registrar el cliente'),
    });

    const mutation = useMutation({
        mutationFn: despacharTraslado,
        onSuccess: () => {
            toast.success(destinoTipo === 'CLIENTE' ? 'Entrega al cliente registrada exitosamente' : 'Traslado despachado exitosamente');
            onSuccess();
            onClose();
        },
        onError: (err: any) => toast.error(err?.message || 'Error al despachar')
    });

    const addItem = (inv: any) => {
        if (!inv) return;
        if (inv.cantidad <= 0) {
            toast.error(`Sin stock de '${inv.producto_nombre}'.`);
            return;
        }
        if (!items.find(i => i.producto_id === inv.producto_id)) {
            setItems([...items, { producto_id: inv.producto_id, descripcion: inv.producto_nombre, cantidad: 1, maxStock: inv.cantidad }]);
            setSearch('');
        }
    };

    const updateQty = (id: string, qty: number) => {
        const item = items.find(i => i.producto_id === id);
        if (item && qty > item.maxStock) toast.warning(`Stock máx.: ${item.maxStock}`);
        setItems(items.map(i => i.producto_id === id ? { ...i, cantidad: qty } : i));
    };

    const hasErrors = items.some(i => i.cantidad > i.maxStock || i.cantidad < 1);

    const puedeConfirmar = () => {
        if (items.length === 0) return false;
        if (hasErrors) return false;
        if (destinoTipo === 'SUCURSAL' && !destinoId) return false;
        if (destinoTipo === 'CLIENTE' && !clienteSeleccionado) return false;
        return true;
    };

    const handleConfirmar = () => {
        if (!puedeConfirmar()) {
            if (items.length === 0) return toast.error('Agrega al menos un producto');
            if (destinoTipo === 'SUCURSAL' && !destinoId) return toast.error('Selecciona la sucursal destino');
            if (destinoTipo === 'CLIENTE' && !clienteSeleccionado) return toast.error('Selecciona o registra un cliente');
            return;
        }
        setConfirmando(true);
    };

    const handleDespachar = () => {
        mutation.mutate({
            destino_tipo: destinoTipo,
            sucursal_destino_id: destinoTipo === 'SUCURSAL' ? destinoId : undefined,
            cliente_destino_id: destinoTipo === 'CLIENTE' ? clienteSeleccionado?._id : undefined,
            cliente_destino_nombre: destinoTipo === 'CLIENTE' ? clienteSeleccionado?.nombre : undefined,
            notas,
            items: items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad }))
        });
    };

    const destinoNombre = destinoTipo === 'SUCURSAL'
        ? (sucursales.find((s: any) => s._id === destinoId)?.nombre || '')
        : clienteSeleccionado?.nombre || '';

    const totalValor = items.reduce((acc: number, i: any) => {
        const inv = inventario.find((p: any) => p.producto_id === i.producto_id);
        return acc + (inv ? (inv.precio || 0) * i.cantidad : 0);
    }, 0);

    // ─ Confirmation step ─
    if (confirmando) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-700 to-indigo-600 px-6 py-5">
                        <h2 className="text-xl font-black text-white">Confirmar Traslado</h2>
                        <p className="text-indigo-200 text-sm mt-0.5">Revisa los datos antes de despachar</p>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex gap-3">
                            <div className="flex-1 bg-gray-50 rounded-2xl p-4">
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Origen</p>
                                <p className="font-black text-gray-800 mt-0.5">{sucursales.find((s: any) => s._id === sucursalId)?.nombre || 'Tu Sucursal'}</p>
                            </div>
                            <div className="flex items-center text-gray-300"><ArrowRight size={20} /></div>
                            <div className="flex-1 bg-indigo-50 rounded-2xl p-4">
                                <p className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider">{destinoTipo === 'SUCURSAL' ? 'Sucursal Destino' : 'Cliente'}</p>
                                <p className="font-black text-indigo-800 mt-0.5">{destinoNombre}</p>
                            </div>
                        </div>

                        <div className="border border-gray-100 rounded-2xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-xs">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Producto</th>
                                        <th className="px-4 py-2 text-center">Cant.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {items.map((item: any) => (
                                        <tr key={item.producto_id}>
                                            <td className="px-4 py-2 font-medium text-gray-800">{item.descripcion}</td>
                                            <td className="px-4 py-2 text-center font-bold text-indigo-700">{item.cantidad}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {destinoTipo === 'CLIENTE' && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 font-medium">
                                ⚠️ La entrega a cliente se registra como COMPLETADA inmediatamente. El stock sale de tu sucursal ahora.
                            </div>
                        )}

                        {notas && <p className="text-sm text-gray-500 italic">“{notas}”</p>}
                    </div>
                    <div className="px-6 py-4 border-t bg-gray-50 flex justify-between gap-3">
                        <button onClick={() => setConfirmando(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">
                            ← Volver
                        </button>
                        <button
                            onClick={handleDespachar}
                            disabled={mutation.isPending}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center gap-2"
                        >
                            {mutation.isPending ? <Clock size={16} className="animate-spin" /> : <Truck size={16} />}
                            {destinoTipo === 'CLIENTE' ? 'Confirmar Entrega' : 'Despachar a Sucursal'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-xl font-black text-gray-800">Nuevo Traslado</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <XCircle size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    {/* Destination type toggle */}
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
                        <button
                            onClick={() => { setDestinoTipo('SUCURSAL'); setClienteSeleccionado(null); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
                                destinoTipo === 'SUCURSAL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Building2 size={16} /> A Sucursal
                        </button>
                        <button
                            onClick={() => { setDestinoTipo('CLIENTE'); setDestinoId(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
                                destinoTipo === 'CLIENTE' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <User2 size={16} /> A Cliente
                        </button>
                    </div>

                    {/* Sucursal selector */}
                    {destinoTipo === 'SUCURSAL' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Sucursal Destino</label>
                            <select
                                value={destinoId}
                                onChange={(e) => setDestinoId(e.target.value)}
                                className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-black"
                            >
                                <option value="">-- Seleccionar Sucursal --</option>
                                {sucursales.filter((s: any) => s._id !== user?.sucursal_id).map((s: any) => (
                                    <option key={s._id} value={s._id}>{s.nombre}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Client selector */}
                    {destinoTipo === 'CLIENTE' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Cliente Destino</label>
                            {clienteSeleccionado ? (
                                <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                                    <User2 size={20} className="text-indigo-500 shrink-0" />
                                    <div className="flex-1">
                                        <p className="font-bold text-indigo-800">{clienteSeleccionado.nombre}</p>
                                        {clienteSeleccionado.telefono && <p className="text-xs text-indigo-500">{clienteSeleccionado.telefono}</p>}
                                    </div>
                                    <button onClick={() => setClienteSeleccionado(null)} className="text-indigo-400 hover:text-indigo-700">
                                        <XCircle size={18} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="relative mb-2">
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            value={clienteSearch}
                                            onChange={(e) => setClienteSearch(e.target.value)}
                                            placeholder="Buscar cliente por nombre..."
                                            className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-black"
                                        />
                                    </div>
                                    {clienteSearch && (
                                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-md max-h-44 overflow-y-auto mb-2">
                                            {clientes.length === 0 ? (
                                                <div className="p-3 text-sm text-gray-400 text-center">Sin resultados</div>
                                            ) : (
                                                clientes.map((c: any) => (
                                                    <button
                                                        key={c._id}
                                                        onClick={() => { setClienteSeleccionado(c); setClienteSearch(''); }}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 text-left border-b border-gray-50 last:border-0"
                                                    >
                                                        <User2 size={15} className="text-gray-400" />
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-800">{c.nombre}</p>
                                                            {c.telefono && <p className="text-xs text-gray-400">{c.telefono}</p>}
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setShowNuevoCliente(!showNuevoCliente)}
                                        className="text-sm text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Registrar cliente nuevo
                                    </button>
                                    {showNuevoCliente && (
                                        <div className="mt-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3">
                                            <p className="text-sm font-black text-indigo-700">Nuevo Cliente</p>
                                            <input type="text" placeholder="Nombre completo *" value={nuevoCliente.nombre}
                                                onChange={e => setNuevoCliente({...nuevoCliente, nombre: e.target.value})}
                                                className="w-full p-2.5 rounded-xl border border-indigo-200 bg-white text-sm text-black outline-none focus:ring-2 focus:ring-indigo-400"
                                            />
                                            <div className="flex gap-2">
                                                <input type="text" placeholder="Teléfono" value={nuevoCliente.telefono}
                                                    onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})}
                                                    className="flex-1 p-2.5 rounded-xl border border-indigo-200 bg-white text-sm text-black outline-none focus:ring-2 focus:ring-indigo-400"
                                                />
                                                <input type="text" placeholder="CI (opcional)" value={nuevoCliente.ci}
                                                    onChange={e => setNuevoCliente({...nuevoCliente, ci: e.target.value})}
                                                    className="flex-1 p-2.5 rounded-xl border border-indigo-200 bg-white text-sm text-black outline-none focus:ring-2 focus:ring-indigo-400"
                                                />
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (!nuevoCliente.nombre.trim()) return toast.error('El nombre es requerido');
                                                    crearClienteMutation.mutate({ nombre: nuevoCliente.nombre, telefono: nuevoCliente.telefono, ci: nuevoCliente.ci });
                                                }}
                                                disabled={crearClienteMutation.isPending}
                                                className="w-full py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                                            >
                                                {crearClienteMutation.isPending ? 'Guardando...' : 'Guardar Cliente'}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Product search */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Buscar Producto de tu Sucursal</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nombre..."
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-black"
                            />
                        </div>
                        {search && (
                            <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden shadow-lg max-h-52 overflow-y-auto">
                                {isLoadingInventario ? (
                                    <div className="p-3 text-sm text-gray-400 text-center">Buscando...</div>
                                ) : productosDisponibles.length === 0 ? (
                                    <div className="p-3 text-sm text-gray-400 text-center">Sin resultados con stock</div>
                                ) : (
                                    productosDisponibles.map((inv: any) => (
                                        <button key={inv.producto_id} onClick={() => addItem(inv)}
                                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 text-left transition-colors border-b border-gray-50 last:border-0"
                                        >
                                            <span className="text-sm font-medium text-gray-800">{inv.producto_nombre}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${inv.cantidad > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                                Stock: {inv.cantidad}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Items table */}
                    {items.length > 0 && (
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Producto</th>
                                        <th className="px-4 py-3 text-center">Disponible</th>
                                        <th className="px-4 py-3 w-32 text-center">Cantidad</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {items.map(item => {
                                        const hasError = item.cantidad > item.maxStock || item.cantidad < 1;
                                        return (
                                            <tr key={item.producto_id} className={hasError ? 'bg-red-50' : ''}>
                                                <td className="px-4 py-3 font-medium text-gray-800">{item.descripcion}</td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-500">{item.maxStock}</td>
                                                <td className="px-4 py-3">
                                                    <input type="number" min="1" max={item.maxStock}
                                                        value={item.cantidad}
                                                        onChange={e => updateQty(item.producto_id, parseInt(e.target.value) || 1)}
                                                        onFocus={(e) => e.target.select()}
                                                        className={`w-full p-2 border rounded-lg text-center font-bold transition-colors ${
                                                            hasError ? 'border-red-400 bg-red-100 text-red-700' : 'border-gray-200 text-black'
                                                        }`}
                                                    />
                                                    {hasError && <p className="text-[10px] text-red-500 text-center mt-1">Máx. {item.maxStock}</p>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button onClick={() => setItems(items.filter(i => i.producto_id !== item.producto_id))}
                                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                                                        <XCircle size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Notas (Opcional)</label>
                        <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
                            placeholder="Ej. Envío por bus, caja azul..."
                            className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-black"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirmar}
                        disabled={!puedeConfirmar()}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Truck size={16} />
                        Revisar y Despachar →
                    </button>
                </div>
            </div>
        </div>
    );




function ReceiveTrasladoModal({ onClose, traslado, onSuccess }: any) {
    const [items, setItems] = useState<any[]>(traslado.items.map((i: any) => ({ ...i, cantidad_recibida: i.cantidad_enviada })));
    const [notas, setNotas] = useState('');

    const mutation = useMutation({
        mutationFn: (data: any) => recibirTraslado(traslado._id, data),
        onSuccess: () => {
            toast.success('Traslado recibido exitosamente');
            onSuccess();
            onClose();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Error al recibir el traslado');
        }
    });

    const updateQty = (id: string, qty: number) => {
        setItems(items.map(i => i.producto_id === id ? { ...i, cantidad_recibida: qty } : i));
    };

    const handleSubmit = () => {
        mutation.mutate({
            notas,
            items: items.map(i => ({ producto_id: i.producto_id, cantidad_recibida: i.cantidad_recibida }))
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 bg-emerald-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-emerald-800">Recibir Mercadería</h2>
                        <p className="text-sm text-emerald-600 mt-0.5">Verifica lo recibido desde {traslado.sucursal_origen_nombre}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-emerald-100 rounded-full transition-colors text-emerald-600">
                        <XCircle size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="border border-emerald-100 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-emerald-50 text-emerald-700">
                                <tr>
                                    <th className="p-3">Producto</th>
                                    <th className="p-3 text-center">Enviado</th>
                                    <th className="p-3 w-32">Recibido Real</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.map(item => (
                                    <tr key={item.producto_id}>
                                        <td className="p-3 font-medium text-gray-700">{item.descripcion}</td>
                                        <td className="p-3 text-center font-bold text-gray-500">{item.cantidad_enviada}</td>
                                        <td className="p-3">
                                            <input 
                                                type="number" 
                                                min="0"
                                                max={item.cantidad_enviada}
                                                value={item.cantidad_recibida}
                                                onChange={e => updateQty(item.producto_id, parseInt(e.target.value) || 0)}
                                                onFocus={(e) => e.target.select()}
                                                className={`w-full p-2 border rounded-lg text-center font-bold ${
                                                    item.cantidad_recibida < item.cantidad_enviada ? 'bg-red-50 border-red-200 text-red-600' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                }`}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {items.some(i => i.cantidad_recibida < i.cantidad_enviada) && (
                        <div className="p-4 bg-amber-50 text-amber-800 rounded-xl text-sm font-medium flex gap-3 items-start border border-amber-200">
                            <FileText className="shrink-0 text-amber-500" />
                            <p>Has marcado una cantidad menor a la enviada. La diferencia se considerará pérdida/merma en tránsito y no se sumará a tu inventario.</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Observaciones</label>
                        <input 
                            type="text" 
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            placeholder="Ej. Una caja llegó abollada..."
                            className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={mutation.isPending}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center gap-2"
                    >
                        {mutation.isPending ? <Clock size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        Confirmar Recepción
                    </button>
                </div>
            </div>
        </div>
    );
}
