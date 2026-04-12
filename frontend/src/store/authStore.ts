import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../api/types';

// ─── Feature Flags ────────────────────────────────────────────────────────────
export const FEATURES = {
    VENTAS:               'VENTAS',
    INVENTARIO:           'INVENTARIO',
    CAJA:                 'CAJA',
    CAJA_AVANZADA:        'CAJA_AVANZADA',
    CLIENTES:             'CLIENTES',
    CREDITOS:             'CREDITOS',
    DESCUENTOS_AVANZADOS: 'DESCUENTOS_AVANZADOS',
    LISTAS_PRECIOS:       'LISTAS_PRECIOS',
    PRICE_REQUESTS:       'PRICE_REQUESTS',
    REPORTES_AVANZADOS:   'REPORTES_AVANZADOS',
    AUDITORIA:            'AUDITORIA',
    MULTI_SUCURSAL:       'MULTI_SUCURSAL',
    PEDIDOS_INTERNOS:     'PEDIDOS_INTERNOS',
    CONTROL_QR:           'CONTROL_QR',
    API_ACCESO:           'API_ACCESO',
} as const;

interface AuthState {
    token: string | null;
    user: User | null;
    role: string | null;
    sucursal_id: string | null;
    /** Feature flags activos para el tenant del usuario */
    features: string[];
    /** Nombre del plan activo (informativo) */
    planName: string;
    login: (token: string, user: User) => void;
    logout: () => void;
    setFeatures: (features: string[], planName?: string) => void;
    isAuthenticated: () => boolean;
    /** Verifica si el tenant tiene acceso a un módulo específico.
     *  Si features está vacío (aún no cargó), retorna true como fallback seguro. */
    hasFeature: (flag: string) => boolean;
    /** Helpers de rol */
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
            features: [],
            planName: '',
            login: (token, user) => set({
                token,
                role: user.role,
                user,
                sucursal_id: user.sucursal_id ?? null,
            }),
            logout: () => set({ token: null, user: null, role: null, sucursal_id: null, features: [], planName: '' }),
            setFeatures: (features, planName = '') => set({ features, planName }),
            isAuthenticated: () => !!get().token,
            hasFeature: (flag: string) => {
                const { features, role } = get();
                // SUPERADMIN siempre tiene acceso a todo
                if (role === 'SUPERADMIN') return true;
                // Si features aún no cargó → acceso total (fallback seguro, nunca bloquea)
                if (features.length === 0) return true;
                return features.includes(flag);
            },
            isSuperAdmin: () => get().role === 'SUPERADMIN',
            isMatriz: () => ['ADMIN_MATRIZ', 'ADMIN'].includes(get().role ?? ''),
            isSucursal: () => get().role === 'ADMIN_SUCURSAL',
            isCajero: () => ['CAJERO', 'USER'].includes(get().role ?? ''),
        }),
        { name: 'auth-storage' }
    )
);
