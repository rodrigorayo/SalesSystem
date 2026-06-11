import React, { useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, UploadCloud } from 'lucide-react';
// Importación de cliente API eliminada porque usamos fetch nativo para FormData multi-part

export default function ImportadorInteligente() {
    const [sucursal, setSucursal] = useState('');
    const [archivo, setArchivo] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [error, setError] = useState('');

    const manejarSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!sucursal || !archivo) {
            setError("Por favor, selecciona una sucursal y adjunta un archivo Excel o CSV.");
            return;
        }

        setIsUploading(true);
        setError('');
        setUploadResult(null);

        try {
            const formData = new FormData();
            formData.append('file', archivo);
            formData.append('sucursal_id', sucursal);

            // Determinar la URL correcta (usamos localhost si no hay variable de entorno, para que coincida con el origin de React)
            const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
            
            // Construir la petición POST
            const respuesta = await fetch(`${baseUrl}/importar-historico`, {
                method: "POST",
                body: formData
            });

            if (!respuesta.ok) {
                const errData = await respuesta.json().catch(() => null);
                throw new Error(errData?.detail || `Error HTTP: ${respuesta.status}`);
            }

            const data = await respuesta.json();
            
            // Guardar el JSON con el resumen de auditoría
            setUploadResult(data);
            
            // Limpiar formulario para nuevo envío si se desea
            setArchivo(null);
            const fileInputSuccess = document.getElementById('file-input') as HTMLInputElement | null;
            if (fileInputSuccess) fileInputSuccess.value = "";

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Error desconocido al procesar el archivo.";
            setError("Fallo la importación: " + errorMessage + ". Verifica que el archivo no esté corrupto y que la conexión esté activa.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-white/80 backdrop-blur-xl min-h-[400px] w-full p-8 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center justify-center animate-in fade-in transition-all duration-300">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm">
                    <UploadCloud size={28} />
                </div>
                <h2 className="text-3xl font-black text-gray-800 tracking-tight">
                    Importador de Datos Históricos
                </h2>
            </div>
            
            {/* Manejo Visual de Error */}
            {error && (
                <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-600 px-6 py-4 rounded-2xl w-full max-w-md mb-6 flex items-start gap-3 shadow-sm animate-in slide-in-from-top-2">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-red-700">Error de Procesamiento</h4>
                        <p className="text-sm font-medium opacity-90">{error}</p>
                    </div>
                </div>
            )}

            <form onSubmit={manejarSubmit} className="w-full max-w-md space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-600 uppercase tracking-wide">
                        1. Sucursal Destino
                    </label>
                    <div className="relative">
                        <select
                            disabled={isUploading}
                            value={sucursal}
                            onChange={(e) => setSucursal(e.target.value)}
                            className="w-full h-12 bg-white border border-gray-200 text-gray-800 rounded-xl px-4 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-50 font-bold shadow-sm transition-all appearance-none"
                        >
                            <option value="">-- Seleccionar --</option>
                            <option value="Heroínas">Heroínas</option>
                            <option value="Recoleta">Recoleta</option>
                            <option value="Calacoto">Calacoto</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-600 uppercase tracking-wide">
                        2. Archivo Excel Consolidado
                    </label>
                    <div className={`relative border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center p-8
                        ${archivo ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-300'}`}>
                        <input
                            id="file-input"
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                    setArchivo(e.target.files[0]);
                                    setError('');
                                    setUploadResult(null);
                                }
                            }}
                            disabled={isUploading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="text-center pointer-events-none flex flex-col items-center">
                            <FileSpreadsheet size={32} className={`mb-3 ${archivo ? 'text-indigo-500' : 'text-gray-400'}`} />
                            <h4 className="text-gray-800 font-bold mb-1">
                                {archivo ? archivo.name : "Subir archivo (Arrastra o Haz Clic)"}
                            </h4>
                            <p className="text-sm font-medium text-gray-400">
                                {archivo ? `${(archivo.size / 1024 / 1024).toFixed(2)} MB` : "Soporta múltiples hojas (.xlsx, .csv)"}
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isUploading}
                    className={`w-full py-4 rounded-2xl font-black text-white text-lg tracking-wide transition-all duration-300 shadow-md flex items-center justify-center gap-3 ${
                        isUploading 
                            ? 'bg-indigo-300 cursor-not-allowed shadow-none' 
                            : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98]'
                    }`}
                >
                    {isUploading ? (
                        <>
                            <Loader2 size={24} className="animate-spin" />
                            Procesando Excel...
                        </>
                    ) : (
                        "Iniciar Importación Segura"
                    )}
                </button>
            </form>

            {/* Tarjeta de Auditoría Visual (Resultados) */}
            {uploadResult && (
                <div className="mt-8 w-full max-w-md bg-emerald-50/80 backdrop-blur-sm border border-emerald-200 rounded-2xl p-6 shadow-sm animate-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-3 mb-4 border-b border-emerald-100 pb-3">
                        <CheckCircle2 size={24} className="text-emerald-500" />
                        <h3 className="text-lg font-black text-emerald-800">✅ Importación Completada</h3>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between items-center bg-white/60 px-4 py-2.5 rounded-xl border border-emerald-100">
                            <span className="text-sm font-bold text-gray-600">Registros insertados:</span>
                            <span className="text-base font-black text-emerald-600">{uploadResult.upserted}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/60 px-4 py-2.5 rounded-xl border border-emerald-100">
                            <span className="text-sm font-bold text-gray-600">Registros actualizados:</span>
                            <span className="text-base font-black text-indigo-600">{uploadResult.modified}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/60 px-4 py-2.5 rounded-xl border border-emerald-100">
                            <span className="text-sm font-bold text-gray-600">Duplicados ignorados:</span>
                            <span className="text-base font-black text-gray-500">{uploadResult.ignored}</span>
                        </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-emerald-100 text-center">
                        <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-widest">
                            Total Procesado: {uploadResult.total_procesado}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
