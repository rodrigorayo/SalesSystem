/**
 * Centralized API service layer.
 * All backend route strings are defined here — never scattered in components.
 */
import { client } from './client';
import type {
    Tenant, TenantCreate, TenantUpdate,
    Product, ProductCreate,
    Category, CategoryCreate,
    Descuento, DescuentoCreate, DescuentoUpdate,
    User, EmployeeCreate,
    SaleCreate, Sale,
    Sucursal, SucursalCreate,
    InventarioItem, AjusteInventario, InventoryLog,
    PedidoInterno, PedidoCreate,
    PriceChangeRequest, PriceRequestCreate,
} from './types';
import type {
    CajaSesion, CajaMovimiento as CM, CajaGastoCategoria,
    ResumenCaja, CajaSesionResumen, AbrirCajaIn, CerrarCajaIn, GastoIn, CategoriaGastoIn,
} from '../hooks/useCaja';

// ─── Auth ─────────────────────────────────────────────────────────────────
export const getMe = () => client<User>('/users/me');

// ─── Tenants ──────────────────────────────────────────────────────────────
export const getTenants = () => client<Tenant[]>('/tenants');
export const createTenant = (data: TenantCreate) => client<Tenant>('/tenants', { body: data });
export const updateTenant = (id: string, data: TenantUpdate) => client<Tenant>(`/tenants/${id}`, { method: 'PUT', body: data });
export const deleteTenant = (id: string) => client<{message: string}>(`/tenants/${id}`, { method: 'DELETE' });
export const getTenantStats = () =>
    client<{ total_sales: number; active_products: number; active_employees: number }>('/tenants/stats');

// ─── Sucursales ───────────────────────────────────────────────────────────
export const getSucursales = () => client<Sucursal[]>('/sucursales');
export const createSucursal = (data: SucursalCreate) => client<Sucursal>('/sucursales', { body: data });
export const updateSucursal = (id: string, data: Partial<SucursalCreate>) =>
    client<Sucursal>(`/sucursales/${id}`, { method: 'PUT', body: data });
export const deleteSucursal = (id: string) =>
    client<{message: string}>(`/sucursales/${id}`, { method: 'DELETE' });

// ─── Products (Catalog) ───────────────────────────────────────────────────
export const getProducts = () => client<Product[]>('/products');
export const createProduct = (data: ProductCreate) => client<Product>('/products', { body: data });
export const updateProduct = (id: string, data: ProductCreate) =>
    client<Product>(`/products/${id}`, { method: 'PUT', body: data });

// ─── Inventario ───────────────────────────────────────────────────────────
export const getInventario = (sucursal_id = 'CENTRAL') =>
    client<InventarioItem[]>(`/inventario?sucursal_id=${sucursal_id}`);
export const ajustarInventario = (sucursal_id: string, data: AjusteInventario) =>
    client(`/inventario/ajuste?sucursal_id=${sucursal_id}`, { method: 'POST', body: data });
export const getMovimientosInventario = (sucursal_id = 'CENTRAL', producto_id?: string) => {
    const params = new URLSearchParams({ sucursal_id });
    if (producto_id) params.set('producto_id', producto_id);
    return client<InventoryLog[]>(`/inventario/movimientos?${params.toString()}`);
};

// ─── Pedidos Internos ─────────────────────────────────────────────────────
export const getPedidos = (sucursal_id?: string, estado?: string) => {
    const params = new URLSearchParams();
    if (sucursal_id) params.set('sucursal_id', sucursal_id);
    if (estado) params.set('estado', estado);
    const qs = params.toString();
    return client<PedidoInterno[]>(`/pedidos${qs ? '?' + qs : ''}`);
};
export const createPedido = (data: PedidoCreate) => client<PedidoInterno>('/pedidos', { method: 'POST', body: data });
export const cancelarPedido = (id: string) => client<PedidoInterno>(`/pedidos/${id}/cancelar`, { method: 'PATCH' });
export const aceptarPedido = (id: string) => client<PedidoInterno>(`/pedidos/${id}/aceptar`, { method: 'PATCH' });
export const despacharPedido = (id: string) =>
    client<PedidoInterno>(`/pedidos/${id}/despachar`, { method: 'PATCH' });
export const recibirPedido = (id: string) =>
    client<PedidoInterno>(`/pedidos/${id}/recibir`, { method: 'PATCH' });

// ─── Categories ───────────────────────────────────────────────────────────
export const getCategories = () => client<Category[]>('/categories');
export const createCategory = (data: CategoryCreate) =>
    client<Category>('/categories', { body: data });

// ─── Users / Employees ────────────────────────────────────────────────────
export const getUsers = () => client<User[]>('/users');
export const createEmployee = (data: EmployeeCreate) =>
    client<User>('/users/employee', { body: data });

