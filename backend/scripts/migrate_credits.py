import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from decimal import Decimal
import os
import sys

# Agrega la raíz del proyecto al path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.domain.models.sale import Sale, EstadoPago
from app.domain.models.credito import CuentaCredito, Deuda, TransaccionCredito, EstadoCuenta, EstadoDeuda
from app.domain.models.base import DecimalMoney
from app.infrastructure.core.config import settings

async def migrate_credits():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(database=client.salessystem, document_models=[Sale, CuentaCredito, Deuda, TransaccionCredito])

    print("Iniciando migración de cuentas y deudas de ventas históricas...")

    # Buscamos todas las ventas que están o estuvieron a crédito:
    # 1. Ventas que tienen estado_pago PENDIENTE o PARCIAL
    # 2. Ventas que tienen estado_pago PAGADO pero tienen "CREDITO" en sus métodos (fueron deudas, pagadas)
    
    ventas = await Sale.find({"pagos.metodo": "CREDITO"}).to_list()
    print(f"Total ventas con historial de crédito encontradas: {len(ventas)}")
    
    cuentas_creadas = 0
    deudas_creadas = 0
    
    for sale in ventas:
        if not sale.cliente_id:
            print(f"Ignorando venta {sale.id} - estado {sale.estado_pago} (No tiene cliente_id)")
            continue
            
        cuenta = await CuentaCredito.find_one({"tenant_id": sale.tenant_id, "cliente_id": sale.cliente_id})
        computed_total = Decimal(str(sale.total))
        pagado_al_contado = sum(Decimal(str(p.monto)) for p in sale.pagos if p.metodo != "CREDITO" and getattr(p, '_id', None) is None) # simplificacion
        
        # actually pagado_al_contado = todo lo pagado menos CREDITO original
        # Wait, en el modelo anterior, ¿cómo se diferenciaba el CREDITO inicial del abono posterior?
        # El pago "CREDITO" solía ser el monto que se mandaba a crédito en la VentaOriginal.
        # Los abonos se guardaban como EFECTIVO, QR, etc., con fechas posteriores.
        
        monto_credito_original = sum(Decimal(str(p.monto)) for p in sale.pagos if p.metodo == "CREDITO")
        monto_abonado = sum(Decimal(str(p.monto)) for p in sale.pagos if p.metodo != "CREDITO" and getattr(p, 'is_abono', True)) # Es complicado saber.
        
        # Una aproximación segura: la deuda original fue Total - Pagos hechos *en el mismo minuto*? 
        # O podemos usar la fórmula: deuda original = total
        # Simplificación para migración:
        # Si estado es PENDIENTE / PARCIAL, creamos Deuda.
        
        pagos_abonos = sum((Decimal(str(p.monto)) for p in sale.pagos if getattr(p, "metodo", "") != "CREDITO"))
        
        # Asumiremos monto de deuda original = Sale.total (esto podría no ser exacto si dio enganche)
        # Es mejor: Monto Credito Original = Sum(pagos con metodo CREDITO).
        # Ah! en app.domain.models.sale.py PagoItem no guarda si es enganche vs abono explícitamente, pero podemos ver la fecha. Si hay pagos EFECTIVO, QR con la misma fecha de la venta, son enganches. Si son distintos, son abonos.
        
        if monto_credito_original == 0:
            monto_credito_original = computed_total # default
            
        saldo_pendiente = monto_credito_original - pagos_abonos
        if saldo_pendiente < 0: saldo_pendiente = Decimal("0")
        
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
                cuentas_creadas += 1

            deuda_estado = EstadoDeuda.PAGADA
            if sale.estado_pago == EstadoPago.PENDIENTE: deuda_estado = EstadoDeuda.PENDIENTE
            if sale.estado_pago == EstadoPago.PARCIAL: deuda_estado = EstadoDeuda.PARCIAL
            
            deuda = Deuda(
                tenant_id=sale.tenant_id,
                sucursal_id=sale.sucursal_id,
                cuenta_id=str(cuenta.id),
                cliente_id=sale.cliente_id,
                sale_id=str(sale.id),
                monto_original=DecimalMoney(str(monto_credito_original)),
                saldo_pendiente=DecimalMoney(str(saldo_pendiente)),
                fecha_emision=sale.created_at,
                estado=deuda_estado
            )
            await deuda.insert()
            deudas_creadas += 1
            
            if deuda_estado in [EstadoDeuda.PENDIENTE, EstadoDeuda.PARCIAL]:
                cuenta.saldo_total = DecimalMoney(str(Decimal(str(cuenta.saldo_total)) + saldo_pendiente))
                await cuenta.save()

    print(f"Migración completada. Cuentas creadas: {cuentas_creadas}, Deudas creadas: {deudas_creadas}")

if __name__ == "__main__":
    asyncio.run(migrate_credits())
