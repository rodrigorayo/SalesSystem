import asyncio
import os
from datetime import datetime
from decimal import Decimal
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, Document
from typing import Optional, List
from pydantic import Field

# Re-definimos lo mínimo necesario para que el script sea independiente
class CajaSesion(Document):
    tenant_id: str
    sucursal_id: str
    cajero_id: str
    estado: str
    class Settings: name = "caja_sesiones"

class CajaMovimiento(Document):
    tenant_id: str
    sucursal_id: str
    sesion_id: str
    cajero_id: str
    cajero_name: str
    subtipo: str
    tipo: str
    monto: Decimal
    descripcion: str
    sale_id: str
    fecha: datetime = Field(default_factory=datetime.utcnow)
    class Settings: name = "caja_movimientos"

class Sale(Document):
    tenant_id: str
    sucursal_id: str
    total: Decimal
    pagos: List[dict]
    cliente: Optional[dict]
    class Settings: name = "sales"

async def sync_missing_abono():
    # Usamos la URI de desarrollo si no hay una de entorno (ajustar según tu config)
    uri = "mongodb://localhost:27017/sales_system" # Fallback local para pruebas
    # Intentar obtener de variables si es posible (en producción esto corre distinto)
    # Como soy un agente, asumo que tengo acceso al entorno del repo.
    
    # NOTA: En este entorno voy a intentar inyectarlo vía un script que el backend pueda importar
    # o simplemente conectando si la URI es visible.
    print("Iniciando sincronización manual de abono...")
    
    # 1. Buscar la venta de Gabriel Peralta con el abono de 100
    # En la imagen vemos que el ID de la venta termina en algo que no es visible pero el monto es 227 inicial, 100 pagado.
    client = AsyncIOMotorClient("mongodb://localhost:27017") # Ajustar si es necesario
    db = client.sales_system
    await init_beanie(database=db, document_models=[Sale, CajaSesion, CajaMovimiento])

    # Buscamos ventas con abonos de hoy
    sales = await Sale.find({"cliente.nit": "Sin NIT", "total": Decimal("227.00")}).to_list()
    if not sales:
        print("No se encontró la venta específica. Intentando por monto de pago...")
        sales = await Sale.find({"pagos.monto": 100.0}).to_list()

    if not sales:
        print("ERROR: No se encontró la venta de Gabriel Peralta en la DB.")
        return

    sale = sales[0]
    print(f"Venta encontrada: {sale.id}")

    # 2. Buscar caja abierta de Ninoska
    caja = await CajaSesion.find_one({"cajero_name": "Ninoska Cori Amaru", "estado": "ABIERTA"})
    if not caja:
        print("ERROR: No se encontró una caja abierta para Ninoska.")
        return

    # 3. Verificar si ya existe el movimiento para no duplicar
    mov_existente = await CajaMovimiento.find_one({"sale_id": str(sale.id), "monto": Decimal("100.00"), "subtipo": "INGRESO_EFECTIVO"})
    if mov_existente:
        print("AVISO: El movimiento ya existe en caja. No se requiere acción.")
        return

    # 4. Crear el movimiento
    nuevo_mov = CajaMovimiento(
        tenant_id=sale.tenant_id,
        sucursal_id=sale.sucursal_id,
        sesion_id=str(caja.id),
        cajero_id=caja.cajero_id,
        cajero_name="Ninoska Cori Amaru",
        subtipo="INGRESO_EFECTIVO",
        tipo="INGRESO",
        monto=Decimal("100.00"),
        descripcion="Sincronización Manual: Abono Gabriel Peralta",
        sale_id=str(sale.id)
    )
    await nuevo_mov.insert()
    print("✅ Movimiento inyectado exitosamente en la caja de hoy.")

if __name__ == "__main__":
    asyncio.run(sync_missing_abono())
