from typing import Optional
from app.models.cliente import Cliente
from app.models.price_list import ListaPrecio, ListaPrecioItem, TipoListaPrecio

async def resolver_precio(
    producto_id: str,
    precio_base: float,
    cliente_id: Optional[str],
    cantidad: int,
    tenant_id: str
) -> float:
    """
    Resolves the price for a product based on the customer's price list and quantity.
    D-08 implementation.
    """
    if not cliente_id:
        return precio_base

    try:
        cliente = await Cliente.get(cliente_id)
    except:
        return precio_base
        
    if not cliente or not cliente.lista_precio_id:
        return precio_base

    lista = await ListaPrecio.get(cliente.lista_precio_id)
    if not lista or not lista.is_active:
        return precio_base

    # Percentage List — applies directly
    if lista.tipo == TipoListaPrecio.PORCENTAJE_DESCUENTO and lista.valor_descuento:
        return round(precio_base * (1 - lista.valor_descuento / 100), 2)

    # Fixed Price List — search for specific price for this product and quantity
    item = await ListaPrecioItem.find_one(
        ListaPrecioItem.lista_id == cliente.lista_precio_id,
        ListaPrecioItem.producto_id == producto_id,
        ListaPrecioItem.cantidad_minima <= cantidad
    ).sort(-ListaPrecioItem.cantidad_minima) # Get the best price for the current quantity

    if item:
        return item.precio_especial
    
    return precio_base
