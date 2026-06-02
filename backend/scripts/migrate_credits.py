import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from decimal import Decimal
import os
import sys

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.domain.models.sale import Sale, EstadoPago
from app.domain.models.cliente import Cliente
from app.domain.models.credito import CuentaCredito, Deuda, TransaccionCredito, EstadoCuenta, EstadoDeuda
from app.domain.models.base import DecimalMoney
from app.infrastructure.core.config import settings

async def master_migration():
    uri = settings.MONGODB_URL
    client = AsyncIOMotorClient(uri)
    db = client.salessystem

    print("--- INICIANDO MIGRACIÓN MAESTRA (ULTRA ROBUSTA) ---")

    # 1. FIX: Assign default tenant_id to older sales (Raw Motor to avoid validation errors)
    main_tenant = "69a7cb3ba61102aca89bd271" # Taboada
    print(f"Normalizando tenant_id para ventas antiguas -> {main_tenant}")
    result = await db.sales.update_many(
        {"tenant_id": None},
        {"$set": {"tenant_id": main_tenant}}
    )
    print(f"Ventas normalizadas: {result.modified_count}")

    # 2. Init Beanie
    await init_beanie(
        database=db, 
        document_models=[Sale, Cliente, CuentaCredito, Deuda, TransaccionCredito]
    )

    # 3. SCAN SALES TO GENERATE CLIENTS
    print("Escaneando ventas para identificar y crear clientes faltantes...")
    todas_ventas = await Sale.find({}).to_list()
    
    clientes_mapeados = {} # (nombre, telf) -> id
    stats_clientes = 0
    stats_vinculos = 0

    for sale in todas_ventas:
        if not sale.cliente or not (sale.cliente.razon_social or sale.cliente.telefono):
            continue
            
        nombre = (sale.cliente.razon_social or "CONSUMIDOR FINAL").strip().upper()
        telf = (sale.cliente.telefono or "").strip()
        key = (nombre, telf)
        
        if key not in clientes_mapeados:
            # Re-check in DB
            db_cliente = await Cliente.find_one({
                "tenant_id": sale.tenant_id,
                "nombre": nombre,
                "telefono": telf if telf else None
            })
            
            if not db_cliente:
                db_cliente = Cliente(
                    tenant_id=sale.tenant_id,
                    nombre=nombre,
                    telefono=telf if telf else None,
                    nit_ci=sale.cliente.nit,
                    email=sale.cliente.email
                )
                await db_cliente.insert()
                stats_clientes += 1
            
            clientes_mapeados[key] = str(db_cliente.id)
        
        # Link Sale to Client
        if not sale.cliente_id:
            sale.cliente_id = clientes_mapeados[key]
            await sale.save()
            stats_vinculos += 1

    print(f"Total Clientes en sistema: {len(clientes_mapeados)} (Nuevos creados: {stats_clientes})")
    print(f"Ventas vinculadas a clientes: {stats_vinculos}")

    # 4. MIGRATE DEBTS
    print("\nProcesando deudas pendientes hacia el nuevo módulo...")
    
    query_deudas = {"estado_pago": {"$in": ["PENDIENTE", "PARCIAL"]}}
    ventas_deuda = await Sale.find(query_deudas).to_list()
    
    stats_deudas = 0
    stats_cuentas = 0
    
    for sale in ventas_deuda:
        if not sale.cliente_id:
            continue
            
        cuenta = await CuentaCredito.find_one({"tenant_id": sale.tenant_id, "cliente_id": sale.cliente_id})
        
        computed_total = Decimal(str(sale.total))
        # Logic: Current state uses sum of pagos vs total to define debt
        pagos_reales = sum(Decimal(str(p.monto)) for p in sale.pagos if p.metodo != "CREDITO")
        saldo_pendiente = max(Decimal("0"), computed_total - pagos_reales)
        
        if saldo_pendiente <= 0:
            continue

        deuda_existente = await Deuda.find_one(Deuda.sale_id == str(sale.id))
        
        if not deuda_existente:
            if not cuenta:
                cuenta = CuentaCredito(
                    tenant_id=sale.tenant_id,
                    cliente_id=sale.cliente_id,
                    saldo_total=DecimalMoney("0"),
                    estado_cuenta=EstadoCuenta.AL_DIA
                )
                await cuenta.insert()
                stats_cuentas += 1

            deuda = Deuda(
                tenant_id=sale.tenant_id,
                sucursal_id=sale.sucursal_id,
                cuenta_id=str(cuenta.id),
                cliente_id=sale.cliente_id,
                sale_id=str(sale.id),
                monto_original=DecimalMoney(str(saldo_pendiente)),
                saldo_pendiente=DecimalMoney(str(saldo_pendiente)),
                fecha_emision=sale.created_at,
                estado=EstadoDeuda.PENDIENTE if sale.estado_pago == EstadoPago.PENDIENTE else EstadoDeuda.PARCIAL
            )
            await deuda.insert()
            stats_deudas += 1
            
            # Update Account Total
            curr_saldo = Decimal(str(cuenta.saldo_total))
            cuenta.saldo_total = DecimalMoney(str(curr_saldo + saldo_pendiente))
            await cuenta.save()

    print(f"Deudas migradas exitosamente: {stats_deudas}")
    print(f"Cuentas de crédito activadas: {stats_cuentas}")
    print("--- MIGRACIÓN MAESTRA COMPLETADA ---")

if __name__ == "__main__":
    asyncio.run(master_migration())
