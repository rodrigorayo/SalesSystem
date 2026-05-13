import asyncio
import os
import sys
import datetime
from decimal import Decimal

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.infrastructure.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client.salessystem

    sucursal = await db.sucursales.find_one({"nombre": "FEXCO"})
    if not sucursal:
        return
    sucursal_id = str(sucursal["_id"])
    
    # Rango de fechas del reporte
    start_dt = datetime.datetime(2026, 3, 23)
    end_dt = datetime.datetime(2026, 5, 10, 23, 59, 59)
    
    print("Recopilando datos para informe ejecutivo...")

    # Buscamos todos los productos involucrados en FEXCO
    logs = await db.inventory_logs.find({"sucursal_id": sucursal_id, "created_at": {"$lte": end_dt}}).to_list(None)
    
    # Estructura para agrupar
    # dict[producto_id] = { "inicial": 0, "incomes": 0, "outcomes": 0, "final": 0, "desc": "" }
    products_data = {}
    
    for log in logs:
        pid = log.get("producto_id")
        if not pid: continue
        
        if pid not in products_data:
            products_data[pid] = {
                "inicial": Decimal("0"), "incomes": Decimal("0"), "outcomes": Decimal("0"), 
                "final_stock": 0, "last_cost": Decimal("0"), "desc": log.get("descripcion", "")
            }
            
        costo = Decimal(str(log.get("costo_unitario_momento", 0)))
        cant = log.get("cantidad_movida", 0)
        
        # Si es antes del start_dt, se va actualizando el inicial
        if log["created_at"] < start_dt:
            products_data[pid]["inicial"] = Decimal(str(log.get("stock_resultante", 0))) * costo
        else:
            # Es durante el periodo
            valor = Decimal(str(cant)) * costo
            if valor > 0:
                products_data[pid]["incomes"] += valor
            else:
                products_data[pid]["outcomes"] += abs(valor)
                
        # Siempre actualizamos el final
        products_data[pid]["final_stock"] = log.get("stock_resultante", 0)
        products_data[pid]["last_cost"] = costo
        
    # Calcular revalorizacion
    results = []
    total_reval = Decimal("0")
    
    for pid, data in products_data.items():
        if data["final_stock"] > 0:
            final_val = Decimal(str(data["final_stock"])) * data["last_cost"]
        else:
            final_val = Decimal("0")
            
        expected = data["inicial"] + data["incomes"] - data["outcomes"]
        reval = final_val - expected
        
        if abs(reval) > Decimal("0.1"):
            # Buscar nombre real si falta
            desc = data["desc"]
            if not desc or desc.strip() == "":
                prod_doc = await db.products.find_one({"_id": pid}) or await db.products.find_one({"_id": {"$oid": pid}})
                if prod_doc:
                    desc = prod_doc.get("descripcion", "Producto Sin Nombre")
                else:
                    desc = "Producto Desconocido"
                    
            results.append({
                "nombre": desc,
                "reval": reval,
                "inicial": data["inicial"],
                "incomes": data["incomes"],
                "outcomes": data["outcomes"],
                "final": final_val,
                "last_cost": data["last_cost"]
            })
            total_reval += reval

    # Ordenar por mayor revalorización absoluta
    results.sort(key=lambda x: x["reval"], reverse=True)
    
    print("\n--- INFORME EJECUTIVO: DETALLE DE REVALORIZACIÓN FEXCO ---")
    print(f"Periodo: 23/03/2026 al 10/05/2026")
    print("-" * 60)
    for r in results:
        signo = "+" if r['reval'] > 0 else ""
        print(f"Producto: {r['nombre']}")
        print(f"   Revalorización en el periodo: {signo}Bs. {float(r['reval']):,.2f}")
        print(f"   (Stock evaluado al Costo Final de Bs. {float(r['last_cost']):,.2f})")
        print("")
        
    print("-" * 60)
    print(f"TOTAL AJUSTE REVALORIZACIÓN: Bs. {float(total_reval):,.2f}")
    
if __name__ == "__main__":
    asyncio.run(run())
