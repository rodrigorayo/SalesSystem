import { client } from './client';

export interface Cliente {
    _id: string;
    nombre: string;
    telefono?: string;
    email?: string;
    nit_ci?: string;
    direccion?: string;
    notas?: string;
    lista_precio_id?: string;
    total_compras: number;
    cantidad_compras: number;
    ultima_compra_at?: string;
    is_active: boolean;
    created_at: string;
}

export const getClientes = async (page: number = 1, limit: number = 50, q: string = '') => {
    const skip = (page - 1) * limit;
    let url = `/clientes?skip=${skip}&limit=${limit}`;
    if (q) url += `&q=${encodeURIComponent(q)}`;
    return await client<Cliente[]>(url);
};

export const createCliente = async (cliente: Partial<Cliente>) => {
    return await client<Cliente>('/clientes', { body: cliente });
};

export const updateCliente = async ({ id, data }: { id: string; data: Partial<Cliente> }) => {
    return await client<Cliente>(`/clientes/${id}`, { method: 'PUT', body: data });
};

export const deleteCliente = async (id: string) => {
    return await client<{ message: string }>(`/clientes/${id}`, { method: 'DELETE' });
};

