from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from fastapi import HTTPException
from app.domain.models.b2b import (
    NotaDevolucionMerma, ItemMovimientoB2B, EstadoReclamo,
    NotaTraspaso, EstadoTraspaso, InventarioMovil, InventarioMovilItem
)
from app.domain.models.product import Product
from app.domain.models.inventario import Inventario, InventoryLog
from app.domain.models.cliente import Cliente
from app.domain.models.user import User
from app.domain.models.base import DecimalMoney
from decimal import Decimal

class MermaInputItem(BaseModel):
    producto_id: str
    cantidad: int

class B2BService:
    @staticmethod
    async def registrar_merma(
        tenant_id: str,
        sucursal_id: str,
        supermercado_id: str,
        items_input: List[MermaInputItem],
        registrado_por: User,
        notas: Optional[str] = None
    ) -> NotaDevolucionMerma:
        """
        Registra la devolución de vencidos. 
        Calcula la deuda de Fábrica Taboada en Costo Base.
        Automáticamente resta los productos frescos de la sucursal como 'reposición'.
        """
        supermercado = await Cliente.get(supermercado_id)
        if not supermercado or supermercado.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Supermercado no encontrado")
            
        items_registrados = []
        costo_total_reclamo = Decimal("0")
        
        for input_item in items_input:
            if input_item.cantidad <= 0: continue
            
            producto = await Product.get(input_item.producto_id)
            if not producto:
                raise HTTPException(status_code=404, detail=f"Producto {input_item.producto_id} no encontrado")
                
            costo = Decimal(str(producto.costo_producto))
            precio = Decimal(str(producto.precio_venta))
            
            items_registrados.append(ItemMovimientoB2B(
                producto_id=str(producto.id),
                producto_nombre=producto.descripcion,
                codigo_corto=producto.codigo_corto,
                cantidad=input_item.cantidad,
                costo_unitario=DecimalMoney(str(costo)),
                precio_venta=DecimalMoney(str(precio))
            ))
            
            costo_total_reclamo += (costo * input_item.cantidad)
            
            # Reposición: Restar inventario fresco
            inv = await Inventario.find_one(
                Inventario.tenant_id == tenant_id,
                Inventario.sucursal_id == sucursal_id,
                Inventario.producto_id == str(producto.id)
            )
            if inv:
                # Even if negative, let it go through as it's an emergency swap
                inv.cantidad -= input_item.cantidad
                inv.updated_at = datetime.utcnow()
                await inv.save()
                
                # Register Log
                await InventoryLog(
                    tenant_id=tenant_id,
                    sucursal_id=sucursal_id,
                    producto_id=str(producto.id),
                    tipo="SALIDA",
                    motivo="MERMA_REPOSICION",
                    cantidad=input_item.cantidad,
                    stock_previo=inv.cantidad + input_item.cantidad,
                    stock_nuevo=inv.cantidad,
                    referencia_id="PENDING", # Fixed below
                    user_id=str(registrado_por.id),
                    user_name=registrado_por.full_name or registrado_por.username
                ).insert()
                
        if not items_registrados:
            raise HTTPException(status_code=400, detail="Debe enviar al menos 1 producto válido para la merma.")
            
        nota_merma = NotaDevolucionMerma(
            tenant_id=tenant_id,
            sucursal_id=sucursal_id,
            supermercado_id=str(supermercado.id),
            supermercado_nombre=supermercado.nombre or supermercado.razon_social or "Desconocido",
            items=items_registrados,
            costo_total_merma=DecimalMoney(str(costo_total_reclamo)),
            estado_reclamo=EstadoReclamo.PENDIENTE,
            notas_agente=notas,
            registrado_por_user_id=str(registrado_por.id),
            registrado_por_nombre=registrado_por.full_name or registrado_por.username
        )
        await nota_merma.insert()
        
        # Link Logs
        await InventoryLog.find(
            InventoryLog.tenant_id == tenant_id,
            InventoryLog.referencia_id == "PENDING"
        ).update({"$set": {"referencia_id": str(nota_merma.id)}})
        
        return nota_merma

    @staticmethod
    async def compensar_reclamo(
        merma_id: str,
        tenant_id: str,
        user: User
    ) -> NotaDevolucionMerma:
        """
        Marca un reclamo como pagado/compensado por la Fábrica Taboada.
        """
        nota = await NotaDevolucionMerma.get(merma_id)
        if not nota or nota.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Nota de merma no encontrada")
            
        if nota.estado_reclamo == EstadoReclamo.COMPENSADO:
            raise HTTPException(status_code=400, detail="El reclamo ya ha sido compensado.")
            
        nota.estado_reclamo = EstadoReclamo.COMPENSADO
        nota.fecha_compensacion = datetime.utcnow()
        await nota.save()
        return nota
