import { client } from './client';

export interface TrasladoItemCreate {
    producto_id: string;
    cantidad: number;
}

export interface TrasladoCreate {
    destino_tipo: 'SUCURSAL' | 'CLIENTE';
    sucursal_destino_id?: string;
    cliente_destino_id?: string;
    cliente_destino_nombre?: string;
    notas?: string;
    items: TrasladoItemCreate[];
    almacen_id?: string;          // Almacén ORIGEN del que sale el stock
    almacen_destino_id?: string;  // Almacén DESTINO donde recibirán el stock
}

export interface TrasladoItemReceive {
    producto_id: string;
    cantidad_recibida: number;
}

export interface TrasladoReceive {
    notas?: string;
    items: TrasladoItemReceive[];
}

export const despacharTraslado = async (data: TrasladoCreate) => {
    return await client('/traslados/', { body: data, method: 'POST' });
};

export const recibirTraslado = async (trasladoId: string, data: TrasladoReceive) => {
    return await client(`/traslados/${trasladoId}/recibir`, { body: data, method: 'POST' });
};

export const cancelarTraslado = async (trasladoId: string) => {
    return await client(`/traslados/${trasladoId}/cancelar`, { method: 'POST' });
};

export const getTraslados = async (params: { tipo: 'enviados' | 'recibidos' | 'todos', estado?: string, page?: number, page_size?: number }) => {
    const validParams = Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined));
    const queryParams = new URLSearchParams(validParams as any).toString();
    return await client(`/traslados/?${queryParams}`);
};

export const getTrasladoById = async (trasladoId: string) => {
    return await client(`/traslados/${trasladoId}`);
};
