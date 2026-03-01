import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDescuentos, createDescuento, updateDescuento, deleteDescuento } from '../api/api';
import { type DescuentoCreate, type DescuentoUpdate } from '../api/types';

export function useDescuentos() {
    return useQuery({
        queryKey: ['descuentos'],
        queryFn: getDescuentos,
    });
}

export function useCreateDescuento() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: DescuentoCreate) => createDescuento(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['descuentos'] });
        },
    });
}

export function useUpdateDescuento() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: DescuentoUpdate }) => updateDescuento(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['descuentos'] });
        },
    });
}

export function useDeleteDescuento() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteDescuento(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['descuentos'] });
        },
    });
}
