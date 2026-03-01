**PLAN DE DESARROLLO**

Corrección y Mejora de Base de Datos

SalesSystem --- Arquitectura SaaS Multi-Tenant

+-----------------------------------------------------------------------+
| **Versión 1.0** |
| |
| Febrero 2026 |
| |
| Arquitecto de Base de Datos Senior |
+-----------------------------------------------------------------------+

**1. Resumen Ejecutivo**

El presente documento establece el plan de trabajo para corregir los
puntos débiles identificados en el análisis de la base de datos de
SalesSystem, un sistema SaaS multi-tenant para gestión de puntos de
venta. Se han identificado 8 áreas críticas de mejora que afectan la
escalabilidad, integridad de datos y capacidad analítica del sistema.

+----------------------------------+---+----------------------------------+
| **8** | | **4** |
| | | |
| Problemas Identificados | | Fases de Desarrollo |
+----------------------------------+---+----------------------------------+
| **\~10** | | **3** |
| | | |
| Semanas de Trabajo | | Cambios Críticos |
+----------------------------------+---+----------------------------------+

+-----------------------------------------------------------------------+
| **⚠️ Nota importante sobre MongoDB** |
| |
| Este plan asume el uso de MongoDB con Beanie/Pydantic. Algunas |
| recomendaciones implican ajustar el modelo de documentos y agregar |
| colecciones nuevas. Las migraciones se deben ejecutar con scripts de |
| transformación, no con ALTER TABLE. Se recomienda realizar backups |
| completos antes de cada fase. |
+-----------------------------------------------------------------------+

**2. Inventario de Problemas y Soluciones**

A continuación se listan todos los problemas detectados con su impacto,
causa raíz y la solución propuesta.

**P-01 · Plan del Tenant como String Hardcodeado**

---

**Impacto** ALTO --- Lógica de negocio dispersa en código, imposible
escalar planes sin deploys

**Causa** Campo varchar con valores literales BASIC/PRO sin tabla
de referencia

**Riesgo** Al agregar ENTERPRISE o trials, se rompe toda la lógica
condicional del código

**Solución** Crear colección plans con capacidades declarativas y
referenciarla desde tenants

---

**Nuevo Schema --- Colección plans**

---

