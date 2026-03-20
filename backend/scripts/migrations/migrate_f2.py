import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.pedido_interno import PedidoInterno
from app.models.product import Product
from app.db import init_db

async def migrate():
    print("Iniciando Migración Fase 2 (Analytics)...")
    try:
        await init_db()
        print("DB Conectada.")
    except Exception as e:
        print(f"Error conectando a la DB: {e}")
        return

    # 1. Migrar Sales -> SaleItems
    print("Descomponiendo sales.items en sale_items...")
    sales = await Sale.find_all().to_list()
    count = 0
    for s in sales:
        for item in s.items:
            # Check if already exists to be idempotent
            exists = await SaleItem.find_one(
                SaleItem.sale_id == str(s.id),
                SaleItem.producto_id == item.producto_id
            )
            if not exists:
                # Get product to find cost (current cost as fallback)
                prod = await Product.get(item.producto_id)
                costo = prod.costo_producto if prod else 0.0
                
                si = SaleItem(
                    tenant_id=s.tenant_id,
                    sucursal_id=s.sucursal_id,
                    sale_id=str(s.id),
                    sale_date=s.created_at,
                    producto_id=item.producto_id,
                    descripcion=item.producto_nombre,
                    cantidad=item.cantidad,
                    precio_unitario=item.precio,
                    costo_unitario=costo,
                    subtotal=item.subtotal,
                    created_at=s.created_at
                )
                await si.insert()
                count += 1
    print(f"{count} items de venta migrados.")

    # 2. Migrar Pedidos Internos
    print("Actualizando sucursal_origen/destino en pedidos_internos...")
    pedidos = await PedidoInterno.find_all().to_list()
    count_p = 0
    for p in pedidos:
        if not p.sucursal_destino_id:
            p.sucursal_destino_id = p.sucursal_id
            p.sucursal_origen_id = "CENTRAL" # Default to Matrix
            p.tipo_pedido = "MATRIZ_A_SUCURSAL"
            await p.save()
            count_p += 1
    print(f"{count_p} pedidos actualizados.")

    print("Migración Fase 2 Completada.")

if __name__ == "__main__":
    asyncio.run(migrate())
