# 📁 scripts/admin/

Scripts de administración del sistema. Deben ejecutarse **manualmente** con cautela.
**Nunca ejecutar en producción sin leer cada script primero.**

---

## Scripts disponibles

### `create_superadmin.py`
Crea el usuario superadmin inicial del sistema.
```bash
cd backend
python scripts/admin/create_superadmin.py
```

### `create_superuser.py`
Crea un usuario administrador para un tenant existente.
```bash
cd backend
python scripts/admin/create_superuser.py
```

### `limpiar_db.py`
⚠️ **PELIGROSO** — Limpia colecciones de la base de datos.
Leer el script y confirmar qué colecciones afecta antes de ejecutar.
```bash
cd backend
python scripts/admin/limpiar_db.py
```

### `reset_database.py`
💣 **MUY PELIGROSO** — Resetea la base de datos completa.
Solo usar en entornos de desarrollo local. **NUNCA en producción.**
```bash
cd backend
python scripts/admin/reset_database.py
```
