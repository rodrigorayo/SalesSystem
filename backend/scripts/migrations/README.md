# 📁 scripts/migrations/

Scripts de migración de datos. Representan cambios **ya aplicados** a la base de datos de producción.
Están aquí como historial. **No re-ejecutar** a menos que sea explícitamente necesario.

---

## Historial de migraciones aplicadas

| Script | Descripción | Estado |
|--------|-------------|--------|
| `migrate_f1.py` | Migración inicial de formato de documentos | ✅ Aplicado |
| `migrate_f2.py` | Segunda migración de formato | ✅ Aplicado |
| `migrate_tenant_fix.py` | Corrección de tenant_id en documentos legacy | ✅ Aplicado |
| `apply_corrections_v2.py` | Correcciones de datos v2 | ✅ Aplicado |
| `check_dupes.py` | Detección y limpieza de duplicados | ✅ Aplicado |
| `fix_indexes.py` | Corrección de índices en MongoDB | ✅ Aplicado |
| `limpiar_huerfanos.py` | Limpieza de documentos huérfanos (v1) | ✅ Aplicado |
| `limpiar_huerfanos_2.py` | Limpieza de documentos huérfanos (v2) | ✅ Aplicado |
| `limpiar_huerfanos_3.py` | Limpieza de documentos huérfanos (v3) | ✅ Aplicado |
| `limpiar_inventario_nulls.py` | Limpieza de nulls en inventario | ✅ Aplicado |

## ¿Cómo agregar una nueva migración?

1. Crear un nuevo script `migrate_NNN_descripcion.py` en esta carpeta.
2. Documentar qué hace, cuándo se aplicó y en qué entorno.
3. Marcarla como ✅ en esta tabla una vez aplicada.
