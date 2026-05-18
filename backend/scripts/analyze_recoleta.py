import asyncio
from app.infrastructure.db import init_db
from app.domain.models.caja import CajaSesion
from app.domain.models.sale import Sale
from datetime import datetime, timedelta

async def analyze():
    await init_db()
    
    print("\n--- CAJA SESIONES RECIENTES (ÚLTIMOS 7 DÍAS) ---")
    cutoff = datetime.utcnow() - timedelta(days=7)
    sesiones = await CajaSesion.find(CajaSesion.apertura >= cutoff).sort(-CajaSesion.apertura).to_list()
    
    # Group by cajero_id to find overlapping ones
    from collections import defaultdict
    by_cajero = defaultdict(list)
    for s in sesiones:
        by_cajero[str(s.cajero_id)].append(s)
        
    ghost_sessions = []
    
    for cajero, s_list in by_cajero.items():
        # sort by apertura ascending
        s_list.sort(key=lambda x: x.apertura)
        for i in range(len(s_list) - 1):
            s1 = s_list[i]
            s2 = s_list[i+1]
            # If s2 opens before s1 closes (or if s1 is still open)
            if s1.estado == "ABIERTA" or (s1.cierre and s2.apertura < s1.cierre):
                # They overlap! Check if they are suspiciously close (double click)
                diff = (s2.apertura - s1.apertura).total_seconds()
                if diff < 60: # within 1 minute
                    print(f"\n[!] OVERLAPPING SESSIONS DETECTED for Cajero {getattr(s1, 'cajero_nombre', cajero)}")
                    print(f"  Session 1: {s1.id} | Opened: {s1.apertura} | Status: {s1.estado}")
                    print(f"  Session 2: {s2.id} | Opened: {s2.apertura} | Status: {s2.estado} | Diff: {diff}s")
                    ghost_sessions.append((s1, s2))

    print("\n--- SALES IN OVERLAPPING SESSIONS ---")
    for s1, s2 in ghost_sessions:
        sales1 = await Sale.find(Sale.caja_sesion_id == str(s1.id)).to_list()
        sales2 = await Sale.find(Sale.caja_sesion_id == str(s2.id)).to_list()
        print(f"\nSession 1 ({s1.id}) Sales: {len(sales1)}")
        for sa in sales1:
            total = getattr(sa, 'total', 0)
            items = [getattr(i, 'producto_nombre', '') for i in getattr(sa, 'items', [])]
            print(f"  - Sale {sa.id} | Total: {total} | Status: {sa.estado.value} | Pago: {sa.estado_pago.value} | Items: {items}")
            
        print(f"\nSession 2 ({s2.id}) Sales: {len(sales2)}")
        for sa in sales2:
            total = getattr(sa, 'total', 0)
            items = [getattr(i, 'producto_nombre', '') for i in getattr(sa, 'items', [])]
            print(f"  - Sale {sa.id} | Total: {total} | Status: {sa.estado.value} | Pago: {sa.estado_pago.value} | Items: {items}")

if __name__ == "__main__":
    asyncio.run(analyze())
