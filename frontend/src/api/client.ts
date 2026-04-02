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

// ─── Error Classification ─────────────────────────────────────────────────────

/**
 * Parsea el cuerpo de una respuesta de error y devuelve un mensaje legible.
 * Soporta: { detail: string }, { detail: [{msg:...}] } (Pydantic), texto plano.
 */
export async function parseApiError(response: Response): Promise<{ message: string; statusCode: number }> {
    const statusCode = response.status;
    let message = 'Ocurrió un error inesperado.';

    try {
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            if (Array.isArray(data.detail)) {
                // Pydantic ValidationError: [{loc, msg, type}, ...]
                const first = data.detail[0];
                const field = first.loc?.filter((x: string) => x !== 'body').join(' → ') ?? '';
                message = field
                    ? `Campo inválido "${field}": ${first.msg}`
                    : first.msg ?? message;
            } else if (typeof data.detail === 'string') {
                message = data.detail;
            }
        } catch {
            message = text || message;
        }
    } catch {
        // No se pudo leer el cuerpo — mantener mensaje genérico
    }

    return { message, statusCode };
}

/**
 * Decide cómo mostrar el error según el código HTTP.
 *
 * 400/404/409 → toast warning  (error del usuario, corregible)
 * 403         → toast con ícono de candado
 * 500/503     → dispara evento para el ErrorModal (error del sistema)
 * network     → toast de conexión
 */
function displayError(message: string, statusCode: number, retryFn?: () => void): void {
    if (statusCode === 403) {
        toast.warning(`🔒 Sin permiso: ${message}`);
        return;
    }

    if (statusCode === 404) {
        toast.error(`🔍 No encontrado: ${message}`);
        return;
    }

    if (statusCode >= 500) {
        // Emitir evento global → ErrorModalProvider lo captura
        window.dispatchEvent(new CustomEvent('api:critical-error', {
            detail: { message, statusCode, retryFn },
        }));
        return;
    }

    // 400, 409, 422 y otros → toast de advertencia amigable
    toast.error(message);
}

// ─── Client ───────────────────────────────────────────────────────────────────

export async function client<T>(
    endpoint: string,
    { body, ...customConfig }: ClientConfig = {}
): Promise<T> {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    const token = useAuthStore.getState().token;
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
        method: body ? 'POST' : 'GET',
        ...customConfig,
        headers: { ...headers, ...customConfig.headers },
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    let response: Response;
    try {
        response = await fetch(`${BASE_URL}${endpoint}`, config);
    } catch {
        // Error de red (sin conexión, servidor caído)
        window.dispatchEvent(new CustomEvent('api:critical-error', {
            detail: {
                message: 'No se pudo conectar con el servidor. Verificá tu conexión a internet.',
                statusCode: 0,
            },
        }));
        throw new Error('Error de conexión');
    }

    if (response.status === 401) {
        useAuthStore.getState().logout();
        toast.error('Tu sesión expiró. Volvé a iniciar sesión.');
        window.location.href = '/login';
        throw new Error('Sesión expirada');
    }

    if (!response.ok) {
        const { message, statusCode } = await parseApiError(response);
        displayError(message, statusCode);
        throw new Error(message);
    }

    try {
        const text = await response.text();
        return text ? JSON.parse(text) : ({} as T);
    } catch (err) {
        console.error('Error al parsear respuesta JSON:', err);
        return {} as T;
    }
}
