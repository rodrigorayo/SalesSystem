/**
 * useFeature — Hook para verificar feature flags de forma declarativa en componentes.
 *
 * Uso:
 *   const tieneReportes = useFeature('REPORTES_AVANZADOS');
 *   const tieneCaja = useFeature(FEATURES.CAJA);
 *
 * useAnyFeature — Retorna true si el tenant tiene AL MENOS uno de los flags dados.
 *   const puedeVerModulo = useAnyFeature('PEDIDOS_INTERNOS', 'MULTI_SUCURSAL');
 */
import { useAuthStore } from '../store/authStore';

export function useFeature(flag: string): boolean {
    return useAuthStore(state => state.hasFeature(flag));
}

export function useAnyFeature(...flags: string[]): boolean {
    const hasFeature = useAuthStore(state => state.hasFeature);
    return flags.some(f => hasFeature(f));
}
