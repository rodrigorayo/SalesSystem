export interface User {
    _id: string;
    username: string;
    role: 'SUPERADMIN' | 'ADMIN_MATRIZ' | 'ADMIN_SUCURSAL' | 'CAJERO' | 'ADMIN' | 'USER';
    full_name?: string;
    tenant_id?: string;
    sucursal_id?: string;
}

export interface Tenant {
    _id: string;
    name: string;
    plan: 'BASIC' | 'PRO';
    is_active: boolean;
    created_at: string;
}

export interface TenantCreate {
    name: string;
    plan: 'BASIC' | 'PRO';
    admin_username: string;
    admin_password: string;
}

export interface TenantUpdate {
    name?: string;
    plan?: 'BASIC' | 'PRO';
    is_active?: boolean;
}

export interface Sucursal {
    _id: string;
    tenant_id: string;
    nombre: string;
    ciudad: string;
    direccion: string;
    telefono?: string;
    is_active: boolean;
    created_at: string;
}

export interface SucursalCreate {
    nombre: string;
    ciudad: string;
    direccion: string;
    telefono?: string;
    admin_username: string;
    admin_password: string;
}

/** Canonical product model matching the backend Product document. */
export interface Product {
    _id: string;
    tenant_id: string;
    codigo_sistema?: string;
    codigo_largo?: string;
    codigo_corto?: string;
    descripcion: string;          // product name
    categoria_id: string;
    categoria_nombre?: string;    // resolved at query time
    costo_producto: number;       // production/purchase cost
    precio_venta: number;         // retail price
    image_url?: string;
    is_active?: boolean;
}

export interface ProductCreate {
    descripcion: string;
    categoria_id: string;
    precio_venta: number;
    costo_producto?: number;
    codigo_largo?: string;
    codigo_corto?: string;
    image_url?: string;
}

export interface ProductUpdate extends Partial<ProductCreate> { }

export interface InventarioItem {
    inventario_id: string;
    producto_id: string;
    producto_nombre: string;
    precio: number;
    precio_sucursal?: number;
    image_url?: string;
    sucursal_id: string;
    cantidad: number;
}

export interface AjusteInventario {
    producto_id: string;
    tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
    cantidad: number;
    notas?: string;
}

export interface InventoryLog {
    _id: string;
    tenant_id: string;
    sucursal_id: string;
    producto_id: string;
    producto_nombre?: string;
    tipo_movimiento: 'ENTRADA_MANUAL' | 'SALIDA_MANUAL' | 'AJUSTE_FISICO' | 'VENTA' | 'COMPRA' | 'TRASLADO';
    cantidad_movida: number;
    stock_resultante: number;
    usuario_nombre: string;
    notas: string;
    created_at: string;
}

export interface PedidoItem {
    producto_id: string;
    producto_nombre: string;
    cantidad: number;
    precio_mayorista: number;
}

export interface PedidoInterno {
    _id: string;
    tenant_id: string;
    sucursal_id: string;
    estado: 'CREADO' | 'ACEPTADO' | 'DESPACHADO' | 'RECIBIDO' | 'CANCELADO';
    items: PedidoItem[];
    notas?: string;
    total_mayorista: number;
    created_at: string;
    despachado_at?: string;
    recibido_at?: string;
    aceptado_at?: string;
    cancelado_at?: string;
}

export interface PedidoCreate {
    sucursal_id: string;
    items: { producto_id: string; cantidad: number }[];
    notas?: string;
}

export interface Category {
    _id: string;
    tenant_id: string;
    name: string;
    description?: string;
}

export interface CategoryCreate {
    name: string;
    description?: string;
}

export interface Descuento {
    _id: string;
    tenant_id: string;
    sucursal_id?: string;
    aplica_todas_sucursales: boolean;
    nombre: string;
    tipo: 'MONTO' | 'PORCENTAJE';
    valor: number;
    activo: boolean;
    created_at: string;
    updated_at: string;
}

export interface DescuentoCreate {
    nombre: string;
    tipo: 'MONTO' | 'PORCENTAJE';
    valor: number;
    sucursal_id?: string;
    aplica_todas_sucursales: boolean;
    activo: boolean;
}

export interface DescuentoUpdate {
    nombre?: string;
    tipo?: 'MONTO' | 'PORCENTAJE';
    valor?: number;
    sucursal_id?: string;
    aplica_todas_sucursales?: boolean;
    activo?: boolean;
}

export interface GastoCreate {
    monto: number;
    descripcion: string;
    categoria_id?: string;
}

export interface CategoriaGasto {
    _id: string;
    nombre: string;
    descripcion?: string;
    icono?: string;
}

export interface EmployeeCreate {
    username: string;
    email: string;
    password: string;
    full_name: string;
}

export interface CartItem {
    product: InventarioItem;
    quantity: number;
}

export interface SaleCreate {
    items: { product_id: string; quantity: number; price_at_sale?: number }[];
    total: number;
    payment_method: 'EFECTIVO' | 'TARJETA' | 'QR';
    cashier_name: string;
    sucursal_id?: string;
}

export interface PagoItem {
    metodo: string;
    monto: number;
}

export interface Sale {
    _id: string;
    tenant_id: string;
    sucursal_id: string;
    items: {
        producto_id: string;
        descripcion: string;
        cantidad: number;
        precio_unitario: number;
        costo_unitario: number;
        descuento_unitario: number;
        subtotal: number;
    }[];
    total: number;
    pagos: PagoItem[];
    descuento?: { nombre?: string; tipo: string; valor: number };
    cliente_id?: string;
    cliente?: { nit?: string; razon_social?: string; email?: string; es_factura: boolean };
    cashier_id: string;
    cashier_name: string;
    anulada: boolean;
    created_at: string;
}

export interface Cliente {
    _id: string;
    tenant_id: string;
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

export interface ClienteCreate {
    nombre: string;
    telefono?: string;
    email?: string;
    nit_ci?: string;
    direccion?: string;
    notas?: string;
    lista_precio_id?: string;
}

export interface ClienteUpdate extends Partial<ClienteCreate> {
    is_active?: boolean;
}

export interface ListaPrecio {
    _id: string;
    tenant_id: string;
    nombre: string;
    descripcion?: string;
    tipo: 'FIJO' | 'PORCENTAJE_DESCUENTO';
    valor_descuento?: number;
    is_active: boolean;
    created_at: string;
}

export interface ListaPrecioCreate {
    nombre: string;
    descripcion?: string;
    tipo: 'FIJO' | 'PORCENTAJE_DESCUENTO';
    valor_descuento?: number;
}

export interface ListaPrecioItem {
    _id: string;
    tenant_id: string;
    lista_id: string;
    producto_id: string;
    precio_especial: number;
    cantidad_minima: number;
    created_at: string;
    updated_at: string;
}

export interface ListaPrecioItemCreate {
    producto_id: string;
    precio_especial: number;
    cantidad_minima?: number;
}

export interface PriceChangeRequest {
    _id: string;
    tenant_id: string;
    sucursal_id: string;
    producto_id: string;
    producto_nombre?: string;
    sucursal_nombre?: string;
    precio_actual: number;
    precio_propuesto: number;
    motivo_solicitud: string;
    estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
    motivo_rechazo?: string;
    solicitado_por: string;
    solicitado_nombre?: string;
    respondido_por?: string;
    created_at: string;
    responded_at?: string;
}

export interface PriceRequestCreate {
    sucursal_id: string;
    producto_id: string;
    precio_propuesto: number;
    motivo_solicitud: string;
}
