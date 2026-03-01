# Plan de Correcciones v2 — SalesSystem
> Arquitectura SaaS Multi-Tenant | Entorno de desarrollo — sin restricciones de producción

---

## Resumen

Este plan **no toca nada de lo que ya funciona bien**. Solo agrega campos, colecciones nuevas y validaciones donde el schema actual tiene huecos. Al estar en desarrollo, todos los cambios se aplican directamente sin scripts de backfill ni precauciones de migración.

| # | Debilidad | Tipo de cambio | Esfuerzo |
|---|---|---|---|
| D-01 | `sales.items` sin schema validado | MongoDB schema validation estricta | 2h |
| D-02 | `pedidos_internos.items` sin colección separada | Nueva colección | 4h |
| D-03 | `caja_sesiones` sin `created_at` | Agregar campo | 15 min |
| D-04 | `price_change_requests` desapareció | Restaurar colección | 2h |
| D-05 | `plans.features` sin estructura canónica | Nueva colección + enum Python | 3h |
| D-06 | Descuentos sin opción global por tenant | Agregar campo | 30 min |
| D-07 | No hay tabla de clientes | Nueva colección | 4h |
| D-08 | No hay listas de precios / precios por volumen | Nuevas colecciones | 1 día |

---

## D-01 — `sales.items` sin Schema Validado

### El problema
`sales.items` es un JSON libre. No hay nada que impida guardar un item malformado, sin `producto_id`, con `cantidad` en string, o sin `precio_unitario`. El problema analítico ya fue resuelto con `sale_items`, pero la integridad del dato original sigue siendo frágil.

### La solución
Agregar **MongoDB Schema Validation estricta** a nivel de colección. En desarrollo se usa `"strict"` — valida absolutamente todo desde el primer insert.

```javascript
db.createCollection("sales", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["tenant_id", "sucursal_id", "items", "total", "cashier_id"],
      properties: {
        items: {
          bsonType: "array",
          minItems: 1,
          items: {
            bsonType: "object",
            required: ["producto_id", "descripcion", "cantidad", "precio_unitario", "subtotal"],
            properties: {
              producto_id:        { bsonType: "string" },
              descripcion:        { bsonType: "string" },
              cantidad:           { bsonType: "int", minimum: 1 },
              precio_unitario:    { bsonType: "double", minimum: 0 },
              costo_unitario:     { bsonType: "double", minimum: 0 },
              descuento_unitario: { bsonType: "double", minimum: 0 },
              subtotal:           { bsonType: "double", minimum: 0 }
            }
          }
        },
        pagos: {
          bsonType: "array",
          minItems: 1,
          items: {
            bsonType: "object",
            required: ["metodo", "monto"],
            properties: {
              metodo: { bsonType: "string", enum: ["EFECTIVO", "QR", "TARJETA", "TRANSFERENCIA"] },
              monto:  { bsonType: "double", minimum: 0 }
            }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})
```

### Modelos Pydantic
```python
class SaleItem(BaseModel):
    producto_id: str
    descripcion: str
    cantidad: int = Field(gt=0)
    precio_unitario: float = Field(ge=0)
    costo_unitario: float = Field(ge=0)
    descuento_unitario: float = Field(ge=0, default=0)
    subtotal: float = Field(ge=0)

class PagoItem(BaseModel):
    metodo: Literal["EFECTIVO", "QR", "TARJETA", "TRANSFERENCIA"]
    monto: float = Field(gt=0)
```

---

## D-02 — `pedidos_internos.items` sin Colección Separada

### El problema
Los items de pedidos internos están embebidos como JSON. Si necesitas responder "¿qué productos se transfirieron entre sucursales este mes?", tienes que deserializar cada documento uno por uno. Es el mismo problema que ya resolviste con `sale_items`.

### La solución
Crear la colección `pedido_items` con el mismo patrón que `sale_items`. Al estar en desarrollo, simplemente defines el modelo y lo usas desde el primer pedido que crees.

