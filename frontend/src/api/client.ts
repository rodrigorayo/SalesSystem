import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';

interface ClientConfig extends Omit<RequestInit, 'body'> {
    body?: any;
}

const isProductionUrl = window.location.hostname.includes('vercel.app');
const FALLBACK_URL = isProductionUrl 
    ? 'https://sales-system-kappa.vercel.app/api/v1' 
    : 'http://localhost:8000/api/v1';

export const BASE_URL = import.meta.env.VITE_API_URL ?? FALLBACK_URL;

export async function client<T>(
    endpoint: string,
    { body, ...customConfig }: ClientConfig = {}
): Promise<T> {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    // Add Auth Token
    const token = useAuthStore.getState().token;
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
        method: body ? 'POST' : 'GET',
        ...customConfig,
        headers: {
            ...headers,
            ...customConfig.headers,
        },
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    let response: Response;
    try {
        response = await fetch(`${BASE_URL}${endpoint}`, config);
    } catch (error) {
        toast.error('Error de conexión con el servidor. Revisa tu internet.');
        throw error;
    }

    if (response.status === 401) {
        useAuthStore.getState().logout();
        toast.error('Tu sesión ha expirado, vuelve a ingresar.');
        window.location.href = '/login'; // Force redirect
        throw new Error('Sesión expirada');
    }

    if (!response.ok) {
        let errorMessage = 'Error en la petición';
        try {
            const errorData = await response.json();
            // Soporte para los ValidationError de Pydantic FastAPI
            if (errorData.detail && Array.isArray(errorData.detail)) {
                errorMessage = errorData.detail[0].msg || 'Datos inválidos enviados al servidor';
            } else if (errorData.detail) {
                errorMessage = errorData.detail;
            }
        } catch {
            errorMessage = await response.text() || errorMessage;
        }
        
        // Show the beautiful sonner toast error specifically for the user
        toast.error(errorMessage);
        throw new Error(errorMessage);
    }

    try {
        const text = await response.text();
        return text ? JSON.parse(text) : ({} as T);
    } catch (err) {
        console.error("Error parsing JSON response:", err);
        return {} as T;
    }
}