plans { \_id: ObjectId code: string // \"BASIC\" \| \"PRO\" \|
\"ENTERPRISE\" name: string max_sucursales: int // -1 = ilimitado
max_usuarios: int features: string\[\] // \[\"multi_sucursal\",
\"reportes_avanzados\", \"api_acceso\"\] precio_mensual: float
is_active: boolean created_at: datetime } tenants { \... plan_id:
ObjectId // Referencia a plans.\_id plan_expires_at: datetime // Para
trials y anuales // DEPRECAR: plan: varchar }

---

**P-02 · JSON Libre en sales.items y sales.pagos**

---

**Impacto** CRÍTICO --- Imposibilita queries analíticas de ventas por
producto, reportes de margen y Business Intelligence

**Causa** Items de venta embebidos como JSON sin schema validado ni
colección separada

**Riesgo** A partir de \~100k ventas, los reportes requieren
deserializar toda la colección. Sin índices posibles
sobre productos vendidos

**Solución** Crear colección sale_items separada para analytics +
mantener embedding en sales para lectura rápida de
detalle

---

**Nuevo Schema --- Colección sale_items (para analytics)**

---

sale_items { \_id: ObjectId tenant_id: ObjectId sucursal_id: ObjectId
sale_id: ObjectId // Ref a sales.\_id sale_date: datetime //
Desnormalizado para queries rápidas producto_id: ObjectId descripcion:
string // Snapshot al momento de la venta cantidad: int
precio_unitario: float costo_unitario: float // Snapshot del costo al
momento descuento_unitario: float subtotal: float created_at: datetime
}

---

Con esta estructura se habilitan queries como: \"top 10 productos por
sucursal este mes\", \"margen bruto por categoría\" y \"tendencia de
ventas por SKU\", todas ejecutables con índices compuestos eficientes.

**P-03 · Pérdida de Costo Histórico en Inventario**

+-----------------------------------------------------------------------+
| **⚠️ Impacto financiero directo** |
| |
| Sin el costo histórico al momento de la venta, todos los cálculos de |
| margen bruto histórico son incorrectos. Al actualizar el costo de un |
| producto, se pierde la información de cuánto costó el stock vendido |
| anteriormente. |
+-----------------------------------------------------------------------+

**Solución --- Campos adicionales en sale_items e inventory_logs**

---

// En inventory_logs (ya existe, agregar campos):
costo_unitario_momento: float // Costo al momento del movimiento
precio_venta_momento: float // Precio al momento del movimiento // En
products (historial de costos): // Nueva colección product_cost_history
product_cost_history { \_id: ObjectId tenant_id: ObjectId producto_id:
ObjectId costo_anterior: float costo_nuevo: float cambiado_por:
ObjectId created_at: datetime }

---

**P-04 · pedidos_internos sin Origen y Destino Explícitos**

---

El esquema actual solo registra sucursal_id (origen implícito), lo que
impide modelar transferencias entre sucursales pares. Cuando el cliente
crece a más de 2 sucursales, el modelo se rompe estructuralmente.

---

**Solución --- Campos origen/destino explícitos**

---

pedidos_internos { \... sucursal_origen_id: ObjectId // Quién solicita
/ despacha sucursal_destino_id: ObjectId // Quién recibe tipo_pedido:
string // \"SUCURSAL_A_SUCURSAL\" \| \"MATRIZ_A_SUCURSAL\" // items
como colección separada (mismo patrón que sale_items) // O al menos con
schema Pydantic estricto: // items: List\[PedidoItemSchema\] }

---

**P-05 · Soft Delete Incompleto --- Falta deleted_at**

El campo is_active (boolean) no provee información temporal del evento
de desactivación. Se requiere saber cuándo y en algunos casos quién
desactivó la entidad.

**Solución --- Agregar deleted_at a todas las entidades maestras**

---

// Aplicar a: tenants, sucursales, users, products, categories, //
descuentos, caja_gasto_categorias deleted_at: datetime \| null // null
= activo, fecha = desactivado deleted_by: ObjectId \| null // Usuario
que realizó la acción // Mantener is_active para compatibilidad y
velocidad de query // El índice principal debe ser: { tenant_id,
is_active, deleted_at }

---

**P-06 · categories sin is_active**

Inconsistencia con el resto del modelo. Las categorías no se pueden
archivar de forma no destructiva, lo que puede dejar productos huérfanos
visualmente.

**Solución**

- Agregar is_active: boolean con default true a la colección
  categories

- Agregar deleted_at: datetime \| null (consistente con P-05)

- Al desactivar una categoría, mover productos huérfanos a una
  categoría \"Sin Categoría\" por defecto por tenant

**P-07 · descuentos sin Alcance Temporal**

Los descuentos no tienen fecha de vigencia, obligando a que el equipo de
negocio los active/desactive manualmente. Esto es un error operacional
frecuente y costoso.

**Solución --- Campos de vigencia en descuentos**

---

descuentos { \... fecha_inicio: datetime \| null // null = sin
restricción de inicio fecha_fin: datetime \| null // null = sin
expiración dias_semana: int\[\] \| null // \[0,1,2,3,4\] = Lunes a
Viernes hora_inicio: string \| null // \"09:00\" --- para descuentos
por horario hora_fin: string \| null // \"18:00\" uso_maximo: int \|
null // Máximo de veces que se puede aplicar uso_actual: int //
Contador de usos }

---

**P-08 · username con Índice Único Global (no por Tenant)**

+-----------------------------------------------------------------------+
| **⚠️ Bug de aislamiento multi-tenant** |
| |
| En un SaaS multi-tenant, el username debe ser único POR TENANT, no |
| globalmente. Si el Tenant A tiene un usuario \"admin\", el Tenant B |
| no puede crear su propio \"admin\". Esto es un error de aislamiento |
| de datos. |
+-----------------------------------------------------------------------+

**Solución --- Índice compuesto**

---

// Eliminar índice único simple en username // Crear índice único
compuesto: db.users.createIndex( { tenant_id: 1, username: 1 }, {
unique: true, name: \"idx_users_tenant_username\" } ) // El email
también puede requerir unicidad por tenant: db.users.createIndex( {
tenant_id: 1, email: 1 }, { unique: true, sparse: true, name:
\"idx_users_tenant_email\" } )

---

**3. Plan de Desarrollo por Fases**

El trabajo se divide en 4 fases ordenadas por impacto y riesgo. Las
fases 1 y 2 son bloqueantes para producción a escala. Las fases 3 y 4
son mejoras incrementales que pueden ejecutarse sin detener el sistema.

---

**Fase** **Nombre** **Duración** **Prioridad**

---

**Fase 1** Correcciones Críticas de 2 semanas **CRÍTICA**
Integridad

**Fase 2** Analytics y Colecciones Separadas 3 semanas **ALTA**

**Fase 3** Mejoras de Modelo de Negocio 3 semanas **MEDIA**

**Fase 4** Optimización e Índices 2 semanas **MEDIA**

---

**Fase 1 --- Correcciones Críticas de Integridad**

+-----------------------------------------------------------------------+
| **🎯 Objetivo** |
| |
| Corregir los problemas que afectan la integridad de datos y el |
| correcto aislamiento entre tenants. Estos cambios son prerequisito |
| para cualquier escala de usuarios. |
+-----------------------------------------------------------------------+

---

**Tarea** **Descripción** **Esfuerzo** **Tipo**

---

F1-T1: Fix índice Eliminar índice único 2h **Index**
username global, crear índice  
 compuesto {tenant_id,  
 username}

F1-T2: Fix índice email Crear índice compuesto 1h **Index**
{tenant_id, email} unique  
 sparse

F1-T3: Schema plans Crear colección plans con 4h **Schema**
features declarativas

F1-T4: Migrar Script de migración: agregar 3h **Migration**
tenants.plan plan_id, plan_expires_at a  
 todos los tenants

F1-T5: is_active en Agregar campo is_active con 2h **Schema**
categories default true + índice

F1-T6: deleted_at en Agregar deleted_at y 4h **Schema**
entidades deleted_by a: tenants,  
 sucursales, users, products,  
 categories, descuentos

F1-T7: Actualizar Actualizar todos los modelos 6h **Backend**
modelos Pydantic Beanie con los nuevos  
 campos. Validar con tests.

F1-T8: Tests de Ejecutar suite completa de 4h **Backend**
regresión tests sobre modelos  
 actualizados

---

**Fase 2 --- Analytics y Colecciones Separadas**

+-----------------------------------------------------------------------+
| **🎯 Objetivo** |
| |
| Resolver el problema del JSON embebido en sales creando colecciones |
| satélite para analytics. Esto desbloquea el desarrollo de reportes y |
| dashboards escalables. |
+-----------------------------------------------------------------------+

---

**Tarea** **Descripción** **Esfuerzo** **Tipo**

---

F2-T1: Schema sale_items Definir y crear colección 4h **Schema**
sale_items con todos los  
 campos históricos

F2-T2: Migración Script para descomponer 8h **Migration**
histórica sales.items existentes y  
 poblar sale_items

F2-T3: Hook en creación Al crear una venta, escribir 5h **Backend**
de venta atómicamente en sales y  
 sale_items

F2-T4: Costo histórico Capturar costo_unitario y 3h **Backend**
en sale_items precio_unitario al momento  
 de la venta

F2-T5: Crear colección y trigger al 4h **Schema**
product_cost_history editar costo en products

F2-T6: Índices en Crear índices: {tenant_id, 2h **Index**
sale_items producto_id, sale_date},  
 {tenant_id, sucursal_id,  
 sale_date}

F2-T7: pedidos_internos Agregar sucursal_origen_id, 3h **Schema**
origen/destino sucursal_destino_id y  
 tipo_pedido

F2-T8: Migrar pedidos Script: sucursal_origen_id = 2h **Migration**
existentes sucursal_id para registros  
 existentes

F2-T9: costo en Agregar 3h **Schema**
inventory_logs costo_unitario_momento y  
 precio_venta_momento

F2-T10: Tests de Validar queries de reportes: 5h **Backend**
analytics ventas por producto, margen  
 por sucursal

---

**Fase 3 --- Mejoras de Modelo de Negocio**

+-----------------------------------------------------------------------+
| **🎯 Objetivo** |
| |
| Completar las capacidades de negocio que actualmente tienen |
| limitaciones operacionales: descuentos sin vigencia temporal y modelo |
| de planes incompleto. |
+-----------------------------------------------------------------------+

---

**Tarea** **Descripción** **Esfuerzo** **Tipo**

---

F3-T1: Vigencia en Agregar fecha_inicio, 4h **Schema**
descuentos fecha_fin, dias_semana,  
 hora_inicio, hora_fin

F3-T2: Límite de usos en Agregar uso_maximo, 5h **Backend**
descuentos uso_actual. Validación al  
 aplicar descuento.

F3-T3: Motor de Servicio que evalúa si un 8h **Backend**
evaluación descuentos descuento es aplicable según  
 fecha/hora/usos

F3-T4: API de features Middleware que valida 6h **Backend**
por plan features habilitadas según  
 plans del tenant antes de  
 ejecutar endpoints

F3-T5: UI admin de Panel para SUPERADMIN: 10h **Backend**
planes crear/editar planes y  
 asignarlos a tenants

F3-T6: Expiración de Job periódico que desactiva 4h **Backend**
planes tenants con plan_expires_at  
 vencido

F3-T7: Tests de negocio Tests E2E: flujo de 6h **Backend**
descuentos con vigencia,  
 restricciones de plan

---

**Fase 4 --- Optimización e Índices Globales**

+-----------------------------------------------------------------------+
| **🎯 Objetivo** |
| |
| Auditoría completa de índices, limpieza de campos redundantes y |
| preparación de la base de datos para alta concurrencia multi-tenant. |
+-----------------------------------------------------------------------+

---

**Tarea** **Descripción** **Esfuerzo** **Tipo**

---

F4-T1: Auditoría de Revisar explain() en todas 6h **Index**
índices las queries principales,  
 identificar collection scans

F4-T2: Índices de Asegurar índice en 3h **Index**
tenant_id {tenant_id} o compuesto en  
 todas las colecciones

F4-T3: Índices de Índices compuestos 2h **Index**
time-series {tenant_id, created_at} para  
 audit_logs, inventory_logs,  
 caja_movimientos

F4-T4: TTL index en Índice TTL para 3h **Index**
audit_logs auto-eliminar audit_logs con  
 más de N meses según plan

F4-T5: Deprecar campos Plan de deprecación para 2h **Refactor**
redundantes tenants.plan (varchar)  
 después de migrar a plan_id

F4-T6: Schema validation Agregar validación de schema 5h **Schema**
MongoDB a nivel de colección para  
 campos críticos

F4-T7: Stress test Pruebas de carga con datos 8h **Backend**
multi-tenant de múltiples tenants  
 simultáneos

F4-T8: Documentación del Actualizar DBML y 4h **Refactor**
schema documentación técnica con  
 todos los cambios aplicados

---

**4. Cronograma Estimado**

El plan se puede ejecutar en 10 semanas con un equipo de 1-2
desarrolladores backend. Las fases 1 y 2 son secuenciales (dependencias
duras). Las fases 3 y 4 pueden ejecutarse en paralelo entre sí una vez
completada la Fase 2.

---

**Fase / Tarea** **Sem 1** **Sem 2** **Sem **Sem **Sem **Sem
3-4** 5-6** 7-8** 9-10**

**Fase 1 --- ● ●  
 Crítica**

**Fase 2 --- ● ●  
 Analytics**

**Fase 3 --- ● ●
Negocio**

**Fase 4 --- ● ● ●
Optimización**

---

(\*) Los bloques de Fase 4 en semanas 4-6 corresponden a trabajo
paralelo de índices que no requiere downtime.

**5. Estrategia de Migración Sin Downtime**

Dado que se trata de un sistema en producción, todas las migraciones
deben ejecutarse con la estrategia expand-and-contract para evitar
interrupciones del servicio.

**Patrón Expand-and-Contract**

**Paso 1 --- Expand (Agregar sin romper)**

- Agregar nuevos campos como opcionales (nullable) en el schema

- Crear nuevas colecciones sin eliminar las antiguas

- Crear nuevos índices en background sin bloquear writes

- Desplegar código que escribe tanto en el campo antiguo como en el
  nuevo

**Paso 2 --- Migrate (Backfill)**

- Ejecutar script de migración por lotes (batch size: 500-1000
  documentos)

- Usar timestamps de created_at para procesar en orden cronológico

- Loggear progreso y permitir reanudar si falla

- Verificar integridad: contar documentos migrados vs total

**Paso 3 --- Contract (Limpiar)**

- Una vez el 100% migrado y validado en staging, actualizar código
  para leer solo de los nuevos campos

- Mantener campos antiguos por 1 sprint adicional como safety net

- Eliminar campos deprecated en release siguiente

+-----------------------------------------------------------------------+
| **💡 Ejemplo: Migración de tenants.plan → tenants.plan_id** |
| |
| 1\. Crear colección plans con BASIC y PRO 2. Agregar plan_id como |
| nullable a tenants (expand) 3. Script: para cada tenant, buscar plan |
| por code y asignar plan_id 4. Validar: contar tenants donde plan_id |
| == null → debe ser 0 5. Actualizar código para leer de plan_id (via |
| populate) 6. En próximo sprint: deprecar campo plan varchar |
+-----------------------------------------------------------------------+

**6. Índices Recomendados --- Referencia Completa**

Lista completa de índices a crear para garantizar performance en todas
las queries críticas del sistema.

---

// === USERS === db.users.createIndex({ tenant_id: 1, username: 1 }, {
unique: true }) db.users.createIndex({ tenant_id: 1, email: 1 }, {
unique: true, sparse: true }) db.users.createIndex({ tenant_id: 1,
is_active: 1, role: 1 }) // === PRODUCTS === db.products.createIndex({
tenant_id: 1, is_active: 1 }) db.products.createIndex({ tenant_id: 1,
categoria_id: 1 }) db.products.createIndex({ tenant_id: 1,
codigo_sistema: 1 }, { unique: true }) // === INVENTARIO ===
db.inventario.createIndex({ tenant_id: 1, sucursal_id: 1, producto_id:
1 }, { unique: true }) // === SALES === db.sales.createIndex({
tenant_id: 1, sucursal_id: 1, created_at: -1 }) db.sales.createIndex({
tenant_id: 1, cashier_id: 1, created_at: -1 }) // === SALE_ITEMS (nueva
colección) === db.sale_items.createIndex({ tenant_id: 1, producto_id:
1, sale_date: -1 }) db.sale_items.createIndex({ tenant_id: 1,
sucursal_id: 1, sale_date: -1 }) // === CAJA_MOVIMIENTOS ===
db.caja_movimientos.createIndex({ tenant_id: 1, sesion_id: 1 })
db.caja_movimientos.createIndex({ tenant_id: 1, sucursal_id: 1, fecha:
-1 }) // === AUDIT_LOGS === db.audit_logs.createIndex({ tenant_id: 1,
created_at: -1 }) db.audit_logs.createIndex({ tenant_id: 1, entity: 1,
entity_id: 1 }) db.audit_logs.createIndex({ created_at: 1 }, {
expireAfterSeconds: 7776000 }) // TTL 90 días // === INVENTORY_LOGS ===
db.inventory_logs.createIndex({ tenant_id: 1, sucursal_id: 1,
created_at: -1 }) db.inventory_logs.createIndex({ tenant_id: 1,
producto_id: 1, created_at: -1 })

