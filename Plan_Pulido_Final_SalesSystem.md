# Plan de Pulido Final — SalesSystem v2
> El objetivo no es la perfección teórica. Es eliminar los últimos huecos reales antes de que se conviertan en problemas en producción.

---

## Regla de Oro de Este Plan

> **No se toca nada de lo que ya funciona.** Cada cambio aquí es una adición o una corrección mínima y quirúrgica. Si algo no está en este documento, no se modifica.

---

## Resumen de Cambios

| # | Problema | Cambio | Tipo | Esfuerzo |
|---|---|---|---|---|
| P-01 | `caja_gasto_categorias` desapareció | Restaurar colección | Agregar | 1h |
| P-02 | `product_cost_history` no está | Agregar colección + trigger | Agregar | 3h |
| P-03 | `caja_movimientos` sin `created_at` | Agregar campo | Agregar | 15 min |
| P-04 | `inventario` e `inventory_logs` sin `tenant_id` en Refs | Verificar y corregir | Verificar | 30 min |
| P-05 | `pedidos_internos.items` sin documentar el patrón dual | Documentar explícitamente | Documentar | 30 min |

**Tiempo total estimado: 1 día de trabajo.**

---

## P-01 — `caja_gasto_categorias` Desapareció

### El problema
`caja_movimientos.categoria_id` referencia una colección que ya no existe en el schema v2. Cualquier gasto de caja (alquiler, servicios, limpieza) que use una categoría queda con una referencia rota. Funcionalmente: no puedes reportar gastos por categoría.

### Lo que NO se toca
Todo `caja_movimientos` tal como está. Solo se restaura la colección que le falta.

### La solución — Restaurar `caja_gasto_categorias`

```dbml
Table caja_gasto_categorias {
  _id objectid [pk]
  tenant_id varchar
  nombre varchar
  descripcion varchar
  icono varchar
  is_active boolean [default: true]
  deleted_at datetime
  deleted_by varchar
  created_at datetime        // Estaba ausente en v1, se agrega ahora
}

Ref: caja_gasto_categorias.tenant_id > tenants._id
Ref: caja_movimientos.categoria_id > caja_gasto_categorias._id
```

#### Modelo Pydantic
```python
class CajaGastoCategoria(Document):
    tenant_id: str
    nombre: str
    descripcion: str | None = None
    icono: str | None = None
    is_active: bool = True
    deleted_at: datetime | None = None
    deleted_by: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "caja_gasto_categorias"
        indexes = [
            [("tenant_id", 1), ("is_active", 1)],
        ]
```

#### Seed de categorías base por tenant (ejecutar al crear un tenant nuevo)
```python
CATEGORIAS_GASTO_DEFAULT = [
    { "nombre": "Alquiler",      "icono": "🏠" },
    { "nombre": "Servicios",     "icono": "💡" },
    { "nombre": "Limpieza",      "icono": "🧹" },
    { "nombre": "Transporte",    "icono": "🚗" },
    { "nombre": "Otros",         "icono": "📦" },
]

async def seed_categorias_gasto(tenant_id: str):
    for cat in CATEGORIAS_GASTO_DEFAULT:
        await CajaGastoCategoria(
            tenant_id=tenant_id,
            **cat
        ).insert()
```

---

## P-02 — `product_cost_history` No Está

### El problema
Cuando alguien modifica el `costo_producto` de un producto, ese cambio no queda registrado en ningún lado. Los `inventory_logs` capturan el costo *al momento de un movimiento*, pero no capturan los cambios de costo que ocurren sin movimiento de inventario (por ejemplo, una renegociación de precio con el proveedor).

Sin este historial no puedes responder: *"¿cuándo cambió el costo de este producto y quién lo autorizó?"*

### Lo que NO se toca
`products`, `inventory_logs`, ni ninguna otra colección existente. Solo se agrega la colección nueva y el trigger en el servicio de productos.

### La solución — Agregar `product_cost_history`

```dbml
Table product_cost_history {
  _id objectid [pk]
  tenant_id varchar
  producto_id varchar
  descripcion varchar        // Snapshot del nombre del producto
  costo_anterior float
  costo_nuevo float
  diferencia float           // costo_nuevo - costo_anterior (puede ser negativo)
  motivo varchar             // Razón del cambio (opcional pero recomendado)
  cambiado_por varchar       // Ref a users._id
  cambiado_por_nombre varchar // Snapshot del nombre del usuario
  created_at datetime
}

Ref: product_cost_history.tenant_id > tenants._id
Ref: product_cost_history.producto_id > products._id
Ref: product_cost_history.cambiado_por > users._id
```