#### Nueva colección: `pedido_items`
```dbml
Table pedido_items {
  _id objectid [pk]
  tenant_id varchar
  pedido_id varchar             // Ref a pedidos_internos._id
  sucursal_origen_id varchar
  sucursal_destino_id varchar
  pedido_fecha datetime         // Desnormalizado para queries rápidas
  producto_id varchar
  descripcion varchar           // Snapshot del producto al momento
  cantidad int
  precio_mayorista float
  subtotal float
  created_at datetime
}

Ref: pedido_items.pedido_id > pedidos_internos._id
Ref: pedido_items.producto_id > products._id
Ref: pedido_items.tenant_id > tenants._id
```

#### Modelo Pydantic
```python
class PedidoItem(BaseModel):
    producto_id: str
    descripcion: str
    cantidad: int = Field(gt=0)
    precio_mayorista: float = Field(ge=0)
    subtotal: float = Field(ge=0)

class PedidoItemDocument(Document):
    tenant_id: str
    pedido_id: str
    sucursal_origen_id: str
    sucursal_destino_id: str
    pedido_fecha: datetime
    producto_id: str
    descripcion: str
    cantidad: int
    precio_mayorista: float
    subtotal: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "pedido_items"
        indexes = [
            [("tenant_id", 1), ("producto_id", 1), ("pedido_fecha", -1)],
            [("tenant_id", 1), ("sucursal_origen_id", 1), ("pedido_fecha", -1)],
            [("tenant_id", 1), ("sucursal_destino_id", 1), ("pedido_fecha", -1)],
            [("pedido_id", 1)],
        ]
```

#### Al crear un pedido, escribir en ambas colecciones
```python
async def crear_pedido(pedido_data: PedidoCreate) -> PedidoInterno:
    # 1. Crear el pedido principal
    pedido = PedidoInterno(**pedido_data.dict())
    await pedido.insert()

    # 2. Crear los items en la colección separada
    items_docs = [
        PedidoItemDocument(
            tenant_id=pedido.tenant_id,
            pedido_id=str(pedido.id),
            sucursal_origen_id=pedido.sucursal_origen_id,
            sucursal_destino_id=pedido.sucursal_destino_id,
            pedido_fecha=pedido.created_at,
            **item.dict()
        )
        for item in pedido_data.items
    ]
    await PedidoItemDocument.insert_many(items_docs)

    return pedido
```

---

## D-03 — `caja_sesiones` sin `created_at`

### El problema
Es el único documento en todo el schema sin timestamp de creación. Sin él no puedes ordenar historial de cajas ni hacer reportes de sesiones por día.

### La solución
Una línea en el modelo. Nada más.

```dbml
Table caja_sesiones {
  ...
  created_at datetime    // AGREGAR
}
```

```python
class CajaSesion(Document):
    ...
    abierta_at: datetime
    cerrada_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

---

## D-04 — `price_change_requests` Restaurada

### El problema
Esta colección existía en la v1 y fue eliminada accidentalmente. Permite el flujo de aprobación de cambios de precio por sucursal — una feature de negocio importante que no debe faltar.

### La solución
Restaurarla y mejorarla con `deleted_at` y `deleted_by` para ser consistente con el resto del schema.

#### Colección restaurada y mejorada
```dbml
Table price_change_requests {
  _id objectid [pk]
  tenant_id varchar
  sucursal_id varchar
  producto_id varchar

  // Snapshots — contexto histórico sin depender de joins
  producto_nombre varchar
  sucursal_nombre varchar
  precio_actual float
  precio_propuesto float

  motivo_solicitud varchar
  estado varchar            // PENDIENTE, APROBADO, RECHAZADO

  motivo_rechazo varchar
  respondido_por varchar
  responded_at datetime

  solicitado_por varchar
  solicitado_nombre varchar

  deleted_at datetime
  deleted_by varchar
  created_at datetime
}

