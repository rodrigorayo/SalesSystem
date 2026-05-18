import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClientes, createCliente, updateCliente, deleteCliente } from '../api/clientes';
import { toast } from 'sonner';

export const useClientes = (page: number = 1, limit: number = 50, q: string = '') => {
    return useQuery({
        queryKey: ['clientes', page, limit, q],
        queryFn: () => getClientes(page, limit, q),
    });
};

export const useCreateCliente = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createCliente,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
            toast.success('Cliente creado exitosamente');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.detail || 'Error al crear cliente');
        }
    });
};

export const useUpdateCliente = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateCliente,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
            toast.success('Cliente actualizado exitosamente');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.detail || 'Error al actualizar cliente');
        }
    });
};

export const useDeleteCliente = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteCliente,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
            toast.success('Cliente eliminado exitosamente');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.detail || 'Error al eliminar cliente');
        }
    });
};
