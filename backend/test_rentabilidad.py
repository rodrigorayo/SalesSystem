import asyncio
from datetime import datetime, timezone

async def main():
    from app.services.analytics_service import get_dashboard_metrics
    start = "2026-05-01T00:00:00.000Z"
    end = "2026-05-31T23:59:59.000Z"
    
    print("Probando Tabla Rentabilidad (Heroinas / Mayo 2026)...")
    try:
        res = await get_dashboard_metrics(
            tenant_id="*",
            start_date=start,
            end_date=end,
            sucursal_id="Heroinas",
            time_range="this_month"
        )
        rentabilidad = res.get("top_productos_rentabilidad", [])
        print(f"Productos extraídos para la tabla: {len(rentabilidad)}")
        for r in rentabilidad[:3]:
            print(f"  {r['nombre']} -> Ingresos: {r['ingresos']} | Cantidad: {r['cantidad']}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