// ─── Sales ────────────────────────────────────────────────────────────────
export const createSale = (data: SaleCreate) => client('/sales', { method: 'POST', body: data });
export const getSales = (sucursal_id?: string) => {
    const params = new URLSearchParams();
    if (sucursal_id) params.set('sucursal_id', sucursal_id);
    const qs = params.toString();
    return client<Sale[]>(`/sales${qs ? '?' + qs : ''}`);
};
export const getSaleStatsToday = (sucursal_id?: string) => {
    const params = new URLSearchParams();
    if (sucursal_id) params.set('sucursal_id', sucursal_id);
    const qs = params.toString();
    return client<{ today_sales: number; transaction_count: number }>(`/sales/stats/today${qs ? '?' + qs : ''}`);
};
export const anularSale = (id: string) => client<Sale>(`/sales/${id}/anular`, { method: 'PATCH' });


// ─── Caja ─────────────────────────────────────────────────────────────────

export const getCajaSesionActiva = () =>
    client<CajaSesion | null>('/caja/sesion/activa');
export const getHistorialCaja = () =>
    client<CajaSesionResumen[]>('/caja/sesiones');
export const abrirCaja = (data: AbrirCajaIn) =>
    client<CajaSesion>('/caja/sesion/abrir', { body: data });
export const cerrarCaja = (sesionId: string, data: CerrarCajaIn) =>
    client<CajaSesion>(`/caja/sesion/${sesionId}/cerrar`, { body: data });
export const getResumenCaja = (sesionId: string) =>
    client<ResumenCaja>(`/caja/sesion/${sesionId}/resumen`);
export const getMovimientos = () =>
    client<CM[]>('/caja/movimientos');
export const registrarGasto = (data: GastoIn) =>
    client<CM>('/caja/gastos', { body: data });
export const getCategoriasGasto = () =>
    client<CajaGastoCategoria[]>('/caja/categorias-gasto');
export const createCategoriaGasto = (data: CategoriaGastoIn) =>
    client<CajaGastoCategoria>('/caja/categorias-gasto', { body: data });

// ── Descuentos ─────────────────────────────────────────────────────────────
export const getDescuentos = () =>
    client<Descuento[]>('/descuentos/');
export const createDescuento = (data: DescuentoCreate) =>
    client<Descuento>('/descuentos/', { body: data });
export const updateDescuento = (id: string, data: DescuentoUpdate) =>
    client<Descuento>(`/descuentos/${id}`, { method: 'PATCH', body: data });
export const deleteDescuento = (id: string) =>
    client(`/descuentos/${id}`, { method: 'DELETE' });

// ── Precios / Solicitudes ──────────────────────────────────────────────────
export const crearSolicitudPrecio = (data: PriceRequestCreate) =>
    client<PriceChangeRequest>('/price-requests', { method: 'POST', body: data });

export const getSolicitudesPrecio = (estado?: string, sucursal_id?: string) => {
    const params = new URLSearchParams();
    if (estado) params.set('estado', estado);
    if (sucursal_id) params.set('sucursal_id', sucursal_id);
    const qs = params.toString();
    return client<PriceChangeRequest[]>(`/price-requests${qs ? '?' + qs : ''}`);
};

export const responderSolicitudPrecio = (id: string, data: { estado: 'APROBADO' | 'RECHAZADO'; motivo_rechazo?: string }) =>
    client<PriceChangeRequest>(`/price-requests/${id}/respond`, { method: 'POST', body: data });

export const overrideBranchPrice = (sucursal_id: string, producto_id: string, nuevo_precio: number | null) =>
    client('/inventario/override-price', { method: 'POST', body: { sucursal_id, producto_id, nuevo_precio } });

// ── Clientes ──────────────────────────────────────────────────────────────
export const getClientes = (searchTerm?: string) => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('q', searchTerm);
    const qs = params.toString();
    return client<any[]>(`/clientes${qs ? '?' + qs : ''}`);
};

export const createCliente = (data: any) =>
    client<any>('/clientes', { method: 'POST', body: data });

export const updateCliente = (id: string, data: any) =>
    client<any>(`/clientes/${id}`, { method: 'PUT', body: data });

export const deleteCliente = (id: string) =>
    client(`/clientes/${id}`, { method: 'DELETE' });

// ── Listas de Precios ─────────────────────────────────────────────────────
export const getListasPrecios = () => client<any[]>('/listas-precios');
export const createListaPrecio = (data: any) => client<any>('/listas-precios', { method: 'POST', body: data });
export const updateListaPrecio = (id: string, data: any) => client<any>(`/listas-precios/${id}`, { method: 'PUT', body: data });
export const deleteListaPrecio = (id: string) => client(`/listas-precios/${id}`, { method: 'DELETE' });

export const getListaPreciosItems = (lista_id: string) => client<any[]>(`/listas-precios/${lista_id}/items`);
export const addListaPrecioItem = (lista_id: string, data: any) => client<any>(`/listas-precios/${lista_id}/items`, { method: 'POST', body: data });
export const updateListaPrecioItem = (lista_id: string, item_id: string, data: any) => client<any>(`/listas-precios/${lista_id}/items/${item_id}`, { method: 'PUT', body: data });
export const deleteListaPrecioItem = (lista_id: string, item_id: string) => client(`/listas-precios/${lista_id}/items/${item_id}`, { method: 'DELETE' });