Ref: price_change_requests.tenant_id > tenants._id
Ref: price_change_requests.sucursal_id > sucursales._id
Ref: price_change_requests.producto_id > products._id
Ref: price_change_requests.solicitado_por > users._id
Ref: price_change_requests.respondido_por > users._id
```

#### Modelo Pydantic
```python
class EstadoPriceRequest(str, Enum):
    PENDIENTE = "PENDIENTE"
    APROBADO  = "APROBADO"
    RECHAZADO = "RECHAZADO"

class PriceChangeRequest(Document):
    tenant_id: str
    sucursal_id: str
    producto_id: str
    producto_nombre: str
    sucursal_nombre: str
    precio_actual: float
    precio_propuesto: float
    motivo_solicitud: str
    estado: EstadoPriceRequest = EstadoPriceRequest.PENDIENTE
    motivo_rechazo: str | None = None
    respondido_por: str | None = None
    responded_at: datetime | None = None
    solicitado_por: str
    solicitado_nombre: str
    deleted_at: datetime | None = None
    deleted_by: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "price_change_requests"
        indexes = [
            [("tenant_id", 1), ("estado", 1), ("created_at", -1)],
            [("tenant_id", 1), ("sucursal_id", 1), ("estado", 1)],
            [("tenant_id", 1), ("producto_id", 1)],
        ]
```

---

## D-05 — `plans.features` sin Estructura Canónica

### El problema
`features` es un array de strings libre. Un typo como `"reporte_avanzado"` en lugar de `"reportes_avanzados"` hace que la feature nunca se active y es casi imposible de detectar.

### La solución
Una colección `plan_features` como catálogo del sistema y un enum Python como fuente de verdad en el código. Ambas deben estar sincronizadas.

#### Nueva colección: `plan_features`
```dbml
Table plan_features {
  _id objectid [pk]
  code varchar [unique]
  name varchar
  description varchar
  created_at datetime
}
```

#### Seed inicial — ejecutar una vez al inicializar la DB
```python
FEATURES_SEED = [
    { "code": "MULTI_SUCURSAL",       "name": "Múltiples Sucursales",    "description": "Acceso a más de una sucursal" },
    { "code": "REPORTES_AVANZADOS",   "name": "Reportes Avanzados",      "description": "Dashboards y exportaciones" },
    { "code": "API_ACCESO",           "name": "Acceso a API",            "description": "Integración vía REST API" },
    { "code": "PRICE_REQUESTS",       "name": "Solicitudes de Precio",   "description": "Flujo de aprobación de precios" },
    { "code": "PEDIDOS_INTERNOS",     "name": "Pedidos Internos",        "description": "Transferencias entre sucursales" },
    { "code": "DESCUENTOS_AVANZADOS", "name": "Descuentos Avanzados",    "description": "Descuentos con vigencia y horario" },
    { "code": "CLIENTES",             "name": "Gestión de Clientes",     "description": "Historial y fidelización" },
    { "code": "LISTAS_PRECIOS",       "name": "Listas de Precios",       "description": "Precios por segmento o volumen" },
]

async def seed_plan_features():
    for feature in FEATURES_SEED:
        await db.plan_features.update_one(
            { "code": feature["code"] },
            { "$setOnInsert": { **feature, "created_at": datetime.utcnow() } },
            upsert=True
        )
```

#### Enum Python — fuente de verdad
```python
class PlanFeature(str, Enum):
    MULTI_SUCURSAL       = "MULTI_SUCURSAL"
    REPORTES_AVANZADOS   = "REPORTES_AVANZADOS"
    API_ACCESO           = "API_ACCESO"
    PRICE_REQUESTS       = "PRICE_REQUESTS"
    PEDIDOS_INTERNOS     = "PEDIDOS_INTERNOS"
    DESCUENTOS_AVANZADOS = "DESCUENTOS_AVANZADOS"
    CLIENTES             = "CLIENTES"
    LISTAS_PRECIOS       = "LISTAS_PRECIOS"

