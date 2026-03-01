import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const login = useAuthStore((state) => state.login);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // 1. Get Token
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch('http://localhost:8000/api/v1/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Usuario o contraseña incorrectos');
            }

            const data = await response.json();
            const token = data.access_token;

            // 2. Get User Details
            const userResponse = await fetch('http://localhost:8000/api/v1/users/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!userResponse.ok) {
                throw new Error('Error al obtener datos del usuario');
            }

            const userData = await userResponse.json();

            // 3. Update Store
            login(token, userData);
            navigate('/');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Abstract Background Shapes with slow breathing animation */}
            <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/30 rounded-full blur-[120px]"
            />
            <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/30 rounded-full blur-[120px]"
            />

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[#111111]/80 border border-white/5 w-full max-w-sm p-8 rounded-3xl shadow-2xl relative z-10 backdrop-blur-2xl"
            >
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                        className="w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(16,185,129,0.3)] relative group"
                    >
                        <span className="text-2xl font-bold text-white relative z-10">C</span>
                        <div className="absolute inset-0 rounded-2xl bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                        className="text-2xl font-bold text-white tracking-tight mb-1"
                    >
                        Bienvenido
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                        className="text-gray-400 text-sm"
                    >
                        Ingresa a tu cuenta para continuar
                    </motion.p>
                </div>

                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                            className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium text-center flex items-center justify-center gap-2 overflow-hidden"
                        >
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block ml-1">Usuario</label>
                        <div className="relative group">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-medium text-sm hover:border-white/10"
                                placeholder="ej. admin"
                            />
                        </div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block ml-1">Contraseña</label>
                        <div className="relative group">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl py-3 pl-10 pr-10 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-medium text-sm hover:border-white/10"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </motion.div>

                    <motion.button
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] text-sm disabled:opacity-70 disabled:active:scale-100"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : <>Ingresar <ArrowRight size={18} /></>}
                    </motion.button>
                </form>

                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-6 text-center text-xs text-gray-500">
                    ¿No tienes cuenta? <span className="text-white font-medium hover:underline cursor-pointer">Contacta soporte</span>
                </motion.p>
            </motion.div>
        </div>
    );
}
