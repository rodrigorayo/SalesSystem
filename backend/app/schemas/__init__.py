"""
app/schemas/ — Pydantic request/response schemas.

Each file corresponds to a business domain (product, sale, inventario...).
These are SEPARATE from app/models/ which are the Beanie/MongoDB Documents.

Import convention:
    from app.schemas.product import ProductCreate, ProductUpdate
    from app.schemas.sale import SaleCreate, QRInfoUpdate
"""