class Plan(Document):
    ...
    features: list[PlanFeature]  # Ya no es list[str], ahora tipado y validado
```

#### Middleware de validación de features por plan
```python
def require_feature(feature: PlanFeature):
    async def dependency(tenant: Tenant = Depends(get_current_tenant)):
        plan = await Plan.get(tenant.plan_id)
        if feature not in plan.features:
            raise HTTPException(
                status_code=403,
                detail=f"Tu plan no incluye acceso a: {feature.value}"
            )
    return dependency

# Uso en un endpoint:
@router.get(
    "/reportes/avanzados",
    dependencies=[Depends(require_feature(PlanFeature.REPORTES_AVANZADOS))]
)
async def get_reportes_avanzados():
    ...
```

---

## D-06 — Descuentos sin Opción Global por Tenant

### El problema
`sucursal_id` en `descuentos` es requerido implícitamente. Para aplicar el mismo descuento en todas las sucursales hay que crearlo N veces — una por sucursal.

### La solución
Hacer `sucursal_id` nullable y agregar `aplica_todas_sucursales`. En desarrollo simplemente defines los defaults correctos en el modelo desde el inicio.

#### Cambios al schema
```dbml
Table descuentos {
  ...
  sucursal_id varchar                               // MODIFICAR: ahora nullable
  aplica_todas_sucursales boolean [default: false]  // AGREGAR
  ...
}
```

#### Modelo Pydantic actualizado
```python
class Descuento(Document):
    tenant_id: str
    sucursal_id: str | None = None                  # Ahora nullable
    aplica_todas_sucursales: bool = False            # Campo nuevo
    nombre: str
    tipo: Literal["MONTO", "PORCENTAJE"]
    valor: float
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None
    dias_semana: list[int] | None = None
    hora_inicio: str | None = None
    hora_fin: str | None = None
    uso_maximo: int | None = None
    uso_actual: int = 0
    is_active: bool = True
    deleted_at: datetime | None = None
    deleted_by: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @model_validator(mode="after")
    def validar_sucursal(self):
        if not self.aplica_todas_sucursales and not self.sucursal_id:
            raise ValueError("Debe especificar sucursal_id o marcar aplica_todas_sucursales=True")
        return self
```

#### Lógica de evaluación
```python
def descuento_aplica_a_sucursal(descuento: Descuento, sucursal_id: str) -> bool:
    if descuento.aplica_todas_sucursales:
        return True
    return descuento.sucursal_id == sucursal_id
```

---

## D-07 — No hay Tabla de Clientes

### El problema
El cliente está embebido como JSON en cada venta. Imposibilita historial de compras, cálculo de LTV, programas de fidelización y reportes de cliente frecuente.

### La solución
Crear la colección `clientes`. El campo `cliente_id` en `sales` es nullable — las ventas sin cliente identificado siguen funcionando exactamente igual que antes.

#### Nueva colección: `clientes`
```dbml
Table clientes {
  _id objectid [pk]
  tenant_id varchar
  nombre varchar
  telefono varchar
  email varchar
  nit_ci varchar            // Documento de identidad / NIT para facturas
  direccion varchar
  notas varchar
  lista_precio_id varchar   // nullable — ref a listas_precios._id
  total_compras float
  cantidad_compras int
  ultima_compra_at datetime
  is_active boolean [default: true]
  deleted_at datetime
  deleted_by varchar
  created_at datetime
}

