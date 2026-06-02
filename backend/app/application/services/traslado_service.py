import logging
from datetime import datetime
from typing import List
from fastapi import HTTPException
from pymongo import ReturnDocument

from app.infrastructure.db import get_client
from app.domain.models.traslado import TrasladoInventario, TrasladoItem, EstadoTraslado
from app.domain.models.inventario import Inventario, InventoryLog, TipoMovimiento
from app.domain.models.product import Product
from app.domain.models.sucursal import Sucursal
from app.domain.models.user import User
from app.domain.schemas.traslado import TrasladoCreate, TrasladoReceive
from app.domain.models.base import DecimalMoney
from app.utils.errors import retry_on_write_conflict

logger = logging.getLogger("TrasladoService")

class TrasladoService:
    @staticmethod
    async def despachar_traslado(body: TrasladoCreate, current_user: User) -> TrasladoInventario:
        tenant_id = current_user.tenant_id or "default"
        sucursal_origen_id = current_user.sucursal_id or "CENTRAL"

        # Validate destination
        destino_tipo = body.destino_tipo or "SUCURSAL"
        if destino_tipo == "SUCURSAL":
            if not body.sucursal_destino_id:
                raise HTTPException(status_code=400, detail="Debe indicar la sucursal destino.")
            if sucursal_origen_id == body.sucursal_destino_id:
                raise HTTPException(status_code=400, detail="La sucursal origen y destino no pueden ser la misma.")
        else:  # CLIENTE
            if not body.cliente_destino_nombre:
                raise HTTPException(status_code=400, detail="Debe indicar el nombre del cliente destino.")
            
        client = get_client()

        async def _run_transaction() -> TrasladoInventario:
            async with await client.start_session() as session:
                async with session.start_transaction():
                    # Resolve Origen Name
                    orig_name = "Central"
                    if sucursal_origen_id != "CENTRAL":
                        suc_orig = await Sucursal.get(sucursal_origen_id, session=session)
                        orig_name = suc_orig.nombre if suc_orig else "Desconocida"

                    # Resolve Destino Name (only for SUCURSAL)
                    dest_name = None
                    if destino_tipo == "SUCURSAL":
                        dest_name = "Central"
                        if body.sucursal_destino_id != "CENTRAL":
                            suc_dest = await Sucursal.get(body.sucursal_destino_id, session=session)
                            if not suc_dest or suc_dest.tenant_id != tenant_id:
                                raise HTTPException(status_code=404, detail="Sucursal destino no encontrada.")
                            dest_name = suc_dest.nombre

                    traslado_items = []
                    valor_total = DecimalMoney("0.0")

                    for item_in in body.items:
                        product = await Product.get(item_in.producto_id, session=session)
                        if not product or product.tenant_id != tenant_id:
                            raise HTTPException(status_code=404, detail=f"Producto {item_in.producto_id} no encontrado")

                        # Descontar stock de origen (atomic check)
                        updated_inv = await Inventario.get_pymongo_collection().find_one_and_update(
                            {
                                "tenant_id": tenant_id,
                                "sucursal_id": sucursal_origen_id,
                                "producto_id": item_in.producto_id,
                                "cantidad": {"$gte": item_in.cantidad}
                            },
                            {"$inc": {"cantidad": -item_in.cantidad}},
                            return_document=ReturnDocument.AFTER,
                            session=session.client_session if hasattr(session, "client_session") else session
                        )

                        if not updated_inv:
                            raise HTTPException(
                                status_code=400,
                                detail=f"Stock insuficiente para '{product.descripcion}' en origen."
                            )

                        costo_u = product.costo_producto
                        subtotal = costo_u * item_in.cantidad
                        valor_total += subtotal

                        traslado_items.append(TrasladoItem(
                            producto_id=str(product.id),
                            descripcion=product.descripcion,
                            cantidad_enviada=item_in.cantidad,
                            costo_unitario=costo_u,
                            valor_total=subtotal
                        ))

                        # Log Kárdex Origen
                        notas_log = f"Traslado hacia {dest_name}" if destino_tipo == "SUCURSAL" else f"Entrega a cliente: {body.cliente_destino_nombre}"
                        await InventoryLog(
                            tenant_id=tenant_id,
                            sucursal_id=sucursal_origen_id,
                            producto_id=item_in.producto_id,
                            descripcion=product.descripcion,
                            tipo_movimiento=TipoMovimiento.TRASLADO,
                            cantidad_movida=-item_in.cantidad,
                            stock_resultante=updated_inv["cantidad"],
                            costo_unitario_momento=costo_u,
                            precio_venta_momento=product.precio_venta,
                            usuario_id=str(current_user.id),
                            usuario_nombre=current_user.full_name or current_user.username,
                            notas=notas_log,
                            referencia_id="PENDING"
                        ).create(session=session)

                    # For CLIENT transfers: immediately COMPLETADO (goods delivered in hand)
                    estado_inicial = EstadoTraslado.COMPLETADO if destino_tipo == "CLIENTE" else EstadoTraslado.EN_TRANSITO
                    completado_at = datetime.utcnow() if destino_tipo == "CLIENTE" else None

                    # Mark items as received if cliente (complete immediately)
                    if destino_tipo == "CLIENTE":
                        for ti in traslado_items:
                            ti.cantidad_recibida = ti.cantidad_enviada

                    traslado = TrasladoInventario(
                        tenant_id=tenant_id,
                        destino_tipo=destino_tipo,
                        sucursal_origen_id=sucursal_origen_id,
                        sucursal_origen_nombre=orig_name,
                        sucursal_destino_id=body.sucursal_destino_id if destino_tipo == "SUCURSAL" else None,
                        sucursal_destino_nombre=dest_name,
                        cliente_destino_id=body.cliente_destino_id if destino_tipo == "CLIENTE" else None,
                        cliente_destino_nombre=body.cliente_destino_nombre if destino_tipo == "CLIENTE" else None,
                        estado=estado_inicial,
                        items=traslado_items,
                        valor_total_enviado=valor_total,
                        valor_total_recibido=valor_total if destino_tipo == "CLIENTE" else DecimalMoney("0.0"),
                        notas=body.notas,
                        despachado_por_id=str(current_user.id),
                        despachado_por_nombre=current_user.full_name or current_user.username,
                        recibido_por_id=str(current_user.id) if destino_tipo == "CLIENTE" else None,
                        recibido_por_nombre=(current_user.full_name or current_user.username) if destino_tipo == "CLIENTE" else None,
                        completado_at=completado_at,
                    )
                    await traslado.create(session=session)

                    # Update Kardex logs with real traslado ID
                    await InventoryLog.find(
                        InventoryLog.tenant_id == tenant_id,
                        InventoryLog.referencia_id == "PENDING",
                        session=session
                    ).update({"$set": {"referencia_id": str(traslado.id)}}, session=session)

                    return traslado

        return await retry_on_write_conflict(_run_transaction)


    @staticmethod
    async def recibir_traslado(traslado_id: str, body: TrasladoReceive, current_user: User) -> TrasladoInventario:
        tenant_id = current_user.tenant_id or "default"
        sucursal_destino_id = current_user.sucursal_id or "CENTRAL"
        
        client = get_client()

        async def _run_transaction() -> TrasladoInventario:
            async with await client.start_session() as session:
                async with session.start_transaction():
                    traslado = await TrasladoInventario.get(traslado_id, session=session)
                    if not traslado or traslado.tenant_id != tenant_id:
                        raise HTTPException(status_code=404, detail="Traslado no encontrado.")
                        
                    if traslado.estado != EstadoTraslado.EN_TRANSITO:
                        raise HTTPException(status_code=400, detail=f"El traslado ya está {traslado.estado.value}.")
                        
                    if traslado.sucursal_destino_id != sucursal_destino_id and current_user.role not in ["SUPERADMIN", "ADMIN"]:
                        raise HTTPException(status_code=403, detail="No tienes permiso para recibir un traslado destinado a otra sucursal.")

                    valor_total_recibido = DecimalMoney("0.0")
                    items_recibidos_map = {i.producto_id: i.cantidad_recibida for i in body.items}

                    for t_item in traslado.items:
                        qty_recibida = items_recibidos_map.get(t_item.producto_id)
                        if qty_recibida is None:
                            qty_recibida = t_item.cantidad_enviada # Por defecto se recibe todo
                            
                        if qty_recibida < 0 or qty_recibida > t_item.cantidad_enviada:
                            raise HTTPException(status_code=400, detail=f"Cantidad recibida inválida para {t_item.descripcion}.")

                        t_item.cantidad_recibida = qty_recibida
                        subtotal_recibido = t_item.costo_unitario * qty_recibida
                        valor_total_recibido += subtotal_recibido

                        if qty_recibida > 0:
                            # Aumentar stock en destino
                            updated_inv = await Inventario.get_pymongo_collection().find_one_and_update(
                                {
                                    "tenant_id": tenant_id,
                                    "sucursal_id": traslado.sucursal_destino_id,
                                    "producto_id": t_item.producto_id
                                },
                                {
                                    "$inc": {"cantidad": qty_recibida},
                                    "$setOnInsert": {
                                        "created_at": datetime.utcnow(),
                                        "updated_at": datetime.utcnow()
                                    }
                                },
                                upsert=True,
                                return_document=ReturnDocument.AFTER,
                                session=session.client_session if hasattr(session, "client_session") else session
                            )

                            # Log Kárdex Destino
                            await InventoryLog(
                                tenant_id=tenant_id,
                                sucursal_id=traslado.sucursal_destino_id,
                                producto_id=t_item.producto_id,
                                descripcion=t_item.descripcion,
                                tipo_movimiento=TipoMovimiento.TRASLADO,
                                cantidad_movida=qty_recibida,
                                stock_resultante=updated_inv["cantidad"],
                                costo_unitario_momento=t_item.costo_unitario,
                                precio_venta_momento=t_item.costo_unitario, # aproximado
                                usuario_id=str(current_user.id),
                                usuario_nombre=current_user.full_name or current_user.username,
                                notas=f"Recepción de traslado desde {traslado.sucursal_origen_nombre}",
                                referencia_id=str(traslado.id)
                            ).create(session=session)

                    traslado.estado = EstadoTraslado.COMPLETADO
                    traslado.valor_total_recibido = valor_total_recibido
                    traslado.completado_at = datetime.utcnow()
                    traslado.recibido_por_id = str(current_user.id)
                    traslado.recibido_por_nombre = current_user.full_name or current_user.username
                    if body.notas:
                        traslado.notas = (traslado.notas or "") + f" | Recepción: {body.notas}"
                        
                    await traslado.save(session=session)
                    return traslado

        return await retry_on_write_conflict(_run_transaction)

    @staticmethod
    async def cancelar_traslado(traslado_id: str, current_user: User) -> TrasladoInventario:
        tenant_id = current_user.tenant_id or "default"
        client = get_client()

        async def _run_transaction() -> TrasladoInventario:
            async with await client.start_session() as session:
                async with session.start_transaction():
                    traslado = await TrasladoInventario.get(traslado_id, session=session)
                    if not traslado or traslado.tenant_id != tenant_id:
                        raise HTTPException(status_code=404, detail="Traslado no encontrado.")
                        
                    if traslado.estado != EstadoTraslado.EN_TRANSITO:
                        raise HTTPException(status_code=400, detail=f"Solo se pueden cancelar traslados EN_TRANSITO.")

                    # Devolver stock a origen
                    for t_item in traslado.items:
                        updated_inv = await Inventario.get_pymongo_collection().find_one_and_update(
                            {
                                "tenant_id": tenant_id,
                                "sucursal_id": traslado.sucursal_origen_id,
                                "producto_id": t_item.producto_id
                            },
                            {
                                "$inc": {"cantidad": t_item.cantidad_enviada}
                            },
                            return_document=ReturnDocument.AFTER,
                            session=session.client_session if hasattr(session, "client_session") else session
                        )

                        await InventoryLog(
                            tenant_id=tenant_id,
                            sucursal_id=traslado.sucursal_origen_id,
                            producto_id=t_item.producto_id,
                            descripcion=t_item.descripcion,
                            tipo_movimiento=TipoMovimiento.TRASLADO,
                            cantidad_movida=t_item.cantidad_enviada,
                            stock_resultante=updated_inv["cantidad"] if updated_inv else t_item.cantidad_enviada,
                            costo_unitario_momento=t_item.costo_unitario,
                            precio_venta_momento=t_item.costo_unitario,
                            usuario_id=str(current_user.id),
                            usuario_nombre=current_user.full_name or current_user.username,
                            notas=f"Devolución por cancelación de traslado hacia {traslado.sucursal_destino_nombre}",
                            referencia_id=str(traslado.id)
                        ).create(session=session)

                    traslado.estado = EstadoTraslado.CANCELADO
                    traslado.cancelado_at = datetime.utcnow()
                    traslado.cancelado_por_id = str(current_user.id)
                    traslado.cancelado_por_nombre = current_user.full_name or current_user.username
                    await traslado.save(session=session)
                    return traslado

        return await retry_on_write_conflict(_run_transaction)
