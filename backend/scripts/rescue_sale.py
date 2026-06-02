"""
Script de rescate: Encuentra la venta de GABRIEL PERALTA (Ticket #33B075, 359 Bs)
y crea su deuda en el módulo de créditos si no existe.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from decimal import Decimal
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.domain.models.sale import Sale, EstadoPago
from app.domain.models.cliente import Cliente
from app.domain.models.credito import CuentaCredito, Deuda, TransaccionCredito, EstadoCuenta, EstadoDeuda
from app.domain.models.base import DecimalMoney
from app.infrastructure.core.config import settings

async def rescue_sale():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client.salessystem, 
        document_models=[Sale, Cliente, CuentaCredito, Deuda, TransaccionCredito]
    )
    
    # Buscar la venta por estado PENDIENTE y total 359 y nombre del cajero Ninoska
    ventas = await Sale.find({
        "estado_pago": {"$in": ["PENDIENTE", "PARCIAL"]},
        "cashier_name": {"$regex": "Ninoska", "$options": "i"},
        "total": {"$in": [359.0, 359, "359.00", "359"]}  # searching in multiple formats
    }).to_list()
    
    if not ventas:
        # Try broader search
        ventas = await Sale.find({
            "estado_pago": {"$in": ["PENDIENTE", "PARCIAL"]},
            "cashier_name": {"$regex": "Ninoska", "$options": "i"}
        }).sort(-Sale.created_at).to_list()
        
    print(f"Ventas pendientes de Ninoska encontradas: {len(ventas)}")
    for v in ventas:
        print(f"  ID: {str(v.id)[-6:].upper()}, Total: {v.total}, Cliente: {v.cliente}, Estado: {v.estado_pago}")
    
    # Try to find by sale id short ticket #33B075
    # The "33B075" is the last 6 chars of the sale id
    all_pending = await Sale.find({"estado_pago": {"$in": ["PENDIENTE", "PARCIAL"]}}).sort(-Sale.created_at).limit(30).to_list()
    for v in all_pending:
        short_id = str(v.id)[-6:].upper()
        if short_id == "33B075":
            print(f"\n*** VENTA ENCONTRADA: {v.id} ***")
            print(f"  Total: {v.total}, Estado: {v.estado_pago}")
            print(f"  Cliente snapshot: {v.cliente}")
            print(f"  Cliente ID: {v.cliente_id}")
            
            # Check if debt already exists
            deuda_existente = await Deuda.find_one(Deuda.sale_id == str(v.id))
            if deuda_existente:
                print(f"  DEUDA YA EXISTE: {deuda_existente.id}")
                return
            
            # Resolve or create client
            cliente_id = v.cliente_id
            if not cliente_id and v.cliente:
                nombre = (v.cliente.razon_social or "CONSUMIDOR FINAL").strip().upper()
                telf = (v.cliente.telefono or "").strip() or None
                
                db_cliente = await Cliente.find_one({"tenant_id": v.tenant_id, "nombre": nombre, "telefono": telf})
                if not db_cliente:
                    db_cliente = Cliente(
                        tenant_id=v.tenant_id,
                        nombre=nombre,
                        telefono=telf,
                        nit_ci=v.cliente.nit,
                        email=v.cliente.email
                    )
                    await db_cliente.insert()
                    print(f"  Cliente CREADO: {db_cliente.id} - {db_cliente.nombre}")
                else:
                    print(f"  Cliente ENCONTRADO: {db_cliente.id} - {db_cliente.nombre}")
                
                cliente_id = str(db_cliente.id)
                v.cliente_id = cliente_id
                await v.save()
                print(f"  Venta VINCULADA a cliente {cliente_id}")
            
            if not cliente_id:
                print("  ERROR: No se puede crear deuda sin cliente_id.")
                return
            
            # Create or get CuentaCredito
            cuenta = await CuentaCredito.find_one({"tenant_id": v.tenant_id, "cliente_id": cliente_id})
            if not cuenta:
                cuenta = CuentaCredito(
                    tenant_id=v.tenant_id,
                    cliente_id=cliente_id,
                    saldo_total=DecimalMoney("0"),
                    estado_cuenta=EstadoCuenta.AL_DIA
                )
                await cuenta.insert()
                print(f"  CuentaCredito CREADA: {cuenta.id}")
            
            # Calculate real pending amount
            pagos_reales = sum(Decimal(str(p.monto)) for p in v.pagos if p.metodo != "CREDITO")
            saldo_pendiente = max(Decimal("0"), Decimal(str(v.total)) - pagos_reales)
            
            # Create Deuda
            deuda = Deuda(
                tenant_id=v.tenant_id,
                sucursal_id=v.sucursal_id,
                cuenta_id=str(cuenta.id),
                cliente_id=cliente_id,
                sale_id=str(v.id),
                monto_original=DecimalMoney(str(saldo_pendiente)),
                saldo_pendiente=DecimalMoney(str(saldo_pendiente)),
                fecha_emision=v.created_at,
                estado=EstadoDeuda.PENDIENTE if v.estado_pago == EstadoPago.PENDIENTE else EstadoDeuda.PARCIAL
            )
            await deuda.insert()
            print(f"  Deuda CREADA: {deuda.id} - Saldo: {saldo_pendiente} Bs.")
            
            # Update account total
            cuenta.saldo_total = DecimalMoney(str(Decimal(str(cuenta.saldo_total)) + saldo_pendiente))
            await cuenta.save()
            
            # Create transaction
            transaccion = TransaccionCredito(
                tenant_id=v.tenant_id,
                sucursal_id=v.sucursal_id,
                cuenta_id=str(cuenta.id),
                cliente_id=cliente_id,
                tipo="CARGO",
                monto=DecimalMoney(str(saldo_pendiente)),
                sale_id=str(v.id),
                cajero_id=v.cashier_id,
                cajero_nombre=v.cashier_name,
                notas=f"Rescate de deuda por Venta #33B075"
            )
            await transaccion.insert()
            
            print(f"\nRESCATE COMPLETADO: La venta #33B075 de GABRIEL PERALTA ahora aparece en el modulo de creditos.")
            return
    
    print("\nLa venta #33B075 no se encontró en ventas pendientes de los últimos 30 registros.")

if __name__ == "__main__":
    asyncio.run(rescue_sale())
