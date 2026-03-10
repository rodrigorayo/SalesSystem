import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getCajaSesionActiva, abrirCaja, cerrarCaja,
    getResumenCaja, getMovimientos, registrarGasto,
    registrarIngreso,
    getCategoriasGasto, createCategoriaGasto,
    getHistorialCaja,
} from '../api/api';

// ─── Domain types (exported so api.ts can import them) ─────────────────────

export interface CajaSesion {
    _id: string;
    tenant_id: string;
    sucursal_id: string;
    cajero_id: string;
    cajero_name: string;
    monto_inicial: number;
    estado: 'ABIERTA' | 'CERRADA';
    abierta_at: string;
    cerrada_at?: string;
    monto_cierre_fisico?: number;
    notas_cierre?: string;
}

export interface CajaMovimiento {
    _id: string;
    sesion_id: string;
    subtipo: 'APERTURA' | 'VENTA_EFECTIVO' | 'VENTA_QR' | 'VENTA_TARJETA' | 'CAMBIO' | 'GASTO' | 'AJUSTE' | 'INGRESO_EFECTIVO' | 'INGRESO_QR' | 'INGRESO_TARJETA';
    tipo: 'INGRESO' | 'EGRESO';
    monto: number;
    descripcion: string;
    cajero_name: string;
    categoria_id?: string;
    sale_id?: string;
    fecha: string;
}

export interface CajaGastoCategoria {
    _id?: string;
    tenant_id: string;
    nombre: string;
    descripcion?: string;
    icono: string;
}

export interface ResumenCaja {
    sesion_id: string;
    cajero_name: string;
    abierta_at: string;
    monto_inicial: number;
    // cash drawer
    total_efectivo_ventas: number;
    total_cambio: number;
    total_gastos: number;
    saldo_calculado: number;
    // digital channels
    total_qr: number;
    total_tarjeta: number;
    // other
    total_ajustes?: number;
    // manual income
    total_ingresos_efectivo: number;
    total_ingresos_qr: number;
    total_ingresos_tarjeta: number;
    // grand total
    total_ventas_general: number;
    num_transacciones: number;
    movimientos: CajaMovimiento[];
}

export interface CajaSesionResumen {
    id: string;
    cajero_name: string;
    estado: 'ABIERTA' | 'CERRADA';
    abierta_at: string;
    cerrada_at?: string;
    monto_inicial: number;
    saldo_calculado: number;
    total_efectivo: number;
    total_cambio: number;
    total_gastos: number;
    total_ajustes?: number;
    total_qr: number;
    total_tarjeta: number;
    total_ventas: number;
    num_transacciones: number;
    monto_cierre_fisico?: number;
    diferencia?: number;
    notas_cierre?: string;
}

// ─── Request payloads ──────────────────────────────────────────────────────

export interface AbrirCajaIn {
    monto_inicial: number;
    sucursal_id?: string;
}

export interface CerrarCajaIn {
    monto_fisico_contado: number;
    notas?: string;
}

export interface GastoIn {
    monto: number;
    descripcion: string;
    categoria_id?: string;
}

export interface IngresoIn {
    monto: number;
    descripcion: string;
    metodo: 'EFECTIVO' | 'QR' | 'TARJETA';
}

export interface CategoriaGastoIn {
    nombre: string;
    descripcion?: string;
    icono?: string;
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

export function useSesionActiva() {
    return useQuery({
        queryKey: ['caja-sesion'],
        queryFn: getCajaSesionActiva,
        refetchInterval: 30_000,
    });
}

export function useAbrirCaja() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: abrirCaja,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['caja-sesion'] });
            qc.invalidateQueries({ queryKey: ['caja-movimientos'] });
        },
    });
}

export function useCerrarCaja() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ sesionId, data }: { sesionId: string; data: CerrarCajaIn }) =>
            cerrarCaja(sesionId, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['caja-sesion'] });
            qc.invalidateQueries({ queryKey: ['caja-movimientos'] });
            qc.invalidateQueries({ queryKey: ['caja-resumen'] });
        },
    });
}

export function useResumenCaja(sesionId: string | undefined) {
    return useQuery({
        queryKey: ['caja-resumen', sesionId],
        queryFn: () => getResumenCaja(sesionId!),
        enabled: !!sesionId,
    });
}

export function useMovimientos() {
    return useQuery({
        queryKey: ['caja-movimientos'],
        queryFn: getMovimientos,
        refetchInterval: 15_000,
    });
}

export function useRegistrarGasto() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: registrarGasto,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['caja-movimientos'] });
            qc.invalidateQueries({ queryKey: ['caja-sesion'] }); // para actualizar saldos
        },
    });
}

export function useRegistrarIngreso() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: registrarIngreso,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['caja-movimientos'] });
            qc.invalidateQueries({ queryKey: ['caja-sesion'] });
        },
    });
}

export function useCategoriasGasto() {
    return useQuery({
        queryKey: ['caja-categorias'],
        queryFn: getCategoriasGasto,
    });
}

export function useCrearCategoriaGasto() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: createCategoriaGasto,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['caja-categorias'] }),
    });
}

export function useHistorialCaja() {
    return useQuery({
        queryKey: ['caja-historial'],
        queryFn: getHistorialCaja,
    });
}
