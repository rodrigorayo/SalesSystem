"""
Pydantic schemas for the Products domain.

These were previously defined inline inside the endpoint file.
Moving them here allows:
  - Independent PRs for schema vs endpoint changes
  - Reuse across multiple endpoints or services
  - Cleaner, shorter endpoint files
"""

from typing import Optional
from pydantic import BaseModel


class ProductCreate(BaseModel):
    descripcion: str
    categoria_id: str
    precio_venta: float
    costo_producto: float = 0.0
    proveedor: Optional[str] = None
    codigo_largo: Optional[str] = None
    codigo_corto: Optional[str] = None
    image_url: Optional[str] = None
    precios_sucursales: Optional[dict[str, float]] = None


class ProductUpdate(BaseModel):
    descripcion: Optional[str] = None
    categoria_id: Optional[str] = None
    precio_venta: Optional[float] = None
    costo_producto: Optional[float] = None
    proveedor: Optional[str] = None
    codigo_largo: Optional[str] = None
    codigo_corto: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    precios_sucursales: Optional[dict[str, float]] = None