#### Modelo Pydantic
```python
class ProductCostHistory(Document):
    tenant_id: str
    producto_id: str
    descripcion: str               # Snapshot del nombre
    costo_anterior: float
    costo_nuevo: float
    diferencia: float              # Calculado automáticamente
    motivo: str | None = None
    cambiado_por: str
    cambiado_por_nombre: str       # Snapshot del nombre
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "product_cost_history"
        indexes = [
            [("tenant_id", 1), ("producto_id", 1), ("created_at", -1)],
            [("tenant_id", 1), ("created_at", -1)],
        ]
```

#### Trigger en el servicio de actualización de productos
```python
async def actualizar_costo_producto(
    producto_id: str,
    nuevo_costo: float,
    usuario: UserContext,
    motivo: str | None = None
) -> Product:
    producto = await Product.get(PydanticObjectId(producto_id))

    # Solo registrar si el costo realmente cambió
    if producto.costo_producto == nuevo_costo:
        return producto

    # Registrar el cambio ANTES de modificar el producto
    await ProductCostHistory(
        tenant_id=producto.tenant_id,
        producto_id=str(producto.id),
        descripcion=producto.descripcion,
        costo_anterior=producto.costo_producto,
        costo_nuevo=nuevo_costo,
        diferencia=round(nuevo_costo - producto.costo_producto, 4),
        motivo=motivo,
        cambiado_por=str(usuario.id),
        cambiado_por_nombre=usuario.full_name
    ).insert()

    # Luego actualizar el producto
    producto.costo_producto = nuevo_costo
    await producto.save()

    return producto
```

---

## P-03 — `caja_movimientos` sin `created_at`

### El problema
`caja_movimientos` usa `fecha` como timestamp, lo que funciona, pero rompe la consistencia del schema donde todo lo demás usa `created_at`. Esto causa fricciones al escribir queries genéricas de auditoría que asumen `created_at` como campo estándar.

### Lo que NO se toca
El campo `fecha` se mantiene exactamente como está. Solo se agrega `created_at` como alias consistente.

### La solución — Agregar `created_at`

```dbml
Table caja_movimientos {
  ...
  fecha datetime        // MANTENER — campo operacional
  created_at datetime   // AGREGAR — consistencia con el resto del schema
}
```

```python
class CajaMovimiento(Document):
    tenant_id: str
    sucursal_id: str
    sesion_id: str
    cajero_id: str
    cajero_name: str
    subtipo: str
    tipo: Literal["INGRESO", "EGRESO"]
    monto: float
    descripcion: str | None = None
    categoria_id: str | None = None
    sale_id: str | None = None
    fecha: datetime                                    # MANTENER
    created_at: datetime = Field(default_factory=datetime.utcnow)  # AGREGAR

    class Settings:
        name = "caja_movimientos"
        indexes = [
            [("tenant_id", 1), ("sesion_id", 1)],
            [("tenant_id", 1), ("sucursal_id", 1), ("created_at", -1)],
        ]
```

> `fecha` representa el momento operacional del movimiento (puede ser retroactivo en ajustes).
> `created_at` representa cuándo se insertó el registro en la base de datos.
> Son semánticamente distintos — ambos tienen razón de existir.

---

## P-04 — `inventario` e `inventory_logs` sin `tenant_id` en Refs

### El problema
En el DBML v2, los `Ref` de `inventario` e `inventory_logs` no incluyen la referencia a `tenants._id`. Esto no rompe el funcionamiento real si `tenant_id` está en los documentos y en los índices, pero el diagrama queda incompleto y puede inducir a error a cualquier desarrollador que lo lea.

### Lo que NO se toca
Los documentos, los índices, ni el código. Solo se verifica y corrige el diagrama.

### La solución — Verificar en código y corregir el DBML

#### Verificación en los modelos (confirmar que tenant_id está presente)
```python
# Confirmar que ambos modelos tienen tenant_id declarado
class Inventario(Document):
    tenant_id: str    # ✅ debe estar
    sucursal_id: str
    producto_id: str
    cantidad: int
    precio_sucursal: float
    updated_at: datetime

class InventoryLog(Document):
    tenant_id: str    # ✅ debe estar
    sucursal_id: str
    producto_id: str
    ...
```

#### Corrección en el DBML — agregar los Refs faltantes
```dbml
// AGREGAR estas dos líneas al bloque de Relationships:
Ref: inventario.tenant_id > tenants._id
Ref: inventory_logs.tenant_id > tenants._id
```

#### Índices a verificar — deben existir
```javascript
// Si no existen, crearlos:
db.inventario.createIndex({ tenant_id: 1, sucursal_id: 1, producto_id: 1 }, { unique: true })
db.inventory_logs.createIndex({ tenant_id: 1, sucursal_id: 1, created_at: -1 })
db.inventory_logs.createIndex({ tenant_id: 1, producto_id: 1, created_at: -1 })
```

