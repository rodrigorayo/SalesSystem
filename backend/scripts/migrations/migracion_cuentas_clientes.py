import sys
import os
import asyncio

# Fix path to support direct execution
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.infrastructure.db import init_db
from app.domain.models.cliente import Cliente
from app.domain.models.credito import CuentaCredito
from app.infrastructure.core.config import settings

async def main():
    print("Iniciando conexión a DB...")
    await init_db()
    print("Conectado.")
    
    cuentas = await CuentaCredito.find_all().to_list()
    total = len(cuentas)
    print(f"Total de cuentas de crédito a migrar: {total}")
    
    actualizadas = 0
    
    for cuenta in cuentas:
        cliente = await Cliente.get(cuenta.cliente_id)
        if cliente:
            cuenta.cliente_nombre = cliente.nombre
            cuenta.cliente_nit = cliente.nit_ci
            cuenta.cliente_telefono = cliente.telefono
            await cuenta.save()
            actualizadas += 1
            if actualizadas % 50 == 0:
                print(f"Progreso: {actualizadas}/{total}...")
        else:
            print(f"Warning: Cliente ID {cuenta.cliente_id} no encontrado para la cuenta de crédito {cuenta.id}")
            
    print(f"Migración completada. Cuentas actualizadas: {actualizadas}/{total}")

if __name__ == "__main__":
    asyncio.run(main())
