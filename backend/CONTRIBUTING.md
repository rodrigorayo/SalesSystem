# CONTRIBUTING.md — SalesSystem Backend

Guía de trabajo en equipo. Leer antes de hacer tu primer PR.

---

## Estructura del Proyecto

```
backend/
├── app/
│   ├── main.py               # FastAPI app, lifespan, middleware
│   ├── db.py                 # Inicialización de Beanie
│   ├── auth.py               # JWT helpers (get_current_active_user)
│   ├── core/
│   │   ├── config.py         # Variables de entorno (Settings)
│   │   └── dependencies.py   # ← Autorización centralizada (require_roles, etc.)
│   ├── models/               # Beanie Documents — esquema de la base de datos
│   ├── schemas/              # Pydantic schemas de request/response (en construcción)
│   ├── services/             # Lógica de negocio (en construcción)
│   ├── repositories/         # Queries MongoDB complejos (en construcción)
│   └── api/v1/endpoints/     # Solo HTTP: validar input, llamar service, devolver response
├── scripts/
│   ├── admin/                # Scripts de administración (con README)
│   ├── migrations/           # Migraciones ya aplicadas (historial)
│   └── seed/                 # Datos de prueba/desarrollo
└── requirements.txt
```

---

## Reglas de Código

### ✅ Endpoints (api/v1/endpoints/)
- El endpoint **solo hace**: validar permisos, parsear input, llamar al service, devolver response.
- **Máximo ~80-100 líneas por handler**.
- Usar `Depends(require_roles(...))` de `app.core.dependencies` para autorización.
- **No** escribir queries PyMongo/Beanie directamente en el endpoint.
- **No** definir schemas Pydantic (BaseModel) dentro del archivo del endpoint.

```python
# ✅ Correcto
@router.post("/products")
async def create_product(
    data: ProductCreate,  # importado desde schemas/
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERADMIN))
):
    return await product_service.create(data, current_user.tenant_id)

# ❌ Incorrecto
@router.post("/products")
async def create_product(data: ProductCreate, current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:  # ← duplicado
        raise HTTPException(...)
    # 80 líneas de lógica directamente aquí ...
```

### ✅ Schemas (schemas/)
- Todo `BaseModel` de request o response vive en `schemas/`.
- Nombrar como `ProductCreate`, `ProductUpdate`, `ProductOut`.

### ✅ Services (services/) — en construcción
- Contienen la **lógica de negocio**: orquestación, validaciones de dominio.
- Retornan objetos Python puros, sin HTTPException (eso es responsabilidad del endpoint).

### ✅ Repositories (repositories/) — en construcción
- Encapsulan queries complejas de MongoDB (aggregations, bulk_write).
- Son el único lugar donde se puede llamar `get_pymongo_collection()`.

### ✅ Paginación
- Usar siempre `Query(default=50, ge=1, le=200)` para el parámetro `limit`.
- Nunca usar `limit=1000` como default.

---

## Flujo de Git (Scrum)

```
main          ← producción (Render + Vercel)
  └── develop ← rama de integración del sprint
        ├── feature/TASK-XX-descripcion  ← tu feature
        └── fix/TASK-XX-descripcion      ← tu bugfix
```

1. **Nunca pushear directo a `main`**.
2. PR a `develop`, mínimo 1 review antes de merge.
3. Al final del sprint, `develop` → `main` (deploy).

---

## Entornos

| Entorno | Backend | Frontend | DB |
|---------|---------|----------|----|
| Local | `uvicorn app.main:app --reload` (puerto 8000) | `npm run dev` (puerto 5173) | MongoDB local o Atlas dev |
| Staging | Render (rama `develop`) | Vercel (preview) | Atlas |
| Prod | Render (rama `main`) | Vercel (main) | Atlas |

---

## Variables de Entorno Necesarias

Crear `backend/.env` para desarrollo local (nunca commitear):

```env
MONGODB_URL=mongodb+srv://...
JWT_SECRET_KEY=una-clave-larga-y-segura
ALLOWED_ORIGINS=http://localhost:5173
ENVIRONMENT=development
```
