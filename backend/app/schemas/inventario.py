"""
Pydantic schemas for the Inventario domain.
Extracted from inventario.py endpoint.
"""

from typing import Optional
from pydantic import BaseModel


class InventarioItem(BaseModel):
    """Inventory entry enriched with product details — for display in the frontend."""
    inventario_id: str
    producto_id: str
    producto_nombre: str
    precio: float
    precio_sucursal: Optional[float] = None
    image_url: Optional[str] = None
    sucursal_id: str
    cantidad: int


class AjusteInventario(BaseModel):
    """Request body to manually adjust stock for a product in a branch."""
    producto_id: str
    tipo: str       # 'ENTRADA' | 'SALIDA' | 'AJUSTE'
    cantidad: int   # Must be a positive absolute value
    notas: str = ""

class InventarioPaginated(BaseModel):
    items: list[InventarioItem]
    total: int
    page: int
    pages: int
