import React, { useState } from 'react';

// Generamos este componente en exportación default 
export default function ImportadorInteligente() {
    const [sucursal, setSucursal] = useState('');
    const [archivo, setArchivo] = useState<File | null>(null);
    const [estado, setEstado] = useState({ cargando: false, exito: false, error: '' });

    const manejarSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!sucursal || !archivo) {
            setEstado({ ...estado, error: "Selecciona una sucursal y un archivo para importar." });
            return;
        }

        setEstado({ cargando: true, exito: false, error: '' });

        try {
            // 1. Empaqueta todo en un new FormData().
            const formData = new FormData();
            formData.append('file', archivo);
            formData.append('sucursal', sucursal);

            // 2. Haz el POST (3. ESTRICTAMENTE PROHIBIDO definir cabecera Content-Type)
            const respuesta = await fetch("http://127.0.0.1:8000/api/v1/importar-historico", {
                method: "POST",
                body: formData
                // El navegador se encargará del boundary multipart/form-data
            });

            if (!respuesta.ok) {
                const errData = await respuesta.json().catch(() => null);
                throw new Error(errData?.detail || `Error HTTP: ${respuesta.status}`);
            }

            const data = await respuesta.json();
            
            setEstado({ cargando: false, exito: true, error: '' });
            alert(`¡Importación lista! Filas agregadas a Mongo: ${data?.filas_insertadas}`);
            
            // Limpiar form en caso de éxito
            setArchivo(null);
            const fileInputSuccess = document.getElementById('file-input') as HTMLInputElement | null;
            if (fileInputSuccess) fileInputSuccess.value = "";

        } catch (error) {
            // Arreglo del Error [object Object] extrayendo el mensaje real
            const errorMessage = error instanceof Error ? error.message : "Error desconocido en el servidor.";
            
            // Mostrar texto claro
            setEstado({ cargando: false, exito: false, error: errorMessage });
            alert(errorMessage);
            
            // Reset automático para intentar de nuevo
            setArchivo(null);
            const fileInputError = document.getElementById('file-input') as HTMLInputElement | null;
            if (fileInputError) fileInputError.value = "";
        }
    };

    return (
        <div className="bg-white min-h-[400px] w-full p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center animate-in fade-in">
            <h2 className="text-3xl font-black text-gray-800 tracking-tight mb-8">
                Carga de Resultados
            </h2>
            
            {/* Manejo Visual de Estados */}
            {estado.error && (
                <div className="bg-red-50 text-red-600 border border-red-200 px-6 py-4 rounded-xl w-full max-w-md mb-6 font-medium">
                    {estado.error}
                </div>
            )}

            {estado.exito && (
                <div className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-6 py-4 rounded-xl w-full max-w-md mb-6 font-medium">
                    ¡Carga asíncrona completada! Revisa el tablero general.
                </div>
            )}

            <form onSubmit={manejarSubmit} className="w-full max-w-md space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-600 uppercase">
                        Sucursal Destino
                    </label>
                    <select
                        disabled={estado.cargando}
                        value={sucursal}
                        onChange={(e) => setSucursal(e.target.value)}
                        className="w-full h-12 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                        <option value="">-- Elige la sucursal --</option>
                        <option value="Heroinas">Heroínas</option>
                        <option value="Recoleta">Recoleta</option>
                        <option value="Calacoto">Calacoto</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-600 uppercase">
                        Excel Consolidado
                    </label>
                    <div className="relative border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition p-6 flex flex-col items-center justify-center">
                        <input
                            id="file-input"
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                    setArchivo(e.target.files[0]);
                                }
                            }}
                            disabled={estado.cargando}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="text-center pointer-events-none">
                            <h4 className="text-gray-800 font-bold mb-1">
                                {archivo ? archivo.name : "Subir archivo Excel"}
                            </h4>
                            <p className="text-sm text-gray-400">
                                Haz clic o arrastra aquí tu reporte
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={estado.cargando}
                    className={`w-full py-4 rounded-xl font-black text-white text-lg transition-colors ${
                        estado.cargando 
                            ? 'bg-indigo-300 cursor-not-allowed' 
                            : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                    }`}
                >
                    {estado.cargando ? (
                        <div className="flex items-center justify-center gap-2">
                            <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            Extrayendo con Pandas...
                        </div>
                    ) : (
                        "Importar Archivo a BD"
                    )}
                </button>
            </form>
        </div>
    );
}
