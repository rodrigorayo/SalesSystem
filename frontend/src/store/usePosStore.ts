import { create } from 'zustand';
import type { Product } from '../api/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
    product: Product;
    quantity: number;
    /** unit price locked at the moment of adding to cart */
    precio: number;
}

export type MetodoPago = 'EFECTIVO' | 'QR' | 'TARJETA' | 'CREDITO';

export interface PagoEntry {
    metodo: MetodoPago;
    monto: number;
}

export interface ClienteData {
    cliente_id?: string;
    nit: string;
    razon_social: string;
    email: string;
    telefono: string;
    es_factura: boolean;
}

export interface ParkedTicket {
    id: string;
    time: Date;
    items: CartItem[];
    cliente: ClienteData;
    descuento: { tipo: 'MONTO' | 'PORCENTAJE'; valor: string; nombre?: string };
    pagos: PagoEntry[];
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface PosState {
    // Cart
    items: CartItem[];
    addItem: (product: Product) => void;
    removeItem: (productId: string) => void;
    updateQty: (productId: string, delta: number) => void;
    setQty: (productId: string, qty: number) => void;
    clearCart: () => void;

    // Invoice / Client
    cliente: ClienteData;
    setCliente: (data: Partial<ClienteData>) => void;

    // Split payments
    pagos: PagoEntry[];
    pendingPago: { metodo: MetodoPago; monto: string };
    setPendingPago: (p: Partial<PosState['pendingPago']>) => void;
    addPago: () => void;
    removePago: (index: number) => void;
    clearPagos: () => void;

    // Discount
    descuento: { tipo: 'MONTO' | 'PORCENTAJE'; valor: string; nombre?: string };
    setDescuento: (tipo: 'MONTO' | 'PORCENTAJE', valor: string, nombre?: string) => void;

    // Computed (derived in selectors below, stored for convenience)
    total: () => number;
    totalCubierto: () => number;
    restante: () => number;
    cambio: () => number;
    canFinalize: () => boolean;

    // Parked Tickets
    parkedTickets: ParkedTicket[];
    parkTicket: () => void;
    restoreTicket: (index: number) => void;
    removeParkedTicket: (index: number) => void;

    // Full reset
    reset: () => void;
}

const DEFAULT_CLIENTE: ClienteData = { cliente_id: undefined, nit: '', razon_social: '', email: '', telefono: '', es_factura: false };
const DEFAULT_PENDING: PosState['pendingPago'] = { metodo: 'EFECTIVO', monto: '' };
const DEFAULT_DESC: PosState['descuento'] = { tipo: 'MONTO', valor: '', nombre: '' };

export const usePosStore = create<PosState>()((set, get) => ({
    // ── Cart ──────────────────────────────────────────────────────────────────
    items: [],

    addItem: (product) => set((s) => {
        const existing = s.items.find(i => i.product._id === product._id);
        if (existing) {
            return {
                items: s.items.map(i =>
                    i.product._id === product._id ? { ...i, quantity: i.quantity + 1 } : i
                ),
            };
        }
        return { items: [...s.items, { product, quantity: 1, precio: product.precio_venta }] };
    }),

    removeItem: (productId) => set(s => ({ items: s.items.filter(i => i.product._id !== productId) })),

    updateQty: (productId, delta) => set(s => {
        const newItems = s.items.map(i => {
            if (i.product._id === productId) {
                return { ...i, quantity: i.quantity + delta };
            }
            return i;
        }).filter(i => i.quantity > 0);
        return { items: newItems };
    }),

    setQty: (productId, qty) => set(s => ({
        items: s.items.map(i => i.product._id === productId ? { ...i, quantity: Math.max(1, qty) } : i),
    })),

    clearCart: () => set({ items: [] }),

    // ── Client / Invoice ──────────────────────────────────────────────────────
    cliente: DEFAULT_CLIENTE,
    setCliente: (data) => set(s => ({ cliente: { ...s.cliente, ...data } })),

    // ── Split Payments ────────────────────────────────────────────────────────
    pagos: [],
    pendingPago: DEFAULT_PENDING,

    setPendingPago: (p) => set(s => ({ pendingPago: { ...s.pendingPago, ...p } })),

    // ── Discount ──────────────────────────────────────────────────────────────
    descuento: DEFAULT_DESC,
    setDescuento: (tipo, valor, nombre) => set({ descuento: { tipo, valor, nombre } }),

    addPago: () => {
        const { pendingPago, pagos, total } = get();
        const monto = parseFloat(pendingPago.monto);
        if (!monto || monto <= 0) return;
        // Block if ticket is already covered (cambio ya existe)
        const ya_cubierto = pagos.reduce((acc, p) => acc + p.monto, 0);
        if (ya_cubierto >= total()) return;
        // Accept the FULL amount — no capping. This allows EFECTIVO overpayment to show correct change.
        set(s => ({
            pagos: [...s.pagos, { metodo: s.pendingPago.metodo, monto: parseFloat(monto.toFixed(2)) }],
            pendingPago: DEFAULT_PENDING,
        }));
    },

    removePago: (index) => set(s => ({ pagos: s.pagos.filter((_, i) => i !== index) })),
    clearPagos: () => set({ pagos: [] }),

    // ── Computed ──────────────────────────────────────────────────────────────
    total: () => {
        const sub = get().items.reduce((acc, i) => acc + i.precio * i.quantity, 0);
        const desc = get().descuento;
        const val = parseFloat(desc.valor) || 0;
        let finalC = sub;
        if (desc.tipo === 'MONTO') finalC = sub - val;
        else finalC = sub - (sub * val / 100);

        // Redondeo comercial manual (Manejo de monedas físicas)
        const intPart = Math.floor(finalC);
        const frac = finalC - intPart;
        const fracFixed = Math.round(frac * 100) / 100;

        if (fracFixed < 0.5) finalC = intPart;
        else if (fracFixed > 0.5) finalC = intPart + 1;
        else finalC = intPart + 0.5;

        return Math.max(0, finalC);
    },
    totalCubierto: () => get().pagos.reduce((acc, p) => acc + p.monto, 0),
    restante: () => Math.max(0, get().total() - get().totalCubierto()),
    cambio: () => Math.max(0, get().totalCubierto() - get().total()),
    canFinalize: () => get().items.length > 0 && get().restante() <= 0,

    // ── Parked Tickets ────────────────────────────────────────────────────────
    parkedTickets: [],

    parkTicket: () => {
        const state = get();
        if (state.items.length === 0) return; // don't park empty tickets

        const newTicket: ParkedTicket = {
            id: Math.random().toString(36).substring(2, 9),
            time: new Date(),
            items: [...state.items],
            cliente: { ...state.cliente },
            descuento: { ...state.descuento },
            pagos: [...state.pagos]
        };

        set(s => ({
            parkedTickets: [...s.parkedTickets, newTicket],
            items: [],
            cliente: DEFAULT_CLIENTE,
            pagos: [],
            pendingPago: DEFAULT_PENDING,
            descuento: DEFAULT_DESC
        }));
    },

    restoreTicket: (index: number) => {
        const state = get();
        const ticket = state.parkedTickets[index];
        if (!ticket) return;

        // If current ticket is not empty, park it first before restoring
        if (state.items.length > 0) {
            state.parkTicket();
        }

        set(s => {
            // we re-read the array because state.parkTicket() might have appended to it
            const newParked = s.parkedTickets.filter((_, i) => i !== index);
            return {
                parkedTickets: newParked,
                items: ticket.items,
                cliente: ticket.cliente,
                descuento: ticket.descuento,
                pagos: ticket.pagos,
                pendingPago: DEFAULT_PENDING
            };
        });
    },

    removeParkedTicket: (index: number) => set(s => ({
        parkedTickets: s.parkedTickets.filter((_, i) => i !== index)
    })),

    // ── Reset ─────────────────────────────────────────────────────────────────
    reset: () => set({ items: [], cliente: DEFAULT_CLIENTE, pagos: [], pendingPago: DEFAULT_PENDING, descuento: DEFAULT_DESC }),
}));
