from app.infrastructure.db import get_client
import math
import logging
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
from app.domain.models.user import User, UserRole
from app.domain.schemas.sale import SaleCreate
from app.utils.pricing import resolver_precio
from app.domain.models.base import DecimalMoney

logger = logging.getLogger("SalesService")

class SalesService:
    @staticmethod
    async def create_sale(sale_in: SaleCreate, current_user: User) -> Sale:
        tenant_id = current_user.tenant_id or "default"
        sucursal_id = current_user.sucursal_id or sale_in.sucursal_id or "CENTRAL"
        
        client = get_client()

        try:
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
                            precio_base=float(unit_price_base), # Legacy helper
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
                        
                    int_part = Decimal(math.floor(float(computed_total)))
                    frac = computed_total - int_part
                    frac_fixed = round(float(frac), 2)

                    if frac_fixed < 0.5:
                        computed_total = int_part
                    elif frac_fixed > 0.5:
                        computed_total = int_part + Decimal("1")
                    else:
                        computed_total = int_part + Decimal("0.5")
                        
                    has_credit = any(p.metodo == "CREDITO" for p in sale_in.pagos)
                    if has_credit and not sale_in.cliente_id and not (sale_in.cliente and sale_in.cliente.razon_social):
                        raise HTTPException(status_code=400, detail="Ventas a crédito requieren un cliente registrado")

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

                    if sale.cliente_id:
                        from beanie.operators import Inc, Set
                        await Cliente.find_one(Cliente.id == sale.cliente_id, session=session).update(
                            Inc({Cliente.total_compras: sale.total}),
                            Inc({Cliente.cantidad_compras: 1}),
                            Set({Cliente.ultima_compra_at: sale.created_at}),
                            session=session
                        )

                    _SUBTIPO_MAP = {
                        "EFECTIVO": SubtipoMovimiento.VENTA_EFECTIVO,
                        "QR":       SubtipoMovimiento.VENTA_QR,
                        "TARJETA":  SubtipoMovimiento.VENTA_TARJETA,
                    }

                    caja_sesion = await CajaSesion.find_one(
                        CajaSesion.tenant_id   == tenant_id,
                        CajaSesion.sucursal_id == sucursal_id,
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
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[SalesService.create_sale] Transaction aborted: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error transaccional al procesar la venta: {str(e)}")

    @staticmethod
    async def anular_sale(sale_id: str, current_user: User) -> Sale:
        tenant_id = current_user.tenant_id or "default"
        client = get_client()

        try:
            async with await client.start_session() as session:
                async with session.start_transaction():
                    # Beanie requires ObjectId type for equality comparison.
                    # Using Sale.get() handles the str→ObjectId conversion automatically.
                    sale = await Sale.get(sale_id, session=session)
                    if not sale or sale.tenant_id != tenant_id:
                        raise HTTPException(status_code=404, detail="Venta no encontrada")
                        
                    if sale.anulada:
                        raise HTTPException(status_code=400, detail="La venta ya está anulada")

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

                    for item in sale.items:
                        updated_inv = await Inventario.get_pymongo_collection().find_one_and_update(
                            {
                                "tenant_id": tenant_id,
                                "sucursal_id": sucursal_id,
                                "producto_id": item.producto_id,
                            },
                            {
                                "$inc": {"cantidad": item.cantidad}
                            },
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
                                notas=f"Anulación de Venta #{str(sale.id)[-6:]}",
                                referencia_id=str(sale.id)
                            ).create(session=session)

                    caja_sesion = await CajaSesion.find_one(
                        CajaSesion.tenant_id   == tenant_id,
                        CajaSesion.sucursal_id == sucursal_id,
                        CajaSesion.estado      == EstadoSesion.ABIERTA,
                        session=session
                    )
                    if caja_sesion:
                        movs = await CajaMovimiento.find(
                            CajaMovimiento.tenant_id == tenant_id,
                            CajaMovimiento.sale_id == str(sale.id),
                            session=session
                        ).to_list()
                        
                        for mov in movs:
                            inverse_type = "EGRESO" if mov.tipo == "INGRESO" else "INGRESO"
                            await CajaMovimiento(
                                tenant_id   = tenant_id,
                                sucursal_id = sucursal_id,
                                sesion_id   = str(caja_sesion.id),
                                cajero_id   = str(current_user.id),
                                cajero_name = current_user.full_name or current_user.username,
                                subtipo     = mov.subtipo,
                                tipo        = inverse_type,
                                monto       = mov.monto,
                                descripcion = f"Anulación de Venta #{str(sale.id)[-6:]} (Reversión de {mov.descripcion.split('— ')[-1] if '— ' in mov.descripcion else 'pago'})",
                                sale_id     = str(sale.id),
                            ).create(session=session)

                    sale.anulada = True
                    await sale.save(session=session)
                    
                    await SaleItemAnalytics.find(
                        SaleItemAnalytics.tenant_id == tenant_id,
                        SaleItemAnalytics.sale_id == str(sale.id),
                        session=session
                    ).delete(session=session)
                    
                    return sale
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[SalesService.anular_sale] Transaction aborted: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error transaccional al anular la venta: {str(e)}")
