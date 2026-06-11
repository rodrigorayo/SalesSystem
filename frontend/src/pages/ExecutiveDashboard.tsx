import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Building2, Lightbulb, Bot, AlertTriangle, UploadCloud } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import DashboardMaestro from './DashboardMaestro';
import CatalogRentability from './CatalogRentability';
import AnaliticaAvanzada from './AnaliticaAvanzada';

import ImportadorInteligente from '../components/DataImporterWizard'; 
import ChatbotAnalitico from '../components/ChatbotAnalitico';


function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function ExecutiveDashboard() {
    const { role } = useAuthStore();
    const esAdmin = ['SUPERADMIN', 'ADMIN_MATRIZ', 'ADMIN'].includes(role || '');

    // Tabs state actualizado para incluir 'importar'
    const [activeTab, setActiveTab] = useState<'maestro' | 'bi' | 'ml' | 'importar'>('maestro');
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
            {/* ── Barra única sticky: Logo · Tabs centrados · Importador ── */}
            <div className={cn(
                "bg-white sticky top-0 z-40 w-full border-b border-gray-200 transition-all duration-300",
                isScrolled ? "shadow-lg" : ""
            )}>
                <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-6">

                    {/* LEFT – Logo + título */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
                            <Building2 size={22} className="text-white" strokeWidth={1.5} />
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="text-xl font-black text-gray-900 tracking-tight leading-tight">
                                Centro de Inteligencia
                            </h1>
                            <p className="text-xs text-gray-400 font-medium">
                                Finanzas · Stock · Predicciones IA
                            </p>
                        </div>
                    </div>

                    {/* CENTER – Tabs con estilo de línea inferior */}
                    <nav className="flex items-stretch h-full gap-1 sm:gap-2">
                        <button
                            onClick={() => setActiveTab('maestro')}
                            className={cn(
                                "flex items-center gap-2 px-4 sm:px-6 text-sm font-bold tracking-wide transition-all duration-200 whitespace-nowrap border-b-[3px] -mb-px",
                                activeTab === 'maestro'
                                    ? "border-gray-900 text-gray-900"
                                    : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300"
                            )}>
                            <Building2 size={16} strokeWidth={2.5} />
                            <span className="hidden sm:inline">Panel General</span>
                            <span className="sm:hidden">Panel</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('bi')}
                            className={cn(
                                "flex items-center gap-2 px-4 sm:px-6 text-sm font-bold tracking-wide transition-all duration-200 whitespace-nowrap border-b-[3px] -mb-px",
                                activeTab === 'bi'
                                    ? "border-gray-900 text-gray-900"
                                    : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300"
                            )}>
                            <Lightbulb size={16} strokeWidth={2.5} />
                            <span className="hidden sm:inline">Rentabilidad</span>
                            <span className="sm:hidden">BI</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('ml')}
                            className={cn(
                                "flex items-center gap-2 px-4 sm:px-6 text-sm font-bold tracking-wide transition-all duration-200 whitespace-nowrap border-b-[3px] -mb-px",
                                activeTab === 'ml'
                                    ? "border-gray-900 text-gray-900"
                                    : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300"
                            )}>
                            <Bot size={16} strokeWidth={2.5} />
                            <span className="hidden sm:inline">Predicciones AI</span>
                            <span className="sm:hidden">AI</span>
                        </button>
                    </nav>

                    {/* RIGHT – Importador Datos */}
                    <button
                        onClick={() => setActiveTab('importar')}
                        className={cn(
                            "shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all duration-200",
                            activeTab === 'importar'
                                ? "bg-gray-900 text-white shadow-md"
                                : "bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                        )}>
                        <UploadCloud size={16} />
                        <span className="hidden sm:inline">Importador Datos</span>
                        <span className="sm:hidden">Subir</span>
                    </button>

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