Ref: clientes.tenant_id > tenants._id
Ref: clientes.lista_precio_id > listas_precios._id
```

#### Modificación a `sales` — solo agregar, no tocar nada
```dbml
Table sales {
  ...
  cliente_id varchar    // AGREGAR — nullable
  cliente json          // MANTENER como snapshot de la venta
  ...
}
```

#### Modelo Pydantic
```python
class Cliente(Document):
    tenant_id: str
    nombre: str
    telefono: str | None = None
    email: str | None = None
    nit_ci: str | None = None
    direccion: str | None = None
    notas: str | None = None
    lista_precio_id: str | None = None
    total_compras: float = 0.0
    cantidad_compras: int = 0
    ultima_compra_at: datetime | None = None
    is_active: bool = True
    deleted_at: datetime | None = None
    deleted_by: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "clientes"
        indexes = [
            [("tenant_id", 1), ("telefono", 1)],
            [("tenant_id", 1), ("nit_ci", 1)],
            [("tenant_id", 1), ("is_active", 1)],
        ]
```

#### Actualizar totales al registrar una venta con cliente
```python
async def registrar_venta(venta_data: VentaCreate) -> Sale:
    venta = Sale(**venta_data.dict())
    await venta.insert()

    if venta.cliente_id:
        await Cliente.find_one(Cliente.id == PydanticObjectId(venta.cliente_id)).update(
            Inc({Cliente.total_compras: venta.total}),
            Inc({Cliente.cantidad_compras: 1}),
            Set({Cliente.ultima_compra_at: venta.created_at})
        )

    return venta
```

---

## D-08 — No hay Listas de Precios / Precios por Volumen

### El problema
Solo existe `precio_venta` en `products` y `precio_sucursal` en `inventario`. No hay forma de modelar precio mayorista, precio VIP o precio por cantidad mínima.

### La solución
Dos colecciones nuevas: `listas_precios` define los niveles (Mayorista, VIP, Empleados) y `lista_precios_items` asigna el precio específico por producto dentro de cada lista.

#### Nuevas colecciones
```dbml
Table listas_precios {
  _id objectid [pk]
  tenant_id varchar
  nombre varchar            // "Mayorista", "VIP", "Empleados"
  descripcion varchar
  tipo varchar              // FIJO | PORCENTAJE_DESCUENTO
  valor_descuento float     // Solo si tipo = PORCENTAJE_DESCUENTO
  is_active boolean [default: true]
  deleted_at datetime
  deleted_by varchar
  created_at datetime
}

Table lista_precios_items {
  _id objectid [pk]
  tenant_id varchar
  lista_id varchar
  producto_id varchar
  precio_especial float
  cantidad_minima int [default: 1]
  created_at datetime
  updated_at datetime
}

Ref: listas_precios.tenant_id > tenants._id
Ref: lista_precios_items.lista_id > listas_precios._id
Ref: lista_precios_items.producto_id > products._id
Ref: lista_precios_items.tenant_id > tenants._id
```

#### Modelos Pydantic
```python
class TipoListaPrecio(str, Enum):
    FIJO                 = "FIJO"
    PORCENTAJE_DESCUENTO = "PORCENTAJE_DESCUENTO"

class ListaPrecio(Document):
    tenant_id: str
    nombre: str
    descripcion: str | None = None
    tipo: TipoListaPrecio
    valor_descuento: float | None = None
    is_active: bool = True
    deleted_at: datetime | None = None
    deleted_by: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "listas_precios"

