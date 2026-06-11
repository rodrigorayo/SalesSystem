from app.infrastructure.db import get_client
import math
import logging
import asyncio
from datetime import datetime
from typing import List, Optional
from fastapi import HTTPException
from pymongo import ReturnDocument
from decimal import Decimal

from app.domain.models.sale import Sale, SaleItem, PagoItem, ClienteInfo, QRInfo, EstadoPago
from app.domain.models.sale_item import SaleItem as SaleItemAnalytics
from app.domain.models.product import Product
from app.domain.models.inventario import Inventario, InventoryLog, TipoMovimiento
from app.domain.models.caja import CajaMovimiento, CajaSesion, EstadoSesion, SubtipoMovimiento
from app.domain.models.cliente import Cliente
from app.domain.models.sucursal import Sucursal
from app.domain.models.user import User, UserRole
from app.domain.schemas.sale import SaleCreate
from app.utils.pricing import resolver_precio
from app.domain.models.base import DecimalMoney
from app.utils.errors import VentasErrors, handle_service_error, retry_on_write_conflict

logger = logging.getLogger("SalesService")

class SalesService:
    @staticmethod
    async def create_sale(sale_in: SaleCreate, current_user: User) -> Sale:
        if current_user.role == UserRole.FACTURADOR:
            raise HTTPException(status_code=403, detail="Un facturador no tiene permisos para crear ventas")
        tenant_id = current_user.tenant_id or "default"
        sucursal_id = current_user.sucursal_id or sale_in.sucursal_id or "CENTRAL"
        
        client = get_client()

        async def _run_transaction() -> Sale:
            async with await client.start_session() as session:
                async with session.start_transaction():
                    sale_items: List[SaleItem] = []
                    computed_total = Decimal("0.0")

                    for item in sale_in.items:
                        product = await Product.get(item.producto_id, session=session)
                        if not product or product.tenant_id != tenant_id:
                            raise HTTPException(status_code=404, detail=f"Producto {item.producto_id} no encontrado")

                        updated_inv = await Inventario.get_pymongo_collection().find_one_and_update(
                            {
                                "tenant_id": tenant_id,
                                "sucursal_id": sucursal_id,
                                "producto_id": item.producto_id,
                                "cantidad": {"$gte": item.cantidad}
                            },
                            {
                                "$inc": {"cantidad": -item.cantidad}
                            },
                            return_document=ReturnDocument.AFTER,
                            session=session.client_session if hasattr(session, "client_session") else session
                        )

                        if not updated_inv:
                            inv_check = await Inventario.find_one(
                                Inventario.tenant_id == tenant_id,
                                Inventario.sucursal_id == sucursal_id,
                                Inventario.producto_id == item.producto_id,
                                session=session
                            )
                            available = inv_check.cantidad if inv_check else 0
                            raise HTTPException(
                                status_code=400,
                                detail=f"Stock insuficiente para '{product.descripcion}'. Disponible: {available}, solicitado: {item.cantidad}",
                            )

                        unit_price_base = DecimalMoney(item.precio_unitario)
                        if unit_price_base == Decimal("0"):
                            if updated_inv and updated_inv.get("precio_sucursal") is not None:
                                unit_price_base = updated_inv["precio_sucursal"].to_decimal() if type(updated_inv["precio_sucursal"]).__name__ == "Decimal128" else DecimalMoney(updated_inv["precio_sucursal"])
                            else:
                                unit_price_base = product.precio_venta

                        unit_price = DecimalMoney(await resolver_precio(
                            producto_id=str(product.id),
                            precio_base=float(unit_price_base),
                            cliente_id=sale_in.cliente_id,
                            cantidad=item.cantidad,
                            tenant_id=tenant_id
                        ))

                        desc = DecimalMoney(item.descuento_unitario)
                        final_unit_price = max(Decimal("0.0"), unit_price - desc)
                        subtotal = final_unit_price * Decimal(item.cantidad)
                        computed_total += subtotal

                        sale_items.append(SaleItem(
                            producto_id=str(product.id),
                            descripcion=product.descripcion,
                            cantidad=item.cantidad,
                            precio_unitario=unit_price,
                            costo_unitario=product.costo_producto,
                            descuento_unitario=desc,
                            subtotal=subtotal,
                        ))

                        await InventoryLog(
                            tenant_id=tenant_id,
                            sucursal_id=sucursal_id,
                            producto_id=item.producto_id,
                            descripcion=product.descripcion,
                            tipo_movimiento=TipoMovimiento.VENTA,
                            cantidad_movida=-item.cantidad,
                            stock_resultante=updated_inv["cantidad"],
                            costo_unitario_momento=product.costo_producto,
                            precio_venta_momento=unit_price,
                            usuario_id=str(current_user.id),
                            usuario_nombre=current_user.full_name or current_user.username,
                            notas="Salida por Venta POS",
                            referencia_id="PENDING"
                        ).create(session=session)

                        await SaleItemAnalytics(
                            tenant_id=tenant_id,
                            sucursal_id=sucursal_id,
                            sale_id="PENDING",
                            sale_date=datetime.utcnow(),
                            producto_id=str(product.id),
                            descripcion=product.descripcion,
                            cantidad=item.cantidad,
                            precio_unitario=unit_price,
                            costo_unitario=product.costo_producto,
                            descuento_unitario=desc,
                            subtotal=subtotal
                        ).create(session=session)

                    if sale_in.descuento:
                        val = DecimalMoney(sale_in.descuento.valor)
                        if sale_in.descuento.tipo == 'MONTO':
                            computed_total -= val
                        elif sale_in.descuento.tipo == 'PORCENTAJE':
                            computed_total -= (computed_total * val / Decimal("100"))
                        computed_total = max(Decimal("0.0"), computed_total)

                    # Se eliminó el redondeo comercial a moneda física para permitir centavos exactos
                    computed_total = Decimal(str(computed_total)).quantize(Decimal("0.00"), rounding="ROUND_HALF_UP")

                    has_credit = any(p.metodo == "CREDITO" for p in sale_in.pagos)
                    if has_credit:
                        if not sale_in.cliente_id and not (sale_in.cliente and sale_in.cliente.razon_social):
                            raise HTTPException(status_code=400, detail="Ventas a crédito requieren un cliente registrado")
                        
                        # Validar estado crediticio si el cliente ya existe
                        if sale_in.cliente_id:
                            from app.domain.models.credito import CuentaCredito, EstadoCuenta
                            cuenta_existente = await CuentaCredito.find_one(
                                CuentaCredito.tenant_id == tenant_id,
                                CuentaCredito.cliente_id == sale_in.cliente_id,
                                session=session
                            )
                            if cuenta_existente:
                                if cuenta_existente.estado_cuenta == EstadoCuenta.MOROSO:
                                    logger.warning(f"Venta a crédito rechazada: Cliente {sale_in.cliente_id} está MOROSO.")
                                    raise HTTPException(status_code=400, detail="Este cliente tiene estado MOROSO en su cuenta y no puede comprar a crédito hasta regularizar sus deudas.")
                                
                                if cuenta_existente.limite_credito is not None:
                                    # Cuanto adeuda ahorita + Cuanto endeudará en esta venta (total de la venta menos los pagos parciales hechos)
                                    actual_pagos_validar = [p.monto for p in sale_in.pagos if p.metodo != "CREDITO"]
                                    pagado_ahora = sum((p for p in actual_pagos_validar), Decimal("0"))
                                    nueva_deuda = computed_total - pagado_ahora
                                    if Decimal(str(cuenta_existente.saldo_total)) + nueva_deuda > Decimal(str(cuenta_existente.limite_credito)):
                                        raise HTTPException(
                                            status_code=400, 
                                            detail=f"Esta venta excede el límite de crédito del cliente (Límite: Bs. {cuenta_existente.limite_credito}, Nuevo total proyectado: Bs. {Decimal(str(cuenta_existente.saldo_total)) + nueva_deuda})."
                                        )

                    actual_pagos = [PagoItem(metodo=p.metodo, monto=DecimalMoney(p.monto)) for p in sale_in.pagos if p.metodo != "CREDITO"]
                    total_pagado = sum((p.monto for p in actual_pagos), Decimal("0"))

                    if has_credit:
                        if total_pagado <= Decimal("0"):
                            estado_pago = EstadoPago.PENDIENTE
                        elif total_pagado < computed_total:
                            estado_pago = EstadoPago.PARCIAL
                        else:
                            estado_pago = EstadoPago.PAGADO
                    else:
                        estado_pago = EstadoPago.PAGADO

                    cliente_snap = ClienteInfo(**sale_in.cliente.model_dump()) if sale_in.cliente else None
                    has_qr = any(p.metodo == "QR" for p in actual_pagos)
                    qr_init = QRInfo() if has_qr else None

                    sale = Sale(
                        tenant_id=tenant_id,
                        sucursal_id=sucursal_id,
                        items=sale_items,
                        total=computed_total,
                        pagos=actual_pagos,
                        estado_pago=estado_pago,
                        descuento=sale_in.descuento,
                        cliente_id=sale_in.cliente_id,
                        cliente=cliente_snap,
                        qr_info=qr_init,
                        cashier_id=str(current_user.id),
                        cashier_name=current_user.full_name or current_user.username,
                        vendedor_id=sale_in.vendedor_id,
                        vendedor_name=sale_in.vendedor_name,
                    )
                    await sale.create(session=session)

                    await SaleItemAnalytics.find(
                        SaleItemAnalytics.tenant_id == tenant_id,
                        SaleItemAnalytics.sale_id == "PENDING",
                        session=session
                    ).update({"$set": {"sale_id": str(sale.id)}}, session=session)

                    await InventoryLog.find(
                        InventoryLog.tenant_id == tenant_id,
                        InventoryLog.referencia_id == "PENDING",
                        session=session
                    ).update({"$set": {"referencia_id": str(sale.id)}}, session=session)

                    # --- Resolución de cliente_id para créditos ---
                    # Si la venta es a crédito y no tiene cliente_id formal,
                    # creamos el cliente desde el snapshot de nombre/teléfono.
                    if sale.estado_pago in [EstadoPago.PENDIENTE, EstadoPago.PARCIAL] and not sale.cliente_id:
                        if sale.cliente and (sale.cliente.razon_social or sale.cliente.telefono):
                            nombre = (sale.cliente.razon_social or "CONSUMIDOR FINAL").strip().upper()
                            telf = (sale.cliente.telefono or "").strip() or None
                            # Buscar si ya existe
                            cliente_existente = await Cliente.find_one({
                                "tenant_id": sale.tenant_id,
                                "nombre": nombre,
                                "telefono": telf
                            }, session=session)
                            if not cliente_existente:
                                cliente_existente = Cliente(
                                    tenant_id=sale.tenant_id,
                                    nombre=nombre,
                                    telefono=telf,
                                    nit_ci=sale.cliente.nit,
                                    email=sale.cliente.email
                                )
                                await cliente_existente.insert(session=session)
                            # Vincular el cliente a la venta
                            sale.cliente_id = str(cliente_existente.id)
                            await sale.save(session=session)

                    if sale.cliente_id:
                        from beanie.operators import Inc, Set
                        await Cliente.find_one(Cliente.id == sale.cliente_id, session=session).update(
                            Inc({Cliente.total_compras: sale.total}),
                            Inc({Cliente.cantidad_compras: 1}),
                            Set({Cliente.ultima_compra_at: sale.created_at}),
                            session=session
                        )
                        
                        if sale.estado_pago in [EstadoPago.PENDIENTE, EstadoPago.PARCIAL]:
                            from app.application.services.credito_service import CreditoService
                            monto_deuda = computed_total - total_pagado
                            await CreditoService.registrar_deuda_desde_venta(sale, monto_deuda, sale.cliente_id, session=session)

                    _SUBTIPO_MAP = {
                        "EFECTIVO": SubtipoMovimiento.VENTA_EFECTIVO,
                        "QR":       SubtipoMovimiento.VENTA_QR,
                        "TARJETA":  SubtipoMovimiento.VENTA_TARJETA,
                    }

                    caja_sesion = await CajaSesion.find_one(
                        CajaSesion.tenant_id   == tenant_id,
                        CajaSesion.sucursal_id == sucursal_id,
                        CajaSesion.cajero_id   == str(current_user.id),
                        CajaSesion.estado      == EstadoSesion.ABIERTA,
                        session=session
                    )

                    cajero_id   = str(current_user.id)
                    cajero_name = current_user.full_name or current_user.username
                    sale_id_str = str(sale.id)

                    if caja_sesion:
                        _total_pagado = Decimal("0")
                        for pago in actual_pagos:
                            metodo  = str(pago.metodo).upper()
                            monto_p = pago.monto
                            _total_pagado += monto_p
                            subtipo = _SUBTIPO_MAP.get(metodo, SubtipoMovimiento.VENTA_EFECTIVO)
                            label = {"EFECTIVO": "Efectivo", "QR": "QR", "TARJETA": "Tarjeta"}.get(metodo, metodo)

                            await CajaMovimiento(
                                tenant_id   = tenant_id,
                                sucursal_id = sucursal_id,
                                sesion_id   = str(caja_sesion.id),
                                cajero_id   = cajero_id,
                                cajero_name = cajero_name,
                                subtipo     = subtipo,
                                tipo        = "INGRESO",
                                monto       = monto_p,
                                descripcion = f"Venta #{sale_id_str[-6:]} — {label}",
                                sale_id     = sale_id_str,
                            ).create(session=session)

                        cambio = _total_pagado - computed_total
                        if cambio > Decimal("0.005"):
                            await CajaMovimiento(
                                tenant_id   = tenant_id,
                                sucursal_id = sucursal_id,
                                sesion_id   = str(caja_sesion.id),
                                cajero_id   = cajero_id,
                                cajero_name = cajero_name,
                                subtipo     = SubtipoMovimiento.CAMBIO,
                                tipo        = "EGRESO",
                                monto       = cambio,
                                descripcion = f"Venta #{sale_id_str[-6:]} — Cambio entregado",
                                sale_id     = sale_id_str,
                            ).create(session=session)

                    return sale

        # ── Ejecutar con reintento automático ante WriteConflict ──────────────
        sale = await retry_on_write_conflict(_run_transaction)

        # --- Sincronización automática en segundo plano con ventas_historicas_crudas (BI) ---
        async def _sync_background():
            try:
                sucursal_obj = await Sucursal.get(sale.sucursal_id)
                sucursal_name = sucursal_obj.nombre if sucursal_obj else sale.sucursal_id
                
                # Normalizar nombre sucursal según estándares de analítica
                name_lower = sucursal_name.lower()
                if 'heroinas' in name_lower or 'heroína' in name_lower or 'hero' in name_lower:
                    sucursal_name_mapped = 'Heroínas'
                elif 'recoleta' in name_lower:
                    sucursal_name_mapped = 'Recoleta'
                elif 'calacoto' in name_lower:
                    sucursal_name_mapped = 'Calacoto'
                else:
                    sucursal_name_mapped = sucursal_name
                    
                db_raw = get_client().salessystem
                new_historical_records = []
                for item in sale.items:
                    new_historical_records.append({
                        "fecha_transaccion": sale.created_at,
                        "nombre_producto": item.descripcion.upper().strip(),
                        "cantidad_vendida": float(item.cantidad),
                        "sucursal": sucursal_name_mapped,
                        "monto_total_bs": float(item.subtotal),
                        "tenant_id": sale.tenant_id,
                        "original_sale_id": sale.id
                    })
                
                if new_historical_records:
                    await db_raw.ventas_historicas_crudas.insert_many(new_historical_records)
            except Exception as e:
                logger.error(f"Error en segundo plano sincronizando venta a ventas_historicas_crudas: {e}", exc_info=True)

        asyncio.create_task(_sync_background())

        return sale


    @staticmethod
    async def anular_sale(
        sale_id: str,
        current_user: User,
        motivo: str,
        notas: Optional[str] = None,
        metodo_pago_correcto: Optional[str] = None,
        afectar_caja: bool = True,
        caja_sesion_id: Optional[str] = None,
    ) -> Sale:
        """
        Anula una venta con lógica inteligente según el motivo:

        - ERROR_COBRO: El método de pago fue registrado incorrectamente.
          Se anulan los movimientos del método INCORRECTO y (opcionalmente) se
          registra un ingreso con el método CORRECTO. Esto no genera desajuste.
          
        - DEVOLUCION_CLIENTE / PRODUCTO_DEFECTUOSO: El dinero sí ingresó.
          Se invierten los movimientos reales (egreso del método real).
          
        - VENTA_DUPLICADA: La venta se cobró dos veces. Se invierten los
          movimientos de caja de la venta duplicada.
          
        - OTRO: Comportamiento estándar (inversión de movimientos).
        """
        if current_user.role == UserRole.FACTURADOR:
            raise HTTPException(status_code=403, detail="Un facturador no tiene permisos para anular ventas")
        tenant_id = current_user.tenant_id or "default"
        client = get_client()

        # Validar que si es ERROR_COBRO, se debe especificar el método correcto
        if motivo == "ERROR_COBRO" and not metodo_pago_correcto:
            raise HTTPException(
                status_code=400,
                detail="Para anular por 'Error de cobro' debes especificar cuál fue el método de pago real."
            )

        sale_obj = None
        try:
            async with await client.start_session() as session:
                async with session.start_transaction():
                    sale = await Sale.get(sale_id, session=session)
                    if not sale or sale.tenant_id != tenant_id:
                        raise HTTPException(status_code=404, detail=VentasErrors.VENTA_NO_ENCONTRADA)

                    if sale.anulada:
                        raise HTTPException(status_code=400, detail=VentasErrors.VENTA_YA_ANULADA)

                    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.CAJERO]:
                        if sale.sucursal_id != current_user.sucursal_id:
                            raise HTTPException(status_code=403, detail="Solo puedes anular ventas de tu propia sucursal")
                            
                    if current_user.role == UserRole.CAJERO:
                        if sale.cashier_id != str(current_user.id):
                            raise HTTPException(status_code=403, detail="Los cajeros solo pueden anular sus propias ventas")
                        hours_diff = (datetime.utcnow() - sale.created_at).total_seconds() / 3600
                        if hours_diff > 24:
                            raise HTTPException(status_code=403, detail="Un cajero no puede anular una venta pasada de 24 horas.")

                    sucursal_id = sale.sucursal_id

                    # ── 1. Revertir stock (siempre) ──────────────────────────────
                    for item in sale.items:
                        updated_inv = await Inventario.get_pymongo_collection().find_one_and_update(
                            {
                                "tenant_id": tenant_id,
                                "sucursal_id": sucursal_id,
                                "producto_id": item.producto_id,
                            },
                            {"$inc": {"cantidad": item.cantidad}},
                            return_document=ReturnDocument.AFTER,
                            session=session.client_session if hasattr(session, "client_session") else session
                        )
                        if updated_inv:
                            await InventoryLog(
                                tenant_id=tenant_id,
                                sucursal_id=sucursal_id,
                                producto_id=item.producto_id,
                                descripcion=item.descripcion,
                                tipo_movimiento=TipoMovimiento.ENTRADA_MANUAL,
                                cantidad_movida=item.cantidad,
                                stock_resultante=updated_inv["cantidad"],
                                costo_unitario_momento=item.costo_unitario,
                                precio_venta_momento=item.precio_unitario,
                                usuario_id=str(current_user.id),
                                usuario_nombre=current_user.full_name or current_user.username,
                                notas=f"Anulación de Venta #{str(sale.id)[-6:]} — Motivo: {motivo}",
                                referencia_id=str(sale.id)
                            ).create(session=session)

                    # ── 1.5 Revertir deuda de crédito (si la venta fue a crédito) ──
                    has_credit_payment = any(p.metodo == "CREDITO" for p in sale.pagos)
                    if has_credit_payment:
                        from app.domain.models.credito import Deuda, EstadoDeuda, CuentaCredito, TransaccionCredito
                        deuda = await Deuda.find_one(Deuda.sale_id == str(sale.id), session=session)
                        if deuda and deuda.estado != EstadoDeuda.ANULADA:
                            cuenta = await CuentaCredito.get(deuda.cuenta_id, session=session)
                            if cuenta:
                                from decimal import Decimal
                                nuevo_saldo = max(Decimal("0"), Decimal(str(cuenta.saldo_total)) - Decimal(str(deuda.saldo_pendiente)))
                                cuenta.saldo_total = DecimalMoney(str(nuevo_saldo))
                                cuenta.updated_at = datetime.utcnow()
                                await cuenta.save(session=session)

                            # Registrar una transacción de crédito para reflejar la anulación
                            transaccion = TransaccionCredito(
                                tenant_id=sale.tenant_id,
                                sucursal_id=sale.sucursal_id,
                                cuenta_id=deuda.cuenta_id,
                                cliente_id=deuda.cliente_id,
                                tipo="ABONO",
                                monto=deuda.saldo_pendiente,  # Se abona el saldo pendiente restante para cancelarlo
                                sale_id=str(sale.id),
                                cajero_id=str(current_user.id),
                                cajero_nombre=current_user.full_name or current_user.username,
                                notas=f"Reverso por Anulación de Venta #{str(sale.id)[-6:].upper()} — Motivo: {motivo}"
                            )
                            await transaccion.insert(session=session)

                            deuda.saldo_pendiente = DecimalMoney("0")
                            deuda.estado = EstadoDeuda.ANULADA
                            deuda.updated_at = datetime.utcnow()
                            await deuda.save(session=session)

                    # ── 2. Ajuste de caja según motivo ───────────────────────────
                    if afectar_caja:
                        if caja_sesion_id:
                            # Buscar la sesión de caja específica indicada por el administrador
                            caja_sesion = await CajaSesion.get(caja_sesion_id, session=session)
                            if caja_sesion and caja_sesion.estado != EstadoSesion.ABIERTA:
                                caja_sesion = None # No usar si está cerrada
                        else:
                            # Comportamiento normal: buscar la caja del usuario actual
                            caja_sesion = await CajaSesion.find_one(
                                CajaSesion.tenant_id   == tenant_id,
                                CajaSesion.sucursal_id == sucursal_id,
                                CajaSesion.cajero_id   == str(current_user.id),
                                CajaSesion.estado      == EstadoSesion.ABIERTA,
                                session=session
                            )

                        if not caja_sesion:
                            if len(sale.pagos) > 0 and sum(p.monto for p in sale.pagos) > 0:
                                raise HTTPException(
                                    status_code=400,
                                    detail="No puedes anular una venta y afectar caja sin tener una sesión de caja ABIERTA. Abre la caja primero o elige 'No afectar caja'."
                                )
                        else:
                            # Obtener los movimientos originales de esta venta
                            movs_originales = await CajaMovimiento.find(
                                CajaMovimiento.tenant_id == tenant_id,
                                CajaMovimiento.sale_id == str(sale.id),
                                session=session
                            ).to_list()

                            ticket_ref = f"#{str(sale.id)[-6:].upper()}"
                            cajero_info = current_user.full_name or current_user.username

                            if motivo == "ERROR_COBRO":
                                # ── FLUJO ESPECIAL: Corrección de método de pago ──
                                total_venta = float(sum(p.monto for p in sale.pagos))
                                
                                # Paso A: Revertir movimientos del método incorrecto
                                for mov in movs_originales:
                                    inverse_type = "EGRESO" if mov.tipo == "INGRESO" else "INGRESO"
                                    await CajaMovimiento(
                                        tenant_id   = tenant_id,
                                        sucursal_id = sucursal_id,
                                        sesion_id   = str(caja_sesion.id),
                                        cajero_id   = str(current_user.id),
                                        cajero_name = cajero_info,
                                        subtipo     = mov.subtipo,
                                        tipo        = inverse_type,
                                        monto       = mov.monto,
                                        descripcion = f"Corrección Ticket {ticket_ref}: Reversa método incorrecto ({mov.subtipo})",
                                        sale_id     = str(sale.id),
                                    ).create(session=session)

                                # Paso B: Registrar con el método CORRECTO
                                subtipo_correcto = SubtipoMovimiento.VENTA_EFECTIVO
                                if metodo_pago_correcto == "QR":
                                    subtipo_correcto = SubtipoMovimiento.VENTA_QR
                                elif metodo_pago_correcto == "TARJETA":
                                    subtipo_correcto = SubtipoMovimiento.VENTA_TARJETA
                                elif metodo_pago_correcto == "TRANSFERENCIA":
                                    subtipo_correcto = SubtipoMovimiento.VENTA_TRANSFERENCIA

                                await CajaMovimiento(
                                    tenant_id   = tenant_id,
                                    sucursal_id = sucursal_id,
                                    sesion_id   = str(caja_sesion.id),
                                    cajero_id   = str(current_user.id),
                                    cajero_name = cajero_info,
                                    subtipo     = subtipo_correcto,
                                    tipo        = "INGRESO",
                                    monto       = total_venta,
                                    descripcion = f"Corrección Ticket {ticket_ref}: Ingreso real vía {metodo_pago_correcto} — {notas or 'Error de método de pago'}",
                                    sale_id     = str(sale.id),
                                ).create(session=session)

                                logger.info(
                                    f"[AnularSale] ERROR_COBRO corregido en venta {sale_id}: "
                                    f"método incorrecto revertido, ingreso correcto ({metodo_pago_correcto}) registrado."
                                )

                            elif motivo == "VENTA_DUPLICADA":
                                for mov in movs_originales:
                                    inverse_type = "EGRESO" if mov.tipo == "INGRESO" else "INGRESO"
                                    await CajaMovimiento(
                                        tenant_id   = tenant_id,
                                        sucursal_id = sucursal_id,
                                        sesion_id   = str(caja_sesion.id),
                                        cajero_id   = str(current_user.id),
                                        cajero_name = cajero_info,
                                        subtipo     = mov.subtipo,
                                        tipo        = inverse_type,
                                        monto       = mov.monto,
                                        descripcion = f"Venta Duplicada — Reversa Ticket {ticket_ref} ({mov.subtipo})",
                                        sale_id     = str(sale.id),
                                    ).create(session=session)

                            else:
                                for mov in movs_originales:
                                    inverse_type = "EGRESO" if mov.tipo == "INGRESO" else "INGRESO"
                                    motivo_label = {
                                        "DEVOLUCION_CLIENTE": "Devolución de Cliente",
                                        "PRODUCTO_DEFECTUOSO": "Prod. Defectuoso",
                                        "OTRO": "Anulación"
                                    }.get(motivo, motivo)
                                    await CajaMovimiento(
                                        tenant_id   = tenant_id,
                                        sucursal_id = sucursal_id,
                                        sesion_id   = str(caja_sesion.id),
                                        cajero_id   = str(current_user.id),
                                        cajero_name = cajero_info,
                                        subtipo     = mov.subtipo,
                                        tipo        = inverse_type,
                                        monto       = mov.monto,
                                        descripcion = f"{motivo_label} — Reversa Ticket {ticket_ref} ({mov.subtipo})",
                                        sale_id     = str(sale.id),
                                    ).create(session=session)

                    # ── 3. Guardar auditoría de anulación ────────────────────────
                    sale.anulada              = True
                    sale.motivo_anulacion     = motivo
                    sale.notas_anulacion      = notas
                    sale.anulada_por_id       = str(current_user.id)
                    sale.anulada_por_nombre   = current_user.full_name or current_user.username
                    sale.anulada_at           = datetime.utcnow()
                    sale.metodo_pago_correcto = metodo_pago_correcto
                    await sale.save(session=session)
                    
                    await SaleItemAnalytics.find(
                        SaleItemAnalytics.tenant_id == tenant_id,
                        SaleItemAnalytics.sale_id == str(sale.id),
                        session=session
                    ).delete(session=session)
                    
                    sale_obj = sale
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[SalesService.anular_sale] Transaction aborted: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error transaccional al anular la venta: {str(e)}")

        if sale_obj:
            # --- Sincronización en segundo plano para eliminar los ítems de ventas_historicas_crudas ---
            async def _sync_anular_background():
                try:
                    db_raw = get_client().salessystem
                    await db_raw.ventas_historicas_crudas.delete_many(
                        {"original_sale_id": sale_obj.id}
                    )
                except Exception as e:
                    logger.error(f"Error en segundo plano eliminando venta anulada de ventas_historicas_crudas: {e}", exc_info=True)
            
            asyncio.create_task(_sync_anular_background())

        return sale_obj

