import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from decimal import Decimal

from app.domain.models.sale import Sale, EstadoPago
from app.domain.models.cliente import Cliente
from app.domain.models.credito import CuentaCredito, Deuda, TransaccionCredito, EstadoCuenta, EstadoDeuda
from app.domain.models.base import DecimalMoney
from app.infrastructure.core.config import settings

async def rescue_sale():
    client = AsyncIOMotorClient("mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/?appName=Cluster0")
    await init_beanie(
        database=client.salessystem, 
        document_models=[Sale, Cliente, CuentaCredito, Deuda, TransaccionCredito]
    )
    
    # Buscar ultima venta de 10 Bs PENDIENTE de Ninoska (la que fallo por el deploy)
    ventas = await Sale.find({
        "estado_pago": {"$in": ["PENDIENTE", "PARCIAL"]},
    }).sort(-Sale.created_at).limit(10).to_list()
    
    for v in ventas:
        if str(v.id).endswith("a998f7"):
            print(f"\n*** VENTA ENCONTRADA: {v.id} ***")
            
            # Check if debt already exists
            deuda_existente = await Deuda.find_one(Deuda.sale_id == str(v.id))
            if deuda_existente:
                print(f"  DEUDA YA EXISTE: {deuda_existente.id}")
                continue
            
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
                notas=f"Rescate manual de deuda"
            )
            await transaccion.insert()
            
            print(f"\nRESCATE COMPLETADO para A998F7")

if __name__ == "__main__":
    asyncio.run(rescue_sale())
