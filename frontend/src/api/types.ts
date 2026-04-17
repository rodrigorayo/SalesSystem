export type UserRole = 'SUPERADMIN' | 'ADMIN_MATRIZ' | 'ADMIN' | 'USER' | 'ADMIN_SUCURSAL' | 'CAJERO' | 'SUPERVISOR' | 'VENDEDOR';

export interface User {
    _id: string;
    username: string;
    role: UserRole;
    full_name?: string;
    tenant_id?: string;
    sucursal_id?: string;
}

export interface Tenant {
    _id: string;
    name: string;
    plan: string;
    is_active: boolean;
    created_at: string;
}

export interface TenantCreate {
    name: string;
    plan: string;
    admin_username: string;
    admin_password: string;
}

export interface TenantUpdate {
    name?: string;
    plan?: string;
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
    tipo?: 'FISICA' | 'SUPERVISOR' | 'VENDEDOR';
    created_at: string;
}

export interface SucursalCreate {
    nombre: string;
    ciudad: string;
    direccion: string;
    telefono?: string;
    tipo?: 'FISICA' | 'SUPERVISOR' | 'VENDEDOR';
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
    proveedor?: string;
    descripcion: string;          // product name
    categoria_id: string;
    categoria_nombre?: string;    // resolved at query time
    costo_producto: number;       // production/purchase cost
    precio_venta: number;         // retail price
    image_url?: string;
    is_active?: boolean;
    precios_sucursales?: Record<string, number>; // sucursal_id -> branch specific price
}

export interface ProductCreate {
    descripcion: string;
    categoria_id: string;
    precio_venta?: number;
    costo_producto?: number;
    codigo_largo?: string;
    codigo_corto?: string;
    proveedor?: string;
    image_url?: string;
    precios_sucursales?: Record<string, number>;
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
    costo_unitario_momento?: number;
    precio_venta_momento?: number;
    created_at: string;
}

export interface PedidoItem {
    producto_id: string;
    producto_nombre: string;
    descripcion?: string;
    cantidad: number;
    precio_mayorista: number;
}

export interface PedidoInterno {
    _id: string;
    tenant_id: string;
    sucursal_id: string;
    sucursal_origen_id?: string;
    sucursal_destino_id?: string;
    tipo_pedido?: string;
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
    sucursal_origen_id?: string;
    sucursal_destino_id?: string;
    transferencia_directa?: boolean;
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
    is_active: boolean;
    fecha_inicio?: string;
    fecha_fin?: string;
    creado_por_rol: string;
    created_at: string;
    updated_at: string;
}

export interface DescuentoCreate {
    nombre: string;
    tipo: 'MONTO' | 'PORCENTAJE';
    valor: number;
    sucursal_id?: string;
    aplica_todas_sucursales: boolean;
    is_active: boolean;
    fecha_inicio?: string;
    fecha_fin?: string;
}

export interface DescuentoUpdate {
    nombre?: string;
    tipo?: 'MONTO' | 'PORCENTAJE';
    valor?: number;
    sucursal_id?: string;
    aplica_todas_sucursales?: boolean;
    is_active?: boolean;
    fecha_inicio?: string;
    fecha_fin?: string;
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
    role?: 'CAJERO' | 'SUPERVISOR' | 'VENDEDOR';
}

export interface CartItem {
    product: InventarioItem;
    quantity: number;
}

export interface SaleCreate {
    items: { product_id: string; quantity: number; price_at_sale?: number }[];
    total: number;
    payment_method: 'EFECTIVO' | 'TARJETA' | 'QR' | 'CREDITO';
    cashier_name: string;
    sucursal_id?: string;
    cliente_id?: string;
    cliente?: {
        nit?: string;
        razon_social?: string;
        email?: string;
        telefono?: string;
        es_factura: boolean;
    };
}

export interface PagoItem {
    metodo: string;
    monto: number;
}

export interface QRInfo {
    banco?: string;
    referencia?: string;
    monto_transferido?: number;
    confirmado: boolean;
    confirmado_at?: string;
    confirmado_por?: string;
}

export interface ReportStats {
    kpis: {
        total_ventas: number;
        total_productos: number;
        ganancia_matriz: number;
        ganancia_sucursal: number;
    };
    por_sucursal: {
        sucursal: string;
        total_ventas: number;
        ganancia_matriz: number;
        ganancia_sucursal: number;
    }[];
    top_productos: {
        producto: string;
        cantidad_vendida: number;
        total_ventas: number;
        ganancia_matriz: number;
        ganancia_sucursal: number;
    }[];
    evolucion_diaria: {
        fecha: string;
        total_ventas: number;
        ganancia_matriz: number;
        ganancia_sucursal: number;
    }[];
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
    cliente?: {
        nit?: string;
        razon_social?: string;
        email?: string;
        telefono?: string;
        es_factura: boolean;
    };
    qr_info?: QRInfo;
    cashier_id: string;
    cashier_name: string;
    anulada: boolean;
    estado_pago?: 'PAGADO' | 'PENDIENTE' | 'PARCIAL';
    factura_emitida?: boolean;
    created_at: string;
}

export interface SalesPaginated {
    items: Sale[];
    total: number;
    page: number;
    pages: number;
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
