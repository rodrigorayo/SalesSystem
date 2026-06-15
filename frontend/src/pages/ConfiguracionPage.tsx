import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyTenant, updateMyTenantSettings, uploadImage, updateMyTenantConfiguracion } from '../api/api';
import type { TenantSettings } from '../api/types';
import { Loader2, Save, Image as ImageIcon, Store, AlertCircle, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfiguracionPage() {
    const qc = useQueryClient();
    const [activeTab, setActiveTab] = useState<'branding' | 'pos'>('branding');

    const { data: tenant, isLoading } = useQuery({
        queryKey: ['myTenant'],
        queryFn: getMyTenant
    });

    const [settings, setSettings] = useState<TenantSettings>({
        ticket_footer: '',
        report_watermark: '',
        logo_base64: '',
        direccion: '',
        telefono: '',
        brand_color: '#4f46e5',
        whatsapp: {
            enabled: false,
            provider: 'GREENAPI',
            instance_id: '',
            api_token: '',
            default_message: 'Hola {cliente}, adjuntamos el comprobante de tu compra por Bs. {total}. ¡Gracias por tu preferencia!'
        }
    });

    const [configuracion, setConfiguracion] = useState<Record<string, any>>({
        impresion_automatica: false,
        exigir_nombre_cliente: false,
        permitir_stock_negativo: false,
        descuento_requiere_autorizacion: false,
    });

    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (tenant?.settings) {
            setSettings({
                ticket_footer: tenant.settings.ticket_footer || '',
                report_watermark: tenant.settings.report_watermark || '',
                logo_base64: tenant.settings.logo_base64 || '',
                direccion: tenant.settings.direccion || '',
                telefono: tenant.settings.telefono || '',
                brand_color: tenant.settings.brand_color || '#4f46e5',
                whatsapp: {
                    enabled: tenant.settings.whatsapp?.enabled || false,
                    provider: tenant.settings.whatsapp?.provider || 'GREENAPI',
                    instance_id: tenant.settings.whatsapp?.instance_id || '',
                    api_token: tenant.settings.whatsapp?.api_token || '',
                    default_message: tenant.settings.whatsapp?.default_message || 'Hola {cliente}, adjuntamos el comprobante de tu compra por Bs. {total}. ¡Gracias por tu preferencia!'
                }
            });
            if (tenant.settings.brand_color) {
                document.documentElement.style.setProperty('--brand-color', tenant.settings.brand_color);
            }
        }

        if (tenant?.configuracion) {
            setConfiguracion({
                impresion_automatica: !!tenant.configuracion.impresion_automatica,
                exigir_nombre_cliente: !!tenant.configuracion.exigir_nombre_cliente,
                permitir_stock_negativo: !!tenant.configuracion.permitir_stock_negativo,
                descuento_requiere_autorizacion: !!tenant.configuracion.descuento_requiere_autorizacion,
            });
        }
    }, [tenant]);

    const handleBrandColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const color = e.target.value;
        setSettings(s => ({ ...s, brand_color: color }));
        document.documentElement.style.setProperty('--brand-color', color);
    };

    const mut = useMutation({
        mutationFn: (newSettings: TenantSettings) => updateMyTenantSettings(newSettings),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['myTenant'] });
            toast.success("Configuración guardada exitosamente.");
        },
        onError: () => {
            toast.error("Error al guardar la configuración.");
        }
    });

    const configMut = useMutation({
        mutationFn: (newConfig: Record<string, any>) => updateMyTenantConfiguracion(newConfig),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['myTenant'] });
            toast.success("Políticas del POS guardadas exitosamente.");
        },
        onError: () => {
            toast.error("Error al guardar las políticas del POS.");
        }
    });

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) { 
            toast.error("La imagen no debe superar los 5MB.");
            return;
        }

        try {
            setIsUploading(true);
            const res = await uploadImage(file);
            setSettings(s => ({ ...s, logo_base64: res.url }));
            toast.success("Logo subido a la nube correctamente.");
        } catch (error: any) {
            toast.error(error.message || "Error al subir la imagen");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mut.mutate(settings);
    };

    const handleSubmitConfig = (e: React.FormEvent) => {
        e.preventDefault();
        configMut.mutate(configuracion);
    };

    if (isLoading) {
        return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Configuración del Sistema</h1>
                <p className="text-gray-500 font-medium">Personaliza los parámetros visuales, de comunicación y políticas del POS.</p>
            </div>

            {/* Selector de Pestañas */}
            <div className="flex border-b border-gray-200 mb-8 overflow-x-auto whitespace-nowrap">
                <button
                    type="button"
                    onClick={() => setActiveTab('branding')}
                    className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors cursor-pointer ${
                        activeTab === 'branding'
                            ? "border-black text-black font-extrabold"
                            : "border-transparent text-gray-500 hover:text-gray-900"
                    }`}
                >
                    Datos de Empresa y WhatsApp
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('pos')}
                    className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors cursor-pointer ${
                        activeTab === 'pos'
                            ? "border-black text-black font-extrabold"
                            : "border-transparent text-gray-500 hover:text-gray-900"
                    }`}
                >
                    Configuraciones POS/Empresa
                </button>
            </div>

            {activeTab === 'branding' ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* BRANDING */}
                    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 shadow-sm">
                        <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                            <Store className="text-indigo-600" /> Marca y Logo
                        </h2>

                        <div className="flex flex-col md:flex-row gap-8 items-start">
                            <div className="flex-1 space-y-4 w-full">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Logo de la Empresa</label>
                                    <label className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-2xl appearance-none cursor-pointer hover:border-gray-400 focus:outline-none">
                                        <span className="flex items-center space-x-2 text-gray-600">
                                            {isUploading ? <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" /> : <ImageIcon className="w-6 h-6 text-gray-400" />}
                                            <span className="font-medium text-sm">{isUploading ? 'Subiendo...' : 'Subir nueva imagen (Max 5MB)'}</span>
                                        </span>
                                        <input type="file" name="file_upload" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} disabled={isUploading} />
                                    </label>
                                </div>
                                {settings.logo_base64 && (
                                    <div className="flex gap-4 items-center p-4 bg-gray-50 rounded-xl">
                                        <img src={settings.logo_base64} alt="Preview" className="h-16 w-auto object-contain bg-white border rounded-lg p-2" />
                                        <button type="button" onClick={() => setSettings(s => ({ ...s, logo_base64: '' }))} className="text-red-500 text-sm font-bold hover:underline cursor-pointer">Remover Logo</button>
                                    </div>
                                )}
                            </div>

                            {/* Selector de Color */}
                            <div className="flex-1 w-full flex flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-8">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-4">Color Principal de la Marca</label>
                                <div className="flex items-center gap-4">
                                    <div className="relative overflow-hidden w-16 h-16 rounded-full border-4 border-white shadow-md ring-2 ring-gray-100 shrink-0">
                                        <input 
                                            type="color" 
                                            value={settings.brand_color} 
                                            onChange={handleBrandColorChange}
                                            className="absolute -inset-4 w-24 h-24 cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">Tema Dinámico</p>
                                        <p className="text-xs text-gray-500">Selecciona tu color corporativo. Botones e indicadores cambiarán automáticamente.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FACTURACION Y RECIBOS */}
                    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 shadow-sm">
                        <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                            <AlertCircle className="text-orange-500" /> Recibos y Reportes
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Mensaje al final del ticket</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-bold"
                                    placeholder="¡Gracias por su preferencia!"
                                    value={settings.ticket_footer}
                                    onChange={e => setSettings(s => ({ ...s, ticket_footer: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Marca de Agua en Reportes</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-bold"
                                    placeholder="Confidencial"
                                    value={settings.report_watermark}
                                    onChange={e => setSettings(s => ({ ...s, report_watermark: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Dirección de la Empresa</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-bold"
                                    placeholder="Av. Principal #123"
                                    value={settings.direccion}
                                    onChange={e => setSettings(s => ({ ...s, direccion: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Teléfono de Contacto</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-bold"
                                    placeholder="+591 77712345"
                                    value={settings.telefono}
                                    onChange={e => setSettings(s => ({ ...s, telefono: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>

                    {/* WHATSAPP INTEGRATION */}
                    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                <MessageCircle className="text-green-500" /> Integración de WhatsApp
                            </h2>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={settings.whatsapp?.enabled}
                                    onChange={e => setSettings(s => ({ ...s, whatsapp: { ...s.whatsapp!, enabled: e.target.checked } }))}
                                />
                                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                        </div>

                        {settings.whatsapp?.enabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Proveedor</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-bold"
                                        value={settings.whatsapp?.provider}
                                        onChange={e => setSettings(s => ({ ...s, whatsapp: { ...s.whatsapp!, provider: e.target.value } }))}
                                    >
                                        <option value="GREENAPI">Green-API (Recomendado)</option>
                                        <option value="ULTRAMSG">UltraMsg</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Instance ID</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-bold"
                                        placeholder="Ej. 7103891238"
                                        value={settings.whatsapp?.instance_id}
                                        onChange={e => setSettings(s => ({ ...s, whatsapp: { ...s.whatsapp!, instance_id: e.target.value } }))}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">API Token</label>
                                    <input 
                                        type="password" 
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-bold"
                                        placeholder="••••••••••••••••"
                                        value={settings.whatsapp?.api_token}
                                        onChange={e => setSettings(s => ({ ...s, whatsapp: { ...s.whatsapp!, api_token: e.target.value } }))}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Mensaje por Defecto</label>
                                    <p className="text-xs text-gray-500 mb-2">Variables disponibles: <code className="bg-gray-100 px-1 rounded">{'{cliente}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{total}'}</code></p>
                                    <textarea 
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-bold resize-none h-24"
                                        placeholder="Hola {cliente}, adjuntamos tu ticket por Bs. {total}"
                                        value={settings.whatsapp?.default_message}
                                        onChange={e => setSettings(s => ({ ...s, whatsapp: { ...s.whatsapp!, default_message: e.target.value } }))}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-4">
                        <button 
                            type="submit" 
                            disabled={mut.isPending}
                            className="bg-black text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-black/20 hover:bg-gray-800 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {mut.isPending ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                            Guardar Configuración
                        </button>
                    </div>

                </form>
            ) : (
                <form onSubmit={handleSubmitConfig} className="space-y-6">
                    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
                        <div className="flex items-center gap-3 mb-2 border-b border-gray-100 pb-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <Store className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-gray-900">Políticas y Configuración del POS</h2>
                                <p className="text-xs text-gray-500">Define los comportamientos y políticas de negocio para el punto de venta.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Impresión de Ticket Automática */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100/50 transition-colors rounded-2xl border border-gray-100/80">
                                <div className="pr-4">
                                    <h3 className="text-sm font-bold text-gray-900">Impresión de Ticket Automática</h3>
                                    <p className="text-xs text-gray-500">Imprime el recibo automáticamente después de confirmar cada venta.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={configuracion.impresion_automatica}
                                        onChange={e => setConfiguracion(c => ({ ...c, impresion_automatica: e.target.checked }))}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            {/* Exigir nombre de cliente */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100/50 transition-colors rounded-2xl border border-gray-100/80">
                                <div className="pr-4">
                                    <h3 className="text-sm font-bold text-gray-900">Exigir nombre de cliente en ventas</h3>
                                    <p className="text-xs text-gray-500">No permite facturar si no se ha seleccionado o registrado un cliente.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={configuracion.exigir_nombre_cliente}
                                        onChange={e => setConfiguracion(c => ({ ...c, exigir_nombre_cliente: e.target.checked }))}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            {/* Permitir stock negativo */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100/50 transition-colors rounded-2xl border border-gray-100/80">
                                <div className="pr-4">
                                    <h3 className="text-sm font-bold text-gray-900">Permitir ventas con stock negativo</h3>
                                    <p className="text-xs text-gray-500">Permite realizar ventas aun cuando no haya existencias en el inventario.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={configuracion.permitir_stock_negativo}
                                        onChange={e => setConfiguracion(c => ({ ...c, permitir_stock_negativo: e.target.checked }))}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            {/* Descuento requiere autorización */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100/50 transition-colors rounded-2xl border border-gray-100/80">
                                <div className="pr-4">
                                    <h3 className="text-sm font-bold text-gray-900">Descuentos requieren autorización del supervisor</h3>
                                    <p className="text-xs text-gray-500">Exige aprobación para aplicar cualquier tipo de descuento en el POS.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={configuracion.descuento_requiere_autorizacion}
                                        onChange={e => setConfiguracion(c => ({ ...c, descuento_requiere_autorizacion: e.target.checked }))}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button 
                            type="submit" 
                            disabled={configMut.isPending}
                            className="bg-black text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-black/20 hover:bg-gray-800 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {configMut.isPending ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                            Guardar Configuración POS
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
