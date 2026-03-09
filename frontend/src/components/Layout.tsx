import React, { useState } from 'react';
import {
    LayoutDashboard, Wallet, ShoppingBag, LogOut,
    Tag, Store, Package, ClipboardList, Warehouse, Users,
    Menu, Percent, RotateCcw
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useLocalStorage } from 'usehooks-ts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AnimatePresence, motion } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const location = useLocation();
    const { logout, user, role } = useAuthStore();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useLocalStorage('choco-sidebar-collapsed', false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const handleLogout = () => {
        localStorage.clear();
        logout();
        navigate('/login');
    };

    const getNavItems = () => {
        if (role === 'SUPERADMIN') {
            return [
                { icon: LayoutDashboard, label: 'Panel SaaS', path: '/admin' },
            ];
        } else if (['ADMIN_MATRIZ', 'ADMIN'].includes(role ?? '')) {
            return [
                { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
                { icon: Store, label: 'Sucursales', path: '/sucursales' },
                { icon: Package, label: 'Catálogo', path: '/catalogo' },
                { icon: Warehouse, label: 'Inventario', path: '/inventario' },
                { icon: ClipboardList, label: 'Pedidos', path: '/pedidos' },
                { icon: Users, label: 'Personal', path: '/usuarios' },
                { icon: Percent, label: 'Descuentos', path: '/descuentos' },
                { icon: Tag, label: 'Precios', path: '/solicitudes-precio' },
                { icon: Tag, label: 'Categorías', path: '/categories' },
                { icon: Wallet, label: 'Caja', path: '/caja' },
                { icon: ShoppingBag, label: 'POS', path: '/pos' },
            ];
        } else if (role === 'ADMIN_SUCURSAL') {
            return [
                { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard-sucursal' },
                { icon: RotateCcw, label: 'Ventas (Tickets)', path: '/ventas' },
                { icon: Package, label: 'Catálogo', path: '/catalogo' },
                { icon: ClipboardList, label: 'Pedidos', path: '/pedidos' },
                { icon: Warehouse, label: 'Inventario', path: '/inventario' },
                { icon: Users, label: 'Personal', path: '/usuarios' },
                { icon: Percent, label: 'Descuentos', path: '/descuentos' },
                { icon: ShoppingBag, label: 'POS', path: '/pos' },
                { icon: Wallet, label: 'Caja', path: '/caja' },
            ];
        } else {
            // CAJERO / USER
            return [
                { icon: ShoppingBag, label: 'POS', path: '/pos' },
                { icon: RotateCcw, label: 'Ventas (Tickets)', path: '/ventas' },
                { icon: Warehouse, label: 'Inventario', path: '/inventario' },
                { icon: Wallet, label: 'Caja', path: '/caja' },
            ];
        }
    };

    const navItems = getNavItems();

    return (
        <div className="flex h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className={cn("flex flex-col p-4 gap-5 transition-all duration-300 relative", isCollapsed ? "w-20" : "w-52")}>

                {/* Header (Menu Toggle + Brand) */}
                <div className="flex items-center gap-3 px-1 h-8">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    >
                        <Menu size={20} />
                    </button>
                    <div className={cn("flex items-center overflow-hidden transition-all duration-300", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                        <span className="text-base font-bold tracking-tight whitespace-nowrap">Choco-Sys</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 flex flex-col gap-1">
                    <p className={cn("text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 transition-all", isCollapsed ? "text-center px-0" : "px-1")}>
                        {isCollapsed ? '•••' : 'Menu'}
                    </p>
                    {navItems.map((item) => {
                        const isActive = item.path !== '/' && location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                title={isCollapsed ? item.label : undefined}
                                className={cn(
                                    'flex items-center gap-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden text-sm shrink-0',
                                    isCollapsed ? 'justify-center w-11 h-11 mx-auto' : 'py-2.5 px-3',
                                    isActive
                                        ? 'bg-white text-black shadow-lg shadow-white/10 font-medium'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                )}
                            >
                                <item.icon size={isCollapsed ? 18 : 16} className={cn("transition-colors shrink-0", isActive ? "text-black" : "text-gray-400 group-hover:text-white")} />
                                <div className={cn("overflow-hidden transition-all duration-300 flex items-center", isCollapsed ? "w-0 opacity-0" : "w-full opacity-100")}>
                                    <span className="whitespace-nowrap">{item.label}</span>
                                </div>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile / Logout */}
                <div className="mt-auto pt-4 border-t border-gray-800 flex flex-col gap-2">
                    <div className={cn("flex items-center gap-2 p-1 rounded-xl", isCollapsed ? "justify-center" : "")}>
                        <img
                            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                            alt="User"
                            className="w-8 h-8 rounded-full border-2 border-gray-700 shrink-0"
                        />
                        <div className={cn("overflow-hidden transition-all duration-300 flex flex-col justify-center", isCollapsed ? "w-0 opacity-0" : "w-full opacity-100")}>
                            <p className="text-xs font-medium text-white truncate">{user?.username || 'Usuario'}</p>
                            <p className="text-[10px] text-gray-500 truncate">{user?.role || 'Miembro'}</p>
                        </div>
                    </div>
                    <button onClick={() => setShowLogoutConfirm(true)} title={isCollapsed ? "Cerrar Sesión" : undefined} className={cn("flex items-center gap-2 w-full p-2 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors group", isCollapsed ? "justify-center" : "")}>
                        <LogOut size={16} className="shrink-0" />
                        <div className={cn("overflow-hidden transition-all duration-300 flex items-center", isCollapsed ? "w-0 opacity-0" : "w-full opacity-100")}>
                            <span className="text-xs font-medium whitespace-nowrap">Cerrar Sesión</span>
                        </div>
                    </button>
                </div>
            </aside>

            {/* Main Content Shell */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a] pr-4 py-4">
                <div className="h-full bg-[#f2f4f7] rounded-2xl flex flex-col overflow-hidden relative shadow-2xl shadow-black/50 border border-white/5">


                    {/* Scrollable Content — for /pos we let the page manage its own scroll */}
                    <div className={`flex-1 min-h-0 relative scroll-smooth ${location.pathname === '/pos'
                        ? 'overflow-hidden flex flex-col'
                        : 'overflow-y-auto overflow-x-hidden'
                        }`}>
                        {children}
                    </div>
                </div>
            </main>
            {/* Error Overlay / Fallback for Layout Children */}
            <AnimatePresence>
                {showLogoutConfirm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-200">
                            <div className="flex justify-center mb-4">
                                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                                    <LogOut size={24} />
                                </div>
                            </div>
                            <h3 className="text-lg font-black text-gray-900 text-center mb-2">¿Seguro que deseas salir?</h3>
                            <p className="text-sm text-gray-500 text-center mb-6">Tu sesión actual se cerrará y se limpiarán los datos temporales del navegador.</p>

                            <div className="flex gap-3 w-full">
                                <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                                    Cancelar
                                </button>
                                <button onClick={handleLogout} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm shadow-red-200 flex items-center justify-center gap-2">
                                    Salir
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
