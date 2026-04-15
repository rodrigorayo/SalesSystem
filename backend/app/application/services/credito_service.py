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
            cuenta = CuentaCredito(
                tenant_id=sale.tenant_id,
                cliente_id=cliente_id,
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
            
            # Sync with original Sale document to ensure backwards compatibility views in general sales
            sale = await Sale.get(deuda.sale_id)
            if sale:
                # Add this portion to sale.pagos (simplified as CREDITO payment is paid)
                # Since the abono might be mixed, we append a generalized "CREDITO_ABONADO" or distribute
                # We'll distribute the mixed payments proportionately or just append them directly if it's 1-to-1.
                # Simplest path: append the exact user `pagos` to the sale if it's applying primarily to this sale.
                import uuid
                # For backwards compatibility with standard Sales Page, reflect it
                for p in request.pagos:
                    # We approximate if it's a multi-debt, but it's simpler to append a flat proportion
                    portion_ratio = monto_aplicado / monto_total_abono
                    monto_porcion = Decimal(str(p.monto)) * portion_ratio
                    sale.pagos.append(PagoItem(
                        metodo=p.metodo,
                        monto=DecimalMoney(str(monto_porcion)),
                        fecha=datetime.utcnow()
                    ))
                    
                total_sale_pagado = sum(Decimal(str(px.monto)) for px in sale.pagos if px.metodo != "CREDITO")
                # Wait, original sale contains "CREDITO" as payment method representing the debt.
                # By appending EFECTIVO/QR now, the total payments might exceed sale.total (CREDITO + EFECTIVO).
                # To fix: standard Taboada logic allowed CREDITO as a placeholder. We should remove or keep? 
                # Let's adjust Sale.estado_pago based on Deuda.estado
                if deuda.estado == EstadoDeuda.PAGADA:
                    sale.estado_pago = EstadoPago.PAGADO
                elif deuda.estado == EstadoDeuda.PARCIAL:
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
