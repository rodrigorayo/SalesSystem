# Guía de Contribución y Reglas del Equipo (SaaS "Taboada System")

Bienvenido al Monorepositorio del proyecto. Al estar en la raíz, este repositorio administra tanto el código del `frontend` como el del `backend`. Lee estas reglas de arquitectura y colaboración de Git detalladamente antes de abrir tu primer Pull Request.

---

## 1. El Monorepo Frontend/Backend

Este proyecto usa la estructura de monorepositorio:
- `/frontend`: Construido en React, Vite, TypeScript y Tailwind CSS. (Puerto 5173).
- `/backend`: API en Python usando FastAPI, Pydantic y Beanie OGM (MongoDB). Arquitectura en proceso a Clean Architecture. (Puerto 8000).

---

## 2. Flujo de Git (Rama Principal y Trabajo Diario)

Tu labor debe integrarse suavemente respetando nuestro Git Flow.

### Ramas Principales
- **`main`**: Es el reflejo de **Producción** actual (Desplegado en Render y Vercel). NADIE hace push aquí de manera directa. Está protegida y su única entrada es mediante Merge/Pull Request.
- **`develop`**: Es nuestra rama de **Staging y trabajo del equipo**. Todas tus tareas parten clonando esta rama.

### Ciclo de vida de una funcionalidad (Ejemplo):
1. Te toca un ticket o tarea. Lo primero es:
   ```bash
   git checkout develop
   git pull origin develop
   ```
2. Creas una rama de trabajo, respetando los prefijos:
   - `feat/nombre-de-la-tarea` (Nuevas funcionalidades)
   - `fix/nombre-del-bug` (Arreglo de errores)
   - `refactor/nombre-componente` (Cambios de código interno)
   ```bash
   git checkout -b feat/bi-modulo-ventas
   ```
3. Trabajas e integras atómica y limpiamente con `Conventional Commits` (ej: `feat(bi): agrega dashboard a BI` o `fix(frontend): arregla render state`).
4. Empujas a GitHub: `git push -u origin feat/bi-modulo-ventas`.
5. Vas a GitHub y abres tu **Pull Request (PR) apuntando hacia `develop`** (nunca a main).
6. Otro desarrollador del equipo te hará Code Review antes de que aprueben tu Merge.

---

## 3. Instrucciones de Desarrollo: El Módulo "Business Intelligence" (BI)

Para el(los) desarrollador(es) encargado(s) de agregar Analíticas, Reportes o Dashboards de Inteligencia de Negocios, **es estricto y obligatorio alinearse a la siguiente arquitectura:**

### En Backend (FastAPI - DB)
Tu objetivo es agregar insights basados en volúmenes altos de datos de venta sin romper la capacidad de la aplicación de generar operaciones transaccionales.

1. **PROHIBIDO procesar todo en Python**: No hagas consultas como `.find_all()` para traer miles de facturas y aplicar bucles "for" o lógicas `sum()` en Python. Eso consumirá toda la RAM del servidor Web.
2. **Utilizar Aggregation Pipelines**: Todo cálculo (ventas mensuales, productos más vendidos, agrupación horaria) DEBE realizarse usando "Aggregations" nativas de MongoDB (`$match`, `$group`, `$sum`, `$project`). Al backend solo le debe llegar el Mini-JSON con el resultado precocinado que FastAPI devuelve al cliente.
3. **Aislamiento en Módulos (Clean Architecture)**: Tus endpoints deben vivir en una ruta especializada. Ejemplo: `backend/app/api/v1/endpoints/analytics.py`. Aléjate de modificar los módulos de registro de Ventas (`sales_service.py`) para evitar problemas de regresión en el dominio core.

### En Frontend (Vite/React)
Para la parte gráfica:
1. Crea tu módulo bajo `frontend/src/pages/BI/`.
2. Emplea componentes de librerías modernas de charts sin estado (recomendamos `Recharts` o `Chart.js` según decisión de arquitectura aprobada).
3. Asegura que uses Loading States nativos mientras se consume el endpoint pesado del BI.

---

¡Gracias por leer! Sírvase consultar y discutir arquitectura en tus Pull Requests en GitHub.
