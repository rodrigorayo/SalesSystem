import asyncio
from datetime import datetime, timezone
import json

async def main():
    from app.services.bcg_service import calculate_bcg_matrix
    start = datetime(2026, 5, 1, tzinfo=timezone.utc)
    end = datetime(2026, 5, 31, 23, 59, 59, tzinfo=timezone.utc)
    
    print("Calculando Matriz BCG para Heroinas en Mayo 2026...")
    try:
        res = await calculate_bcg_matrix(
            tenant_id="tenant_id_test",
            start_date=start,
            end_date=end,
            sucursal_id="Heroinas"
        )
        print(f"Estrellas: {len(res.estrellas)}")
        print(f"Vacas: {len(res.vacas)}")
        print(f"Interrogantes: {len(res.interrogantes)}")
        print(f"Perros: {len(res.perros)}")
    except Exception as e:
        print(f"ERROR MATEMÁTICO: {e}")

if __name__ == "__main__":
    asyncio.run(main())