---

**7. Criterios de Éxito y Definición de Done**

Cada fase se considera completada cuando se cumplen todos los criterios
de aceptación definidos a continuación.

**Fase 1 --- Done cuando:**

1.  No existe ningún documento en users donde el username sea duplicado
    dentro del mismo tenant_id

2.  Todos los tenants tienen un plan_id válido que referencia a un
    documento en la colección plans

3.  La colección categories tiene el campo is_active en todos sus
    documentos

4.  Todos los modelos Pydantic/Beanie pasan el suite de tests sin
    errores

5.  Los índices compuestos están creados y verificados con
    db.users.getIndexes()

**Fase 2 --- Done cuando:**

6.  La colección sale_items tiene el mismo número de líneas de venta que
    el total de items en sales.items (validado con script de conteo)

7.  Una query de \"ventas por producto este mes\" en sale_items retorna
    en \< 100ms con tenant de prueba con 50k ventas

8.  Cada sale_item tiene costo_unitario diferente de 0 o null

9.  pedidos_internos tiene sucursal_origen_id y sucursal_destino_id en
    el 100% de los documentos

**Fase 3 --- Done cuando:**

10. Un descuento con fecha_fin en el pasado no puede ser aplicado por la
    API

11. Un tenant en plan BASIC no puede acceder a endpoints de features PRO
    (retorna 403)

