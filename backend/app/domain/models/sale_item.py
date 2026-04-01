from beanie import Document
from pydantic import Field
from datetime import datetime
from .base import DecimalMoney

class SaleItem(Document):
    """
    Desnormalized table for analytics. 
    One document per item sold.
    """
    tenant_id: str
    sucursal_id: str
    sale_id: str            # Ref to Sale
    sale_date: datetime    # Denormalized for fast queries
    
    producto_id: str
    descripcion: str        # Snapshot
    
    cantidad: int
    precio_unitario: DecimalMoney
    costo_unitario: DecimalMoney    # Snapshot del costo al momento
    descuento_unitario: DecimalMoney = DecimalMoney("0.0")
    subtotal: DecimalMoney
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "sale_items"
        indexes = [
            "tenant_id",
            "sucursal_id",
            "producto_id",
            "sale_date",
            [("tenant_id", 1), ("producto_id", 1), ("sale_date", -1)],
            [("tenant_id", 1), ("sucursal_id", 1), ("sale_date", -1)],
        ]