---

## P-05 — `pedidos_internos.items` sin Documentar el Patrón Dual

### El problema
El schema tiene tanto `pedidos_internos.items` (JSON embebido) como la colección separada `pedido_items`. Sin documentación explícita del patrón, cualquier desarrollador nuevo podría pensar que uno de los dos es redundante y eliminarlo, rompiendo o el rendimiento analítico o la lectura rápida de detalle.

### Lo que NO se toca
Absolutamente nada del código ni del schema. Solo se documenta el patrón.

### La solución — Documentar el patrón dual explícitamente

Agregar al README o documento de arquitectura del proyecto:

```markdown
## Patrón Dual: Embedding + Colección Separada

Dos colecciones en este sistema siguen el mismo patrón intencional:

| Colección principal     | JSON embebido | Colección analítica |
|-------------------------|---------------|---------------------|
| `sales`                 | `items`       | `sale_items`        |
| `pedidos_internos`      | `items`       | `pedido_items`      |

### ¿Por qué dos fuentes del mismo dato?

**El JSON embebido** (`sales.items`, `pedidos_internos.items`) existe para
lectura rápida de un documento completo. Cuando cargas el detalle de una
venta o un pedido, obtienes todo en una sola query sin joins.

**La colección separada** (`sale_items`, `pedido_items`) existe para
analytics. Permite queries del tipo:
- "¿Cuántas unidades del producto X se vendieron este mes?"
- "¿Qué productos se transfirieron desde la sucursal A?"
- Índices compuestos por producto, fecha y sucursal

### Regla de escritura

Ambas fuentes se escriben atómicamente en el mismo request.
Nunca escribir en una sin escribir en la otra.

### Regla de lectura

- **Detalle de un documento específico** → leer de la colección principal
- **Reportes, agregaciones, búsquedas por producto** → leer de la colección analítica

### ¿Cuál es la fuente de verdad?

El JSON embebido es el snapshot inmutable de lo que ocurrió.
La colección separada es una proyección de ese snapshot optimizada para queries.
Si hay discrepancia, el JSON embebido tiene prioridad.
```

---

## Schema Final — Solo las Diferencias de Este Plan

```dbml
// ── RESTAURADA ───────────────────────────────────────────────
Table caja_gasto_categorias {
  _id objectid [pk]
  tenant_id varchar
  nombre varchar
  descripcion varchar
  icono varchar
  is_active boolean [default: true]
  deleted_at datetime
  deleted_by varchar
  created_at datetime      // Nuevo respecto a v1
}

// ── NUEVA ────────────────────────────────────────────────────
Table product_cost_history {
  _id objectid [pk]
  tenant_id varchar
  producto_id varchar
  descripcion varchar
  costo_anterior float
  costo_nuevo float
  diferencia float
  motivo varchar
  cambiado_por varchar
  cambiado_por_nombre varchar
  created_at datetime
}

// ── CAMPOS AGREGADOS A TABLAS EXISTENTES ─────────────────────
// caja_movimientos  → + created_at datetime  (fecha se mantiene)

// ── REFS FALTANTES EN EL DIAGRAMA ────────────────────────────
// Ref: inventario.tenant_id > tenants._id
// Ref: inventory_logs.tenant_id > tenants._id
// Ref: caja_gasto_categorias.tenant_id > tenants._id
// Ref: caja_movimientos.categoria_id > caja_gasto_categorias._id

// ── DOCUMENTACIÓN ────────────────────────────────────────────
// Agregar al README: patrón dual embedding + colección analítica
// para sales/sale_items y pedidos_internos/pedido_items
```

---

## Orden de Ejecución

```
Bloque 1 — Menos de 1 hora (cambios triviales)
├── P-03  Agregar created_at a caja_movimientos
├── P-04  Verificar tenant_id en modelos + corregir DBML
└── P-05  Escribir documentación del patrón dual

Bloque 2 — Resto del día
├── P-01  Restaurar caja_gasto_categorias + seed por tenant
└── P-02  Agregar product_cost_history + trigger en update de costo
```

---

## ¿Qué queda después de esto?

Después de aplicar este plan, los problemas reales que restan son de nivel de madurez operacional, no de diseño de schema:

- Monitoreo de queries lentas en producción (se detectan con el tiempo real)
- Índices adicionales que solo se descubren con patrones de uso reales
- Features de negocio nuevas que el cliente pedirá en el futuro

Eso no es deuda técnica — es evolución natural de un producto. El schema en sí habrá alcanzado un nivel de solidez donde ningún hueco conocido compromete la integridad, la seguridad ni el rendimiento del sistema.

---

*Plan de pulido final — SalesSystem v2 → v2.1*
