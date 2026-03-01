from beanie import Document
from pydantic import Field
from datetime import datetime
from pymongo import IndexModel


class Inventario(Document):
    """
    Tracks the physical stock of a product in a specific location.

    - sucursal_id = "CENTRAL" → the Empresa's central warehouse.
    - sucursal_id = <id>       → stock in that specific branch.
    """
    tenant_id: str
    sucursal_id: str      # "CENTRAL" or a Sucursal._id string
    producto_id: str      # Product._id
    cantidad: int = 0
    precio_sucursal: float | None = None  # Branch-specific price override
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "inventario"
        indexes = [
            "tenant_id",
            "sucursal_id",
            "producto_id",
            IndexModel(
                [("tenant_id", 1), ("sucursal_id", 1), ("producto_id", 1)],
                unique=True,
                name="tenant_branch_product_unique"
            ),
            [("sucursal_id", 1), ("producto_id", 1)],
        ]


from enum import Enum

class TipoMovimiento(str, Enum):
    ENTRADA_MANUAL = "ENTRADA_MANUAL"
    SALIDA_MANUAL = "SALIDA_MANUAL"
    AJUSTE_FISICO = "AJUSTE_FISICO"
    VENTA = "VENTA"
    COMPRA = "COMPRA"
    TRASLADO = "TRASLADO"


class InventoryLog(Document):
    """
    Kárdex: Historial inmutable de movimientos de stock.
    """
    tenant_id: str
    sucursal_id: str
    producto_id: str
    descripcion: str = ""        # Snapshot of product name
    tipo_movimiento: TipoMovimiento
    cantidad_movida: int         # Can be negative for exits
    stock_resultante: int        # Snapshot of stock after movement
    costo_unitario_momento: float = 0.0 # Costo al momento del movimiento
    precio_venta_momento: float = 0.0   # Precio al momento del movimiento
    usuario_id: str
    usuario_nombre: str
    notas: str = ""
    referencia_id: str = ""      # e.g., Sale ID, Transfer ID
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "inventory_logs"
        indexes = [
            "tenant_id",
            "sucursal_id",
            "producto_id",
            "tipo_movimiento",
            "usuario_id",
            "created_at",
            [("tenant_id", 1), ("sucursal_id", 1), ("created_at", -1)],
            [("tenant_id", 1), ("producto_id", 1), ("created_at", -1)],
        ]
