import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Building2, Lightbulb, Bot, AlertTriangle, UploadCloud, DownloadCloud } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import DashboardMaestro from './DashboardMaestro';
import CatalogRentability from './CatalogRentability';
import AnaliticaAvanzada from './AnaliticaAvanzada';

import ImportadorInteligente from '../components/DataImporterWizard'; 
import ChatbotAnalitico from '../components/ChatbotAnalitico';
import { generateExecutivePDF } from '../utils/reportGenerator';
import { getOrchestration, getAnalyticsBcg, getAnalyticsDashboard } from '../api/api';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function ExecutiveDashboard() {
    const { role } = useAuthStore();
    const esAdmin = ['SUPERADMIN', 'ADMIN_MATRIZ', 'ADMIN'].includes(role || '');

    // Tabs state actualizado para incluir 'importar'
    const [activeTab, setActiveTab] = useState<'maestro' | 'bi' | 'ml' | 'importar'>('maestro');
    const [isExporting, setIsExporting] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        // En Layout.tsx el scroll ocurre en un contenedor con .overflow-y-auto, no en window
        const scrollContainer = document.getElementById('main-scroll-container');
        if (!scrollContainer) return;

        // Establecer estado inicial
        setIsScrolled(scrollContainer.scrollTop > 40);

        const handleScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            setIsScrolled(target.scrollTop > 40);
        };
        
        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, []);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            toast.info("Generando reporte PDF multi-dimensional...");
            const d = new Date();
            const end = d.toISOString();
            d.setDate(d.getDate() - 30);
            const start = d.toISOString();

            const [orchestration, kpis, bcg] = await Promise.all([
                getOrchestration(30),
                getAnalyticsDashboard(start, end),
                getAnalyticsBcg(start, end)
            ]);

            await generateExecutivePDF(kpis?.kpis, bcg, orchestration);
            toast.success("PDF generado exitosamente.");
        } catch (e) {
            const error = e as Error;
            toast.error("Error al exportar PDF: " + error.message);
        } finally {
            setIsExporting(false);
        }
    };

    if (!esAdmin) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center">
                <AlertTriangle className="text-amber-500 mb-4" size={48} />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
                <p className="text-gray-500">Solo perfiles ejecutivos pueden acceder a la Plataforma Analítica.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen pb-20 bg-gray-50">
            {/* Cabecera Superior: Título y Acciones (Se desliza naturalmente con la página) */}
            <div className="bg-white px-4 sm:px-8 py-5 sm:py-6 w-full">
                <div className="max-w-7xl mx-auto flex flex-col justify-center">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-2 lg:mb-4 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center shrink-0">
                                <Building2 size={24} className="text-white" strokeWidth={1.5} />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                                    Centro de Inteligencia 
                                </h1>
                                <p className="text-sm text-gray-500 mt-1 font-medium">Controla tus finanzas, administra tu stock y anticipa tus ventas con IA.</p>
                            </div>
                        </div>

                        {/* Botones de Acción */}
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button 
                                onClick={handleExport}
                                disabled={isExporting}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full font-bold transition shadow-sm text-sm">
                                <DownloadCloud size={16} />
                                <span className="hidden sm:inline">{isExporting ? "Generando..." : "Descargar Informe PDF"}</span>
                                <span className="sm:hidden">PDF</span>
                            </button>
                            <button 
                                onClick={() => setActiveTab('importar')}
                                className={cn(
                                    "flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-bold transition text-sm",
                                    activeTab === 'importar' 
                                        ? "bg-gray-900 text-white shadow-md" 
                                        : "bg-white border border-gray-300 text-gray-900 hover:bg-gray-50"
                                )}>
                                <UploadCloud size={16} />
                                <span className="hidden sm:inline">Importador Datos</span>
                                <span className="sm:hidden">Subir</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fila inferior: Selector de Pestañas (STIKY - Se queda pegada arriba) */}
            <div className={cn(
                "bg-white sticky top-0 z-40 px-4 sm:px-8 w-full border-b border-gray-200 transition-all duration-300",
                isScrolled ? "shadow-md pt-4" : "pt-2"
            )}>
                <div className="max-w-7xl mx-auto flex items-center justify-center w-full">
                    <div className="flex gap-6 sm:gap-12 overflow-x-auto custom-scrollbar no-scrollbar w-full justify-start md:justify-center px-2">
                        <button
                            onClick={() => setActiveTab('maestro')}
                                className={cn(
                                    "flex items-center gap-2 pb-4 sm:pb-5 text-[10px] sm:text-[11px] font-bold tracking-[0.15em] uppercase transition-all whitespace-nowrap border-b-[2px]",
                                    activeTab === 'maestro' 
                                        ? "border-gray-900 text-gray-900" 
                                        : "border-transparent text-gray-400 hover:text-gray-800"
                                )}>
                                <Building2 size={14} strokeWidth={2.5} className={cn(activeTab !== 'maestro' && "opacity-60")} />
                                Panel General
                            </button>
                        
                            <button
                                onClick={() => setActiveTab('bi')}
                                className={cn(
                                    "flex items-center gap-2 pb-4 sm:pb-5 text-[10px] sm:text-[11px] font-bold tracking-[0.15em] uppercase transition-all whitespace-nowrap border-b-[2px]",
                                    activeTab === 'bi' 
                                        ? "border-gray-900 text-gray-900" 
                                        : "border-transparent text-gray-400 hover:text-gray-800"
                                )}>
                                <Lightbulb size={14} strokeWidth={2.5} className={cn(activeTab !== 'bi' && "opacity-60")} />
                                Rentabilidad
                            </button>

                            <button
                                onClick={() => setActiveTab('ml')}
                                className={cn(
                                    "flex items-center gap-2 pb-4 sm:pb-5 text-[10px] sm:text-[11px] font-bold tracking-[0.15em] uppercase transition-all whitespace-nowrap border-b-[2px]",
                                    activeTab === 'ml' 
                                        ? "border-gray-900 text-gray-900" 
                                        : "border-transparent text-gray-400 hover:text-gray-800"
                                )}>
                                <Bot size={14} strokeWidth={2.5} className={cn(activeTab !== 'ml' && "opacity-60")} />
                                Predicciones AI
                            </button>
                            

                    </div>
                </div>
            </div>

            {/* Contenedor del Tab Activo */}
            <div className="flex-1 w-full animate-in fade-in zoom-in-95 duration-500">
                {activeTab === 'maestro' && <DashboardMaestro />}
                {activeTab === 'bi' && <CatalogRentability />}
                {activeTab === 'ml' && <AnaliticaAvanzada />}
                {activeTab === 'importar' && <ImportadorInteligente />}
            </div>

            {/* AI Assistant Floating Component */}
            <ChatbotAnalitico />
        </div>
    );
}
