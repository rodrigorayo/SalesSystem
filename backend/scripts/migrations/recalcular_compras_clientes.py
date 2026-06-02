import sys
import os
import asyncio

# Fix path to support direct execution
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.infrastructure.db import init_db
from app.domain.models.cliente import Cliente
from app.domain.models.sale import Sale
from app.domain.models.base import DecimalMoney

async def main():
    print("Iniciando conexión a la Base de Datos...")
    await init_db()
    print("Conexión establecida.")

    clientes = await Cliente.find_all().to_list()
    total_clientes = len(clientes)
    print(f"Total de clientes a procesar: {total_clientes}")

    procesados = 0
    actualizados = 0

    for cliente in clientes:
        cliente_id_str = str(cliente.id)
        # Buscar todas las ventas no anuladas de este cliente
        ventas = await Sale.find(
            Sale.cliente_id == cliente_id_str,
            Sale.anulada == False
        ).to_list()

        cantidad = len(ventas)
        total_acumulado = sum((v.total for v in ventas), DecimalMoney("0.0"))

        # Actualizar si los valores difieren de los actuales
        if cliente.cantidad_compras != cantidad or cliente.total_compras != total_acumulado:
            cliente.cantidad_compras = cantidad
            cliente.total_compras = total_acumulado
            await cliente.save()
            actualizados += 1

        procesados += 1
        if procesados % 50 == 0 or procesados == total_clientes:
            print(f"Progreso: {procesados}/{total_clientes} clientes procesados...")

    print(f"¡Sincronización completada!")
    print(f"Clientes con cambios de compras e importes recalculados: {actualizados}/{total_clientes}")

if __name__ == "__main__":
    asyncio.run(main())
