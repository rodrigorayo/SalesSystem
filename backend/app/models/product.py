from typing import Optional
from beanie import Document
from pydantic import Field
from datetime import datetime
import uuid


from .base import SoftDeleteMixin


class Product(Document, SoftDeleteMixin):
    """
    Catálogo central de productos — sin stock (stock vive en Inventario).

    Fields:
      codigo_sistema  – UUID generado automáticamente al crear el producto.
      codigo_largo    – Código de barras u otro código largo.
      codigo_corto    – Código corto único por tenant (ej: 'CHO-01').
      descripcion     – Nombre / descripción del producto.
      categoria_id    – FK obligatoria hacia la colección categories.
      costo_producto  – Costo de producción / adquisición.
      precio_venta    – Precio al público.
      image_url       – URL de imagen (opcional).
      tenant_id       – Aislamiento multi-tenant.
    """
    tenant_id: str
    codigo_sistema: str = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    codigo_largo: Optional[str] = None          # barcode
    codigo_corto: Optional[str] = None          # short SKU, unique per tenant
    descripcion: str                             # product name
    categoria_id: str                            # required FK → categories
    costo_producto: float = 0.0                  # production/purchase cost
    precio_venta: float                          # retail price

    # optional enrichment (resolved at query time, not stored)
    categoria_nombre: Optional[str] = None
    image_url: Optional[str] = None
    precios_sucursales: Optional[dict[str, float]] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "products"