class ListaPrecioItem(Document):
    tenant_id: str
    lista_id: str
    producto_id: str
    precio_especial: float = Field(ge=0)
    cantidad_minima: int = Field(ge=1, default=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "lista_precios_items"
        indexes = [
            IndexModel(
                [("tenant_id", 1), ("lista_id", 1), ("producto_id", 1)],
                unique=True
            ),
            [("tenant_id", 1), ("producto_id", 1)],
        ]
```

#### Lógica de resolución de precio
```python
async def resolver_precio(
    producto_id: str,
    precio_base: float,
    cliente_id: str | None,
    cantidad: int,
    tenant_id: str
) -> float:
    if not cliente_id:
        return precio_base

    cliente = await Cliente.get(PydanticObjectId(cliente_id))
    if not cliente or not cliente.lista_precio_id:
        return precio_base

    lista = await ListaPrecio.get(PydanticObjectId(cliente.lista_precio_id))
    if not lista or not lista.is_active:
        return precio_base

    # Lista por porcentaje — aplica directo sin buscar item
    if lista.tipo == TipoListaPrecio.PORCENTAJE_DESCUENTO:
        return round(precio_base * (1 - lista.valor_descuento / 100), 2)

    # Lista fija — buscar precio específico para este producto
    item = await ListaPrecioItem.find_one({
        "lista_id": cliente.lista_precio_id,
        "producto_id": producto_id,
        "cantidad_minima": { "$lte": cantidad }
    })

    return item.precio_especial if item else precio_base
```

---

## Schema Final — Solo las Diferencias

```dbml
// ── RESTAURADA ──────────────────────────────────────────────
Table price_change_requests {
  _id objectid [pk]
  tenant_id varchar
  sucursal_id varchar
  producto_id varchar
  producto_nombre varchar
  sucursal_nombre varchar
  precio_actual float
  precio_propuesto float
  motivo_solicitud varchar
  estado varchar            // PENDIENTE, APROBADO, RECHAZADO
  motivo_rechazo varchar
  respondido_por varchar
  responded_at datetime
  solicitado_por varchar
  solicitado_nombre varchar
  deleted_at datetime
  deleted_by varchar
  created_at datetime
}

// ── NUEVAS ───────────────────────────────────────────────────
Table plan_features {
  _id objectid [pk]
  code varchar [unique]
  name varchar
  description varchar
  created_at datetime
}

Table clientes {
  _id objectid [pk]
  tenant_id varchar
  nombre varchar
  telefono varchar
  email varchar
  nit_ci varchar
  direccion varchar
  notas varchar
  lista_precio_id varchar   // nullable
  total_compras float
  cantidad_compras int
  ultima_compra_at datetime
  is_active boolean [default: true]
  deleted_at datetime
  deleted_by varchar
  created_at datetime
}

Table pedido_items {
  _id objectid [pk]
  tenant_id varchar
  pedido_id varchar
  sucursal_origen_id varchar
  sucursal_destino_id varchar
  pedido_fecha datetime
  producto_id varchar
  descripcion varchar
  cantidad int
  precio_mayorista float
  subtotal float
  created_at datetime
}

Table listas_precios {
  _id objectid [pk]
  tenant_id varchar
  nombre varchar
  descripcion varchar
  tipo varchar              // FIJO | PORCENTAJE_DESCUENTO
  valor_descuento float
  is_active boolean [default: true]
  deleted_at datetime
  deleted_by varchar
  created_at datetime
}

Table lista_precios_items {
  _id objectid [pk]
  tenant_id varchar
  lista_id varchar
  producto_id varchar
  precio_especial float
  cantidad_minima int [default: 1]
  created_at datetime
  updated_at datetime
}

// ── CAMPOS AGREGADOS A TABLAS EXISTENTES ─────────────────────
// caja_sesiones    → + created_at datetime
// descuentos       → + aplica_todas_sucursales boolean
//                    ~ sucursal_id ahora nullable
// sales            → + cliente_id varchar (nullable)
// clientes         → + lista_precio_id varchar (nullable)
// plans.features   → list[str] → list[PlanFeature] en Pydantic
```

---

## Orden de Implementación

```
Día 1  — Cambios simples, sin dependencias
├── D-03  caja_sesiones + created_at
├── D-04  Restaurar price_change_requests
└── D-06  descuentos + aplica_todas_sucursales

Día 2  — Validaciones y tipado
├── D-01  Schema validation estricta en sales
└── D-05  plan_features + enum PlanFeature + middleware

Día 3  — Colecciones de analytics
└── D-02  pedido_items + lógica de escritura doble al crear pedido

Día 4  — Módulo de clientes
└── D-07  clientes + índices + actualización de totales en ventas

Día 5  — Módulo de precios
└── D-08  listas_precios + lista_precios_items + resolver_precio
```

---

*Plan generado para entorno de desarrollo — SalesSystem v2*
