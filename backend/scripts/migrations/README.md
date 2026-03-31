# Migrador de Flotantes a Decimal128 (Idempotente)

Este script fue diseñado arquitectónicamente para transformar TODA tu base de datos y parchar operaciones financieras peligrosas basadas en "Float/Double" hacia el entorno empresarial "Decimal128".

## Características de Producción
- **Batch Processing:** Utiliza `bulk_write` asíncrono en lotes de 500 para jamás ahogar la RAM de tu Cluster de MongoDB Atlas si tienes millones de tickets de caja.
- **Idempotencia:** Si el servidor se apaga a la mitad de la migración... vuelve a correrla. El script está programado para ignorar y descartar inteligentemente los documentos que ya tengan el flag nativo de `$Decimal128`.
- **Recursión Dinámica:** Encuentra y sanea `floats` incluso escondidos dentro de Arrays de `Sale.items[]` y objetos incrustados `dict`.

---

# INSTRUCCIONES DE USO

> [!CAUTION]
> **OBLIGATORIO: HAZ UN BACKUP.**
> Jamás juegues a los dados con la base de datos de producción financiera de un cliente real. Antes de correr el script, asegúrate de tomar una snapshot nativa tu base de Mongo. Si usas MongoDB Atlas, solo ve a tu Cluster y presiona "Create Snapshot".

```bash
# 1. Posiciónate en la raíz del backend (donde está el Pipfile o main.py)
cd backend

# 2. Ejecuta el archivo desde tu consola o CI/CD (con las ENV vars de Mongo ya configuradas)
python scripts/migrations/float_to_decimal128.py

# 3. Te pedirá confirmación de que tomaste backup. Escribe "SI" en mayúsculas y presiona Enter.
```

El loguero mostrará de forma asíncrona exactamente cuántos registros inspeccionó (con una latencia mínima) y cuántos documentos modificó e interceptó.
