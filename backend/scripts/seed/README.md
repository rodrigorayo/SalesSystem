# 📁 scripts/seed/

Scripts para poblar la base de datos con datos de prueba o iniciales.
Usar solo en entornos de **desarrollo o staging**. Nunca en producción.

---

## Scripts disponibles

### `simular_categorias.py`
Genera categorías de prueba para un tenant.
```bash
cd backend
python scripts/seed/simular_categorias.py
```

### `simular_cat_id.py`
Simula la asignación de IDs de categorías.
```bash
cd backend
python scripts/seed/simular_cat_id.py
```

### `simular_import_local.py`
Simula una importación de productos desde Excel en local (sin archivo real).
```bash
cd backend
python scripts/seed/simular_import_local.py
```