12. El job de expiración de planes funciona en staging sin errores por
    72h continuas

**Fase 4 --- Done cuando:**

13. db.runCommand({explain: \...}) en las 10 queries más frecuentes
    muestra IXSCAN (no COLLSCAN)

14. El DBML está actualizado y sincronizado con el schema real de
    MongoDB

15. Los campos deprecated tienen fecha de eliminación en el backlog

**8. Riesgos y Mitigación**

---

**Riesgo** **Probabilidad** **Impacto** **Mitigación**

Migración de sale_items **MEDIA** **ALTO** Script idempotente
falla a mitad del con checkpoint.
proceso Reanudar desde
último \_id
procesado.

Carga de escritura doble **BAJA** **MEDIO** Usar write concern
(sales + sale_items) majority.
aumenta latencia Considerar
escritura
asíncrona con cola
si latencia \>
200ms.

Índice compuesto **BAJA** **ALTO** Auditar duplicados
username rompe registros ANTES de crear
duplicados existentes índice. Script de
detección previa.

Deprecar tenants.plan **MEDIA** **ALTO** Mantener campo
rompe integraciones deprecated durante
externas 2 sprints.
Notificar a
integraciones vía
changelog.

---

**9. Conclusión**

Este plan aborda de forma sistemática y ordenada todas las debilidades
identificadas en el análisis inicial. La priorización está diseñada para
maximizar el impacto en producción mientras se minimiza el riesgo
operacional.

