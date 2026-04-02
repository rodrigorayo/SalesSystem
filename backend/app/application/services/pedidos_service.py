from app.infrastructure.db import get_client
import logging
from typing import List, Optional
from datetime import datetime
from fastapi import HTTPException
from bson import ObjectId
from pymongo import ReturnDocument

from app.domain.models.pedido_interno import PedidoInterno, PedidoItem, EstadoPedido
from app.domain.models.pedido_item import PedidoItemDocument
from app.domain.models.inventario import Inventario, TipoMovimiento, InventoryLog
from app.domain.models.product import Product
from app.domain.models.user import User, UserRole
from app.domain.schemas.pedidos import PedidoCreate, PedidoRecepcion, PedidoRecepcionItem
from app.utils.errors import PedidosErrors, handle_service_error, retry_on_write_conflict

logger = logging.getLogger("PedidosService")

class PedidosService:

    @staticmethod
    async def crear_pedido(data: PedidoCreate, current_user: User) -> PedidoInterno:
        tenant_id = current_user.tenant_id or ""
        if data.sucursal_origen_id == "CENTRAL" and current_user.role == UserRole.SUPERVISOR:
            raise HTTPException(status_code=403, detail="Los Supervisores no pueden pedir directo a Matriz, solo a Sucursales Físicas")
            
        if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.VENDEDOR] and data.sucursal_destino_id != current_user.sucursal_id:
            raise HTTPException(status_code=403, detail="No puedes crear solicitudes de entrada para otras sucursales")
            
        if current_user.role == UserRole.SUPERVISOR and data.transferencia_directa:
            if data.sucursal_origen_id != current_user.sucursal_id and data.sucursal_destino_id != current_user.sucursal_id:
                raise HTTPException(status_code=403, detail="Solo puedes transferir inventario desde o hacia tu propia bodega de Supervisor")

        client = get_client()
        try:
            async with await client.start_session() as session:
                async with session.start_transaction():
                    items = []
                    for item in data.items:
                        product = await Product.get(item.producto_id, session=session)
                        if not product or product.tenant_id != tenant_id:
                            raise HTTPException(status_code=404, detail=PedidosErrors.producto_no_encontrado(item.producto_id))
                            
                        if data.sucursal_origen_id != "CENTRAL":
                            inv = await Inventario.find_one(
                                Inventario.tenant_id == tenant_id,
                                Inventario.sucursal_id == data.sucursal_origen_id,
                                Inventario.producto_id == item.producto_id,
                                session=session
                            )
                            stock_disp = inv.cantidad if inv else 0
                            if stock_disp < item.cantidad:
                                raise HTTPException(
                                    status_code=400,
                                    detail=PedidosErrors.stock_insuficiente_origen(product.descripcion, item.cantidad, stock_disp)
                                )
                        
                        costo = product.costo_producto
                        subtotal = item.cantidad * costo
                        items.append(PedidoItem(
                            producto_id=item.producto_id,
                            descripcion=product.descripcion,
                            cantidad=item.cantidad,
                            precio_mayorista=costo,
                            subtotal=subtotal
                        ))

                    tipo_pedido = "SUCURSAL_A_SUCURSAL" if data.sucursal_origen_id != "CENTRAL" else "MATRIZ_A_SUCURSAL"
                    
                    pedido = PedidoInterno(
                        tenant_id=tenant_id,
                        sucursal_id=data.sucursal_destino_id,
                        sucursal_origen_id=data.sucursal_origen_id,
                        sucursal_destino_id=data.sucursal_destino_id,
                        tipo_pedido=tipo_pedido,
                        estado=EstadoPedido.CREADO,
                        items=items,
                        notas=data.notas,
                        total_mayorista=sum(i.subtotal for i in items)
                    )

                    if data.transferencia_directa:
                        pedido.estado = EstadoPedido.RECIBIDO
                        pedido.aceptado_at = datetime.utcnow()
                        pedido.despachado_at = datetime.utcnow()
                        pedido.recibido_at = datetime.utcnow()
                        pedido.aceptado_por = str(current_user.id)
                        pedido.despachado_por = str(current_user.id)
                        pedido.recibido_por = str(current_user.id)
                        
                        for item in items:
                            item.cantidad_recibida = item.cantidad
                            inv_origen = await Inventario.get_pymongo_collection().find_one_and_update(
                                {"tenant_id": tenant_id, "sucursal_id": data.sucursal_origen_id, "producto_id": item.producto_id},
                                {"$inc": {"cantidad": -item.cantidad}},
                                return_document=ReturnDocument.AFTER,
                                session=session.client_session if hasattr(session, "client_session") else session
                            )
                            inv_destino = await Inventario.get_pymongo_collection().find_one_and_update(
                                {"tenant_id": tenant_id, "sucursal_id": data.sucursal_destino_id, "producto_id": item.producto_id},
                                {"$inc": {"cantidad": item.cantidad}},
                                upsert=True,
                                return_document=ReturnDocument.AFTER,
                                session=session.client_session if hasattr(session, "client_session") else session
                            )
                            
                            if inv_origen:
                                await InventoryLog(
                                    tenant_id=tenant_id,
                                    sucursal_id=data.sucursal_origen_id,
                                    producto_id=item.producto_id,
                                    producto_nombre=item.descripcion,
                                    tipo_movimiento=TipoMovimiento.TRASLADO,
                                    cantidad_movida=-item.cantidad,
                                    stock_resultante=inv_origen.get("cantidad", 0),
                                    usuario_id=str(current_user.id),
                                    usuario_nombre=current_user.username,
                                    notas=f"Transferencia directa hacia {data.sucursal_destino_id}"
                                ).create(session=session)
                            if inv_destino:
                                await InventoryLog(
                                    tenant_id=tenant_id,
                                    sucursal_id=data.sucursal_destino_id,
                                    producto_id=item.producto_id,
                                    producto_nombre=item.descripcion,
                                    tipo_movimiento=TipoMovimiento.TRASLADO,
                                    cantidad_movida=item.cantidad,
                                    stock_resultante=inv_destino.get("cantidad", 0),
                                    usuario_id=str(current_user.id),
                                    usuario_nombre=current_user.username,
                                    notas=f"Recepción directa desde {data.sucursal_origen_id}"
                                ).create(session=session)

                    await pedido.create(session=session)

                    items_docs = [
                        PedidoItemDocument(
                            tenant_id=pedido.tenant_id,
                            pedido_id=str(pedido.id),
                            sucursal_origen_id=pedido.sucursal_origen_id,
                            sucursal_destino_id=pedido.sucursal_destino_id,
                            pedido_fecha=pedido.created_at,
                            producto_id=item.producto_id,
                            descripcion=item.descripcion,
                            cantidad=item.cantidad,
                            precio_mayorista=item.precio_mayorista,
                            subtotal=item.subtotal
                        )
                        for item in items
                    ]
                    # Beanie insert_many with session
                    if items_docs:
                        await PedidoItemDocument.insert_many(items_docs, session=session)

                    return pedido
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[PedidosService] Error creating pedido: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to create order due to transactional error: {e}")


    @staticmethod
    async def cancelar_pedido(pedido_id: str, current_user: User) -> PedidoInterno:
        pedido = await PedidoInterno.get(pedido_id)
        if not pedido or pedido.tenant_id != (current_user.tenant_id or ""):
            raise HTTPException(status_code=404, detail="Order not found")
        if pedido.estado != EstadoPedido.CREADO:
            raise HTTPException(status_code=400, detail=f"No se puede cancelar un pedido en estado {pedido.estado}")
        if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR] and pedido.sucursal_id != current_user.sucursal_id:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this order")

        pedido.estado = EstadoPedido.CANCELADO
        pedido.cancelado_at = datetime.utcnow()
        pedido.cancelado_por = str(current_user.id)
        await pedido.save()
        return pedido


    @staticmethod
    async def aceptar_pedido(pedido_id: str, current_user: User) -> PedidoInterno:
        is_matrix_admin = current_user.role in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]
        pedido = await PedidoInterno.get(pedido_id)
        if not pedido or pedido.tenant_id != (current_user.tenant_id or ""):
            raise HTTPException(status_code=404, detail="Order not found")
            
        if not is_matrix_admin:
            if current_user.role not in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR] or pedido.sucursal_origen_id != current_user.sucursal_id:
                raise HTTPException(status_code=403, detail="No tienes permiso para aprobar despachos de esta sucursal origen")
            
        if pedido.estado != EstadoPedido.CREADO:
            raise HTTPException(status_code=400, detail=f"No se puede aceptar un pedido en estado {pedido.estado}")

        pedido.estado = EstadoPedido.ACEPTADO
        pedido.aceptado_at = datetime.utcnow()
        pedido.aceptado_por = str(current_user.id)
        await pedido.save()
        return pedido


    @staticmethod
    async def despachar_pedido(pedido_id: str, current_user: User) -> PedidoInterno:
        is_matrix_admin = current_user.role in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]
        tenant_id = current_user.tenant_id or ""

        client = get_client()

        async def _run_despacho() -> PedidoInterno:
            async with await client.start_session() as session:
                async with session.start_transaction():
                    # ✔ Usar .get() para conversión automática str → ObjectId
                    pedido = await PedidoInterno.get(pedido_id, session=session)
                    if not pedido or pedido.tenant_id != tenant_id:
                        raise HTTPException(status_code=404, detail=PedidosErrors.PEDIDO_NO_ENCONTRADO)

                    if not is_matrix_admin:
                        if (
                            current_user.role not in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR]
                            or pedido.sucursal_origen_id != current_user.sucursal_id
                        ):
                            raise HTTPException(status_code=403, detail=PedidosErrors.SIN_PERMISO_DESPACHAR)

                    if pedido.estado not in [EstadoPedido.CREADO, EstadoPedido.ACEPTADO]:
                        raise HTTPException(
                            status_code=400,
                            detail=PedidosErrors.estado_invalido_para("despachar", pedido.estado)
                        )

                    if pedido.sucursal_origen_id != "CENTRAL":
                        # Verificar stock antes de descontar
                        for item in pedido.items:
                            inv = await Inventario.find_one(
                                Inventario.tenant_id == tenant_id,
                                Inventario.sucursal_id == pedido.sucursal_origen_id,
                                Inventario.producto_id == item.producto_id,
                                session=session
                            )
                            stock_disp = inv.cantidad if inv else 0
                            if stock_disp < item.cantidad:
                                raise HTTPException(
                                    status_code=400,
                                    detail=PedidosErrors.stock_insuficiente_origen(
                                        item.descripcion, item.cantidad, stock_disp
                                    )
                                )

                        for item in pedido.items:
                            inv_origen = await Inventario.get_pymongo_collection().find_one_and_update(
                                {
                                    "tenant_id": tenant_id,
                                    "sucursal_id": pedido.sucursal_origen_id,
                                    "producto_id": item.producto_id
                                },
                                {"$inc": {"cantidad": -item.cantidad}},
                                return_document=ReturnDocument.AFTER,
                                session=session.client_session if hasattr(session, "client_session") else session
                            )
                            if inv_origen:
                                await InventoryLog(
                                    tenant_id=tenant_id,
                                    sucursal_id=pedido.sucursal_origen_id,
                                    producto_id=item.producto_id,
                                    producto_nombre=item.descripcion,
                                    tipo_movimiento=TipoMovimiento.TRASLADO,
                                    cantidad_movida=-item.cantidad,
                                    stock_resultante=inv_origen.get("cantidad", 0),
                                    usuario_id=str(current_user.id),
                                    usuario_nombre=current_user.username,
                                    notas=f"Despacho Interno hacia {pedido.sucursal_destino_id}"
                                ).create(session=session)

                    total = sum(item.cantidad * item.precio_mayorista for item in pedido.items)
                    pedido.estado = EstadoPedido.DESPACHADO
                    pedido.despachado_at = datetime.utcnow()
                    pedido.despachado_por = str(current_user.id)
                    pedido.total_mayorista = total
                    await pedido.save(session=session)
                    return pedido

        try:
            return await retry_on_write_conflict(_run_despacho)
        except HTTPException:
            raise
        except Exception as e:
            raise handle_service_error(e, "al despachar el pedido")



    @staticmethod
    async def recibir_pedido(pedido_id: str, data: Optional[PedidoRecepcion], current_user: User) -> PedidoInterno:
        tenant_id = current_user.tenant_id or ""
        client = get_client()

        try:
            async with await client.start_session() as session:
                async with session.start_transaction():
                    # ✔ .get() maneja la conversión str → ObjectId automáticamente
                    pedido = await PedidoInterno.get(pedido_id, session=session)
                    if not pedido or pedido.tenant_id != tenant_id:
                        raise HTTPException(status_code=404, detail=PedidosErrors.PEDIDO_NO_ENCONTRADO)

                    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR] and pedido.sucursal_destino_id != current_user.sucursal_id:
                        raise HTTPException(status_code=403, detail=PedidosErrors.SIN_PERMISO_RECIBIR)

                    if pedido.estado != EstadoPedido.DESPACHADO:
                        raise HTTPException(
                            status_code=400,
                            detail=PedidosErrors.estado_invalido_para("recibir", pedido.estado)
                        )

                    recepcion_map = {}
                    if data and data.items:
                        recepcion_map = {item.producto_id: item.cantidad_recibida for item in data.items}

                    for item in pedido.items:
                        cant_recibida = recepcion_map.get(item.producto_id, item.cantidad)
                        
                        if cant_recibida > item.cantidad:
                            raise HTTPException(status_code=400, detail=f"No puedes recibir más de lo despachado para {item.descripcion}")
                            
                        item.cantidad_recibida = cant_recibida
                        if cant_recibida == 0:
                            continue

                        updated_inv = await Inventario.get_pymongo_collection().find_one_and_update(
                            {
                                "tenant_id": tenant_id,
                                "sucursal_id": pedido.sucursal_id, # Target branch where stock arrives
                                "producto_id": item.producto_id
                            },
                            {
                                "$inc": {"cantidad": cant_recibida}
                            },
                            upsert=True,
                            return_document=ReturnDocument.AFTER,
                            session=session.client_session if hasattr(session, "client_session") else session
                        )
                        stock_resultante = updated_inv["cantidad"] if updated_inv else cant_recibida

                        await InventoryLog(
                            tenant_id=tenant_id,
                            sucursal_id=pedido.sucursal_id,
                            producto_id=item.producto_id,
                            descripcion=item.descripcion,
                            tipo_movimiento=TipoMovimiento.TRASLADO,
                            cantidad_movida=cant_recibida,
                            stock_resultante=stock_resultante,
                            costo_unitario_momento=item.precio_mayorista,
                            usuario_id=str(current_user.id),
                            usuario_nombre=current_user.full_name or current_user.username,
                            notas="Recepción de Pedido Central",
                            referencia_id=str(pedido.id)
                        ).create(session=session)

                    pedido.estado = EstadoPedido.RECIBIDO
                    pedido.recibido_at = datetime.utcnow()
                    pedido.recibido_por = str(current_user.id)
                    await pedido.save(session=session)
                    return pedido
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[PedidosService] Error receiving pedido: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to receive due to transactional error: {e}")
