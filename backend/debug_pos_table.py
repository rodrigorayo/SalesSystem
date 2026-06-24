import asyncio
from datetime import datetime, timezone
import os
import sys

# Agregar ruta al path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def main():
    from app.infrastructure.db import init_db
    from app.services.analytics_service import get_dashboard_metrics
    
    await init_db()
    
    start = "2026-06-03T00:00:00.000Z"
    end = "2026-06-03T23:59:59.000Z"
    
    print("Probando Tabla Rentabilidad para ventas de HOY (03 Junio)...")
    try:
        res = await get_dashboard_metrics(
            tenant_id="*",
            start_date=start,
            end_date=end,
            sucursal_id=None,
            time_range="today"
        )
        rentabilidad = res.get("top_productos_rentabilidad", [])
        print(f"Productos extraídos para la tabla (Historial + POS): {len(rentabilidad)}")
        for r in rentabilidad[:5]:
            print(f"  {r['nombre']} -> Ingresos: {r['ingresos']} | Cantidad: {r['cantidad']}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