Los cambios de la Fase 1 (índices y modelo de planes) son los de mayor
urgencia y el menor riesgo de ejecución. Los de Fase 2 (analytics) son
los que más valor de negocio aportan a mediano plazo, ya que desbloquean
toda la capacidad de reporting y BI del sistema.

+-----------------------------------------------------------------------+
| **✅ Resultado esperado al completar las 4 fases** |
| |
| Una base de datos SaaS multi-tenant correctamente aislada, con |
| capacidad analítica real sobre datos de ventas e inventario, con |
| modelo de planes extensible sin necesidad de deploys, y con |
| performance garantizada mediante índices auditados para los patrones |
| de acceso reales del sistema. |
+-----------------------------------------------------------------------+

**10. Especificaciones Técnicas de Implementación (Fase 1)**

Para garantizar la consistencia, se proponen los siguientes cambios a nivel de código Pydantic/Beanie:

**A. Nueva Colección: `plans`**
Fichero: `backend/app/models/plan.py`

```python
class Plan(Document):
    code: str            # "BASIC", "PRO", "ENTERPRISE"
    name: str
    max_sucursales: int  # -1 = ilimitado
    max_usuarios: int
    features: List[str]  # ["multi_sucursal", "pos_avanzado"]
    precio_mensual: float
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
      name = "plans"
```

