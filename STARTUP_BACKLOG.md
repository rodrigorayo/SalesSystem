# Backlog de Vulnerabilidades y Funcionalidades Futuras (Startup MVP)

Este documento enumera la deuda técnica y las futuras mejoras (Features) identificadas durante la fase inicial del proyecto en los módulos de **POS** y **Caja**. Están clasificadas según su prioridad para un entorno de *Startup* (MVP vs. Escalamiento).

---

## 🔝 Prioridad Alta (Para la V2 inmediata - Escalamiento a Multi-Sucursal Local)

### POS (Ventas)
- [x] **Control Atómico de Inventarios (Race Conditions):** Cambiar la lógica actual del backend de `inv.cantidad -= comprada` por consultas de actualización atómica directamente en MongoDB (`findOneAndUpdate` con condición `$gte: cantidad_solicitada`). Esto evitará que el inventario quede en números negativos si dos cajeros venden el último ítem simultáneamente.
- [x] **Tickets en Espera (Parquear Ventas):** Permitir al cajero guardar el estado actual del ticket (carrito de compras) para atender rápidamente a otro cliente mientras el primero busca más dinero o un producto extra.

### Caja
- [x] **Firma / Aprobación de Faltantes (Arqueo):** Si el cajero declara un monto final menor al `saldo_calculado` en sistema (ej. le faltan Bs. 50), requerir un "PIN de Administrador" en un modal para autorizar el cierre con descuadre. Opciones V1: Justificación obligatoria estricta.

---

## 🚶 Prioridad Media (Para la V3 - Control Operacional Estricto)

### POS (Ventas)
- [ ] **Descuentos a Nivel de Ítem:** Permitir al usuario hacer clic en un producto individual del ticket y aplicarle un descuento (por porcentaje o monto fijo), además del actual "Descuento Global" de todo el ticket.
- [ ] **Manejo de Propinas:** Agregar opción en el modal de cobro con tarjeta para agregar propinas separadas del monto facturable.

### Caja
- [ ] **Desempeño del Servidor (Patrón de Documento Calculado):** Mudar la carga de cálculo de la vista "Caja". En lugar de que el endpoint `/caja/sesion/{id}/resumen` lea todos los `CajaMovimiento` de la sesión para sumar los totales mediante Python/MongoDB Aggregation, la API de Ventas debería incrementar (`$inc`) campos pre-calculados (`total_qr`, `total_efectivo`) en el documento de `CajaSesion` en tiempo real con cada venta completada.
- [ ] **Traspaso de Turno en Caja:** Flujo temporal donde el sistema permite que una sesión `ABIERTA` cambie de `cajero_id` sin tener que declararse `CERRADA`. Se genera un movimiento interno de "Asignación de Responsabilidad" entre el Cajero A y el Cajero B.

---

## 🏔️ Prioridad Baja (A futuro - Expansión y Empresa Enterprise)

### POS (Ventas)
- [ ] **Offline First (PWA + Service Workers):** Como startup de software alojado en la nube, la dependencia de internet es esperada al inicio. A futuro (cuando las operaciones en zonas remotas o inestables sean clave), el frontend de React debe cachear el catálogo en `IndexedDB` y encolar las llamadas `POST /ventas`. Una vez reinstaurada la red, el sistema realizará sincronización de fondo (Sync).
- [ ] **Integración de Hardware Nativo (Impresoras Fiscales Posnet):** Conexión vía WebUSB API o demonio local en Python a impresoras térmicas de red e impresoras de tickets fiscales sin pasar por diálogos de impresión del navegador.

### Caja (Analítica)
- [ ] **Detección de Fraude (Machine Learning):** Almacenar métricas de "tiempo entre apertura y cierre", "tiempo promedio de registrar venta" y "descuadres promedio por cajero" para generar alertas de comportamiento anómalo.
