import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../api/types';

interface AuthState {
    token: string | null;
    user: User | null;
    role: string | null;
    sucursal_id: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: () => boolean;
    /** Helpers for role checks */
    isSuperAdmin: () => boolean;
    isMatriz: () => boolean;
    isSucursal: () => boolean;
    isCajero: () => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            user: null,
            role: null,
            sucursal_id: null,
            login: (token, user) => set({
                token,
                role: user.role,
                user,
                sucursal_id: user.sucursal_id ?? null,
            }),
            logout: () => set({ token: null, user: null, role: null, sucursal_id: null }),
            isAuthenticated: () => !!get().token,
            isSuperAdmin: () => get().role === 'SUPERADMIN',
            isMatriz: () => ['ADMIN_MATRIZ', 'ADMIN'].includes(get().role ?? ''),
            isSucursal: () => get().role === 'ADMIN_SUCURSAL',
            isCajero: () => ['CAJERO', 'USER'].includes(get().role ?? ''),
        }),
        { name: 'auth-storage' }
    )
);
