from decimal import Decimal
from typing import List, Optional
from fastapi import HTTPException
from datetime import datetime

from app.domain.models.credito import (
    CuentaCredito, Deuda, TransaccionCredito, PagoCreditoItemInfo,
    EstadoCuenta, EstadoDeuda
)
from app.domain.models.sale import Sale, EstadoPago, PagoItem
from app.domain.models.caja import CajaSesion, CajaMovimiento, EstadoSesion, SubtipoMovimiento
from app.domain.models.user import User
from app.domain.models.base import DecimalMoney
from app.schemas.credito import AbonoRequestIn

class CreditoService:
    @staticmethod
    async def registrar_deuda_desde_venta(sale: Sale, monto_deuda: Decimal, cliente_id: str, session=None):
        """
        Creates or updates a CuentaCredito and creates a Deuda line for a sale that was not fully paid.
        """
        # 1. Fetch or create CuentaCredito
        cuenta = await CuentaCredito.find_one({
            "tenant_id": sale.tenant_id,
            "cliente_id": cliente_id
        }, session=session)
        
        if not cuenta:
            from app.domain.models.cliente import Cliente # Import here to avoid circular imports if needed
            cliente = await Cliente.get(cliente_id)
            cuenta = CuentaCredito(
                tenant_id=sale.tenant_id,
                cliente_id=cliente_id,
                cliente_nombre=cliente.nombre if cliente else "Desconocido",
                cliente_nit=cliente.nit_ci if cliente else None,
                cliente_telefono=cliente.telefono if cliente else None,
                saldo_total=DecimalMoney("0"),
                estado_cuenta=EstadoCuenta.AL_DIA
            )
            await cuenta.insert(session=session)
            
        # 2. Create Deuda
        deuda = Deuda(
            tenant_id=sale.tenant_id,
            sucursal_id=sale.sucursal_id,
            cuenta_id=str(cuenta.id),
            cliente_id=cliente_id,
            sale_id=str(sale.id),
            monto_original=DecimalMoney(str(monto_deuda)),
            saldo_pendiente=DecimalMoney(str(monto_deuda)),
            fecha_emision=sale.created_at,
            estado=EstadoDeuda.PENDIENTE
        )
        await deuda.insert(session=session)
        
        # 3. Update CuentaCredito
        cuenta.saldo_total = DecimalMoney(str(Decimal(str(cuenta.saldo_total)) + monto_deuda))
        await cuenta.save(session=session)
        
        # 4. Transaccion de Cargo
        transaccion = TransaccionCredito(
            tenant_id=sale.tenant_id,
            sucursal_id=sale.sucursal_id,
            cuenta_id=str(cuenta.id),
            cliente_id=cliente_id,
            tipo="CARGO",
            monto=DecimalMoney(str(monto_deuda)),
            sale_id=str(sale.id),
            cajero_id=sale.cashier_id,
            cajero_nombre=sale.cashier_name,
            notas=f"Deuda por Venta #{str(sale.id)[-6:].upper()}"
        )
        await transaccion.insert(session=session)
        
        return deuda

    @staticmethod
    async def registrar_abono(cuenta_id: str, request: AbonoRequestIn, user: User):
        """
        Registers a payment across the account, auto-applying to oldest debts if no deuda_id specified.
        Handles mixed payments (QR/EFECTIVO) and creates CajaMovimiento.
        """
        cuenta = await CuentaCredito.get(cuenta_id)
        if not cuenta or cuenta.tenant_id != (user.tenant_id or "default"):
            raise HTTPException(status_code=404, detail="Cuenta de crédito no encontrada.")
            
        # 1. Check Cash Box Session (Caja)
        caja = await CajaSesion.find_one(
            CajaSesion.tenant_id == cuenta.tenant_id,
            CajaSesion.cajero_id == str(user.id),
            CajaSesion.estado == EstadoSesion.ABIERTA
        )
        if not caja:
             raise HTTPException(
                 status_code=400, 
                 detail="No tienes una sesión de caja abierta. Debes abrir caja para recibir pagos."
             )

        # 2. Total Abono Amount
        monto_total_abono = sum(Decimal(str(p.monto)) for p in request.pagos)
        if monto_total_abono <= Decimal("0"):
            raise HTTPException(status_code=400, detail="El monto del abono debe ser mayor a 0.")
            
        if monto_total_abono > Decimal(str(cuenta.saldo_total)) + Decimal("0.01"):
            raise HTTPException(status_code=400, detail="El monto de abono no puede exceder la deuda total de la cuenta.")
            
        # 3. Find Debts to apply
        if request.deuda_id:
            deuda_especifica = await Deuda.get(request.deuda_id)
            if not deuda_especifica or str(deuda_especifica.cuenta_id) != cuenta_id:
                raise HTTPException(status_code=404, detail="Deuda específica no encontrada en esta cuenta.")
            if deuda_especifica.estado == EstadoDeuda.PAGADA:
                raise HTTPException(status_code=400, detail="Esta deuda ya está pagada.")
            if monto_total_abono > Decimal(str(deuda_especifica.saldo_pendiente)) + Decimal("0.01"):
                 raise HTTPException(status_code=400, detail="El abono excede el monto pendiente de esta deuda específica.")
                 
            deudas_a_cobrar = [deuda_especifica]
        else:
            # Pagar las más antiguas primero (FIFO)
            deudas_a_cobrar = await Deuda.find(
                Deuda.cuenta_id == cuenta_id,
                Deuda.estado != EstadoDeuda.PAGADA,
                Deuda.estado != EstadoDeuda.ANULADA
            ).sort(Deuda.fecha_emision).to_list()
            
        if not deudas_a_cobrar:
            raise HTTPException(status_code=400, detail="No hay deudas pendientes en esta cuenta.")

        saldo_restante_abono = monto_total_abono
        deudas_afectadas_ids = []
        
        # 4. Apply to Debts (FIFO)
        for deuda in deudas_a_cobrar:
            if saldo_restante_abono <= Decimal("0"):
                break
                
            deuda_saldo = Decimal(str(deuda.saldo_pendiente))
            monto_aplicado = min(saldo_restante_abono, deuda_saldo)
            
            deuda_saldo_nuevo = deuda_saldo - monto_aplicado
            deuda.saldo_pendiente = DecimalMoney(str(deuda_saldo_nuevo))
            
            if deuda_saldo_nuevo <= Decimal("0.01"):
                deuda.estado = EstadoDeuda.PAGADA
            else:
                deuda.estado = EstadoDeuda.PARCIAL
                
            deuda.updated_at = datetime.utcnow()
            await deuda.save()
            
            # Removed backward-compatible logic of appending EFECTIVO payments back to the Sale.
            # Sales with CREDITO will remain purely as CREDITO, preventing double entry accounting issues.
            
            # Optionally just mark Sale state to update payment trackers if totally paid.
            sale = await Sale.get(deuda.sale_id)
            if sale:
                if deuda.estado == EstadoDeuda.PAGADA:
                    if sale.estado_pago != EstadoPago.PAGADO:
                        sale.estado_pago = EstadoPago.PAGADO
                        await sale.save()
                elif deuda.estado == EstadoDeuda.PARCIAL:
                    if sale.estado_pago != EstadoPago.PARCIAL:
                        sale.estado_pago = EstadoPago.PARCIAL
                        await sale.save()
            
            deudas_afectadas_ids.append(str(deuda.id))
            saldo_restante_abono -= monto_aplicado
            
        # 5. Update CuentaCredito Total
        cuenta.saldo_total = DecimalMoney(str(Decimal(str(cuenta.saldo_total)) - monto_total_abono))
        if Decimal(str(cuenta.saldo_total)) <= Decimal("0.01"):
            cuenta.estado_cuenta = EstadoCuenta.AL_DIA
        # else remains MOROSO or AL_DIA based on other factors
        cuenta.updated_at = datetime.utcnow()
        await cuenta.save()
        
        # 6. Create Transaction
        pago_infos = []
        for p in request.pagos:
            pinfo = PagoCreditoItemInfo(
                metodo=p.metodo,
                monto=DecimalMoney(str(p.monto)),
                banco=p.banco,
                referencia=p.referencia
            )
            pago_infos.append(pinfo)
            
            # 7. Create CajaMovimiento for each real payment
            subtipo = SubtipoMovimiento.INGRESO_EFECTIVO if p.metodo == "EFECTIVO" else SubtipoMovimiento.INGRESO_QR
            if p.metodo == "TARJETA": subtipo = SubtipoMovimiento.INGRESO_BANCO
            if p.metodo == "TRANSFERENCIA": subtipo = SubtipoMovimiento.INGRESO_BANCO
            
            await CajaMovimiento(
                tenant_id=cuenta.tenant_id,
                sucursal_id=str(caja.sucursal_id), # same as cashbox session
                sesion_id=str(caja.id),
                cajero_id=str(user.id),
                cajero_name=user.full_name or user.username,
                subtipo=subtipo,
                tipo="INGRESO",
                monto=DecimalMoney(str(p.monto)),
                descripcion=f"Abono a Crédito Cuenta #{str(cuenta.id)[-6:].upper()}" + (f" - Ref {p.referencia}" if p.referencia else "")
            ).insert()

        transaccion = TransaccionCredito(
            tenant_id=cuenta.tenant_id,
            sucursal_id=str(caja.sucursal_id),
            cuenta_id=str(cuenta.id),
            cliente_id=cuenta.cliente_id,
            tipo="ABONO",
            monto=DecimalMoney(str(monto_total_abono)),
            pagos=pago_infos,
            deudas_afectadas=deudas_afectadas_ids,
            cajero_id=str(user.id),
            cajero_nombre=user.full_name or user.username,
            sesion_caja_id=str(caja.id),
            notas=request.notas
        )
        await transaccion.insert()
        
        return cuenta
        
    @staticmethod
    async def anular_abono(transaccion_id: str, user: User, motivo: str = "Error en digitación") -> CuentaCredito:
        """
        Reverte un abono hecho a una Deuda.
        1. Localizar la transacción.
        2. Reverit la baja de cuentas en la Deuda.
        3. Restaurar saldo prestado en Cliente.
        4. Crear Movimiento EGRESO restando en Caja para justificar que se sacó lo cobrado de mentira.
        5. Marcar transacción anulada.
        """
        transaccion = await TransaccionCredito.get(transaccion_id)
        if not transaccion or transaccion.tenant_id != (user.tenant_id or "default"):
            raise HTTPException(status_code=404, detail="Transacción no encontrada.")
            
        if transaccion.tipo != "ABONO":
            raise HTTPException(status_code=400, detail="Solo se pueden anular transacciones de tipo ABONO.")
            
        if transaccion.anulada:
            raise HTTPException(status_code=400, detail="Esta transacción ya fue anulada previamente.")
            
        # 1. Revisar Caja Abierta
        caja = await CajaSesion.find_one(
            CajaSesion.tenant_id == transaccion.tenant_id,
            CajaSesion.cajero_id == str(user.id),
            CajaSesion.estado == EstadoSesion.ABIERTA
        )
        if not caja:
            raise HTTPException(
                status_code=400, 
                detail="Debes tener una sesión de caja abierta para registrar el egreso reverso de este abono."
            )
            
        cuenta = await CuentaCredito.get(transaccion.cuenta_id)
        if not cuenta:
            raise HTTPException(status_code=404, detail="La cuenta de crédito asociada no existe.")
            
        # 2. Restaurar Deudas afectas: Asumimos FIFO distribuido
        monto_a_restaurar = Decimal(str(transaccion.monto))
        
        # We need to distribute this back up precisely as it went down. 
        # For simplicity, we just add normally to affected deudas if we know how much they took 
        # But we don't have explicit breakdown per deuda in transaccion, we only have deudas_afectadas array.
        # Simplest approach for rollback is to simply get those deudas, and add back until monto_a_restaurar runs out.
        # (It will reverse the FIFO exactly because we loop them over again).
        deudas = []
        for d_id in transaccion.deudas_afectadas:
            d = await Deuda.get(d_id)
            if d: deudas.append(d)
                
        # Sort newest to oldest so we reverse the "last paid" first just in case
        deudas = sorted(deudas, key=lambda dx: dx.fecha_emision, reverse=True)
        
        for deuda in deudas:
            if monto_a_restaurar <= Decimal("0"):
                break
                
            deuda_monto_original = Decimal(str(deuda.monto_original))
            deuda_saldo_actual = Decimal(str(deuda.saldo_pendiente))
            
            espacio_en_deuda = deuda_monto_original - deuda_saldo_actual
            if espacio_en_deuda > Decimal("0"):
                monto_restaurable = min(espacio_en_deuda, monto_a_restaurar)
                
                deuda.saldo_pendiente = DecimalMoney(str(deuda_saldo_actual + monto_restaurable))
                if Decimal(str(deuda.saldo_pendiente)) >= deuda_monto_original:
                    deuda.estado = EstadoDeuda.PENDIENTE
                else:
                    deuda.estado = EstadoDeuda.PARCIAL
                
                deuda.updated_at = datetime.utcnow()
                await deuda.save()
                
                # Check sale to revert status
                sale = await Sale.get(deuda.sale_id)
                if sale:
                    if deuda.estado == EstadoDeuda.PENDIENTE:
                        sale.estado_pago = EstadoPago.PENDIENTE
                    else:
                        sale.estado_pago = EstadoPago.PARCIAL
                    await sale.save()
                    
                monto_a_restaurar -= monto_restaurable

        # 3. Restaurar sumatoria a favor del moroso (Saldo total cuenta)
        cuenta.saldo_total = DecimalMoney(str(Decimal(str(cuenta.saldo_total)) + Decimal(str(transaccion.monto))))
        if Decimal(str(cuenta.saldo_total)) > Decimal("0.01"):
            # Should technically check if any debt is past due, but keeping it simple
            cuenta.estado_cuenta = EstadoCuenta.MOROSO
        cuenta.updated_at = datetime.utcnow()
        await cuenta.save()
        
        # 4. Generar Movimiento EGRESO revertiendo la balanza en caja
        if transaccion.pagos:
            for p in transaccion.pagos:
                subtipo = SubtipoMovimiento.EGRESO_OTROS
                if p.metodo == "EFECTIVO": subtipo = SubtipoMovimiento.EGRESO_OTROS # Using other to signify refund
                
                await CajaMovimiento(
                    tenant_id=cuenta.tenant_id,
                    sucursal_id=str(caja.sucursal_id),
                    sesion_id=str(caja.id),
                    cajero_id=str(user.id),
                    cajero_name=user.full_name or user.username,
                    subtipo=subtipo,
                    tipo="EGRESO",
                    monto=DecimalMoney(str(p.monto)),
                    descripcion=f"ANULACIÓN de Abono Crédito Cuenta #{str(cuenta.id)[-6:].upper()} ({motivo})"
                ).insert()
        else:
             # Fallback if old code
             await CajaMovimiento(
                tenant_id=cuenta.tenant_id,
                sucursal_id=str(caja.sucursal_id),
                sesion_id=str(caja.id),
                cajero_id=str(user.id),
                cajero_name=user.full_name or user.username,
                subtipo=SubtipoMovimiento.EGRESO_OTROS,
                tipo="EGRESO",
                monto=transaccion.monto,
                descripcion=f"ANULACIÓN de Abono Crédito Cuenta #{str(cuenta.id)[-6:].upper()} ({motivo})"
            ).insert()

        # 5. Marcar anulación
        transaccion.anulada = True
        transaccion.anulada_por = user.full_name or user.username
        await transaccion.save()
        
        return cuenta
