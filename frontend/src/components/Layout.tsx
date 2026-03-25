import React, { useState } from 'react';
import {
    LayoutDashboard, Wallet, ShoppingBag, LogOut,
    Tag, Store, Package, ClipboardList, Warehouse, Users,
    Menu, Percent, RotateCcw, X, QrCode, BarChart3, Banknote
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                { icon: BarChart3, label: 'Reportes', path: '/reportes' },
                { icon: Store, label: 'Sucursales', path: '/sucursales' },
                { icon: Package, label: 'Catálogo', path: '/catalogo' },
                { icon: Warehouse, label: 'Inventario', path: '/inventario' },
                { icon: ClipboardList, label: 'Pedidos', path: '/pedidos' },
                { icon: Users, label: 'Personal', path: '/usuarios' },
                { icon: Percent, label: 'Descuentos', path: '/descuentos' },
                { icon: Tag, label: 'Precios', path: '/solicitudes-precio' },
                { icon: Tag, label: 'Categorías', path: '/categories' },
                { icon: Banknote, label: 'Créditos', path: '/creditos' },
                { icon: Wallet, label: 'Caja', path: '/caja' },
                { icon: ShoppingBag, label: 'POS', path: '/pos' },
                { icon: QrCode, label: 'Control QR', path: '/qr-control' },
            ];
        } else if (role === 'ADMIN_SUCURSAL') {
            return [
                { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard-sucursal' },
                { icon: BarChart3, label: 'Reportes', path: '/reportes' },
                { icon: RotateCcw, label: 'Ventas', path: '/ventas' },
                { icon: Package, label: 'Catálogo', path: '/catalogo' },
                { icon: ClipboardList, label: 'Pedidos', path: '/pedidos' },
                { icon: Warehouse, label: 'Inventario', path: '/inventario' },
                { icon: Users, label: 'Personal', path: '/usuarios' },
                { icon: Percent, label: 'Descuentos', path: '/descuentos' },
                { icon: Banknote, label: 'Créditos', path: '/creditos' },
                { icon: ShoppingBag, label: 'POS', path: '/pos' },
                { icon: Wallet, label: 'Caja', path: '/caja' },
                { icon: QrCode, label: 'Control QR', path: '/qr-control' },
            ];
        } else {
            // CAJERO / USER
            return [
                { icon: ShoppingBag, label: 'POS', path: '/pos' },
                { icon: RotateCcw, label: 'Ventas', path: '/ventas' },
                { icon: Banknote, label: 'Créditos', path: '/creditos' },
                { icon: Warehouse, label: 'Inventario', path: '/inventario' },
                { icon: Wallet, label: 'Caja', path: '/caja' },
                { icon: QrCode, label: 'Control QR', path: '/qr-control' },
            ];
        }
    };

    const navItems = getNavItems();
    // Mobile bottom bar shows just top 4 items (most used)
    const mobileBottomItems = navItems.slice(0, 4);

    return (
        <div className="flex h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
            {/* ── Desktop Sidebar (hidden on mobile) ── */}
            <aside className={cn("hidden md:flex flex-col p-4 gap-5 transition-all duration-300 relative", isCollapsed ? "w-20" : "w-52")}>

                {/* Header (Menu Toggle + Brand) */}
                <div className="flex items-center gap-3 px-1 h-8">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    >
                        <Menu size={20} />
                    </button>
                    <div className={cn("flex items-center overflow-hidden transition-all duration-300", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                        <span className="text-base font-bold tracking-tight whitespace-nowrap">Taboada System</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1 custom-scrollbar">
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
                        <div className="w-8 h-8 rounded-full border-2 border-gray-700 bg-white/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-white uppercase">
                                {(user?.username || 'U')[0].toUpperCase()}
                            </span>
                        </div>
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

            {/* ── Main Content Shell ── */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a] md:pr-4 md:py-4">
                <div className="h-full bg-[#f2f4f7] md:rounded-2xl flex flex-col overflow-hidden relative shadow-2xl shadow-black/50 border border-white/5">
                    {/* Mobile Top Bar */}
                    <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shrink-0">
                        <img src="/logoTaboada.png" alt="Taboada System" className="h-7 w-auto object-contain" />
                        <button
                            onClick={() => setMobileMenuOpen(true)}
                            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600"
                        >
                            <Menu size={20} />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className={`flex-1 min-h-0 relative scroll-smooth ${location.pathname === '/pos'
                        ? 'overflow-hidden flex flex-col'
                        : 'overflow-y-auto overflow-x-hidden'
                        }`}>
                        {/* Add bottom padding on mobile so content is not hidden behind bottom nav */}
                        <div className="md:h-0 h-0" />
                        {children}
                    </div>
                </div>
            </main>

            {/* ── Mobile Bottom Nav Bar ── */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex items-stretch">
                {mobileBottomItems.map((item) => {
                    const isActive = item.path !== '/' && location.pathname.startsWith(item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors',
                                isActive ? 'text-indigo-600' : 'text-gray-400'
                            )}
                        >
                            <item.icon size={20} />
                            <span className="text-[10px] font-semibold">{item.label}</span>
                        </Link>
                    );
                })}
                {/* "Más" button if there are more items */}
                {navItems.length > 4 && (
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-gray-400"
                    >
                        <Menu size={20} />
                        <span className="text-[10px] font-semibold">Más</span>
                    </button>
                )}
            </nav>

            {/* ── Mobile Full Menu Drawer ── */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[150] bg-black/60 md:hidden"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="absolute left-0 top-0 bottom-0 w-72 bg-[#0f0f0f] flex flex-col p-6 gap-4 overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <img src="/logoTaboada.png" alt="Taboada System" className="h-8 w-auto object-contain" />
                                <button
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-400"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* User */}
                            <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 mb-2">
                                <div className="w-10 h-10 rounded-full border-2 border-gray-700 bg-white/10 flex items-center justify-center shrink-0 text-white font-bold text-lg">
                                    {(user?.username || 'U')[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{user?.username || 'Usuario'}</p>
                                    <p className="text-xs text-gray-500">{user?.role || 'Miembro'}</p>
                                </div>
                            </div>

                            {/* All Nav Items */}
                            <div className="flex flex-col gap-1 flex-1">
                                {navItems.map((item) => {
                                    const isActive = item.path !== '/' && location.pathname.startsWith(item.path);
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className={cn(
                                                'flex items-center gap-3 rounded-xl py-3 px-3 text-sm font-medium transition-colors',
                                                isActive
                                                    ? 'bg-white text-black'
                                                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                            )}
                                        >
                                            <item.icon size={18} />
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => { setMobileMenuOpen(false); setShowLogoutConfirm(true); }}
                                className="flex items-center gap-3 rounded-xl py-3 px-3 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors mt-auto"
                            >
                                <LogOut size={18} />
                                Cerrar Sesión
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Logout Confirm Modal ── */}
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