**B. Ajustes en `users` (Aislamiento Multi-tenant)**
Fichero: `backend/app/models/user.py`

```python
class User(Document):
    username: str # Quitar unique=True de aquí
    # ...
    class Settings:
        name = "users"
        indexes = [
            IndexModel([("tenant_id", 1), ("username", 1)], unique=True),
            IndexModel([("tenant_id", 1), ("email", 1)], unique=True, sparse=True),
        ]
```

**C. Mixin para Soft Delete**
Se recomienda crear una clase base para aplicar P-05 y P-06 uniformemente:

```python
class SoftDeleteMixin(BaseModel):
    is_active: bool = True
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
```

**11. Visualización del Estado Objetivo (DBML Mejorado)**

```dbml
// SalesSystem - Target Schema (After Improvements)

Table plans {
  _id objectid [pk]
  code varchar [unique]
  name varchar
  max_sucursales int
  max_usuarios int
  features json
  precio_mensual float
  is_active boolean [default: true]
  created_at datetime
}

Table tenants {
  _id objectid [pk]
  name varchar
  plan_id objectid [ref: > plans._id]
  plan_expires_at datetime
  is_active boolean [default: true]
  deleted_at datetime
  created_at datetime
}

Table users {
  _id objectid [pk]
  tenant_id objectid [ref: > tenants._id]
  username varchar
  email varchar
  role varchar
  is_active boolean [default: true]
  deleted_at datetime
  created_at datetime

  Indexes {
    (tenant_id, username) [unique]
    (tenant_id, email) [unique]
  }
}

Table sale_items { // New Analytics Table
  _id objectid [pk]
  tenant_id objectid [ref: > tenants._id]
  sucursal_id objectid [ref: > sucursales._id]
  sale_id objectid [ref: > sales._id]
  producto_id objectid [ref: > products._id]
  sale_date datetime
  cantidad int
  precio_unitario float
  costo_unitario float
  subtotal float
  created_at datetime
}

Table product_cost_history {
  _id objectid [pk]
  producto_id objectid [ref: > products._id]
  costo_anterior float
  costo_nuevo float
  cambiado_por objectid [ref: > users._id]
  created_at datetime
}
```
