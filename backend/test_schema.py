import asyncio
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.product import Product
from app.models.category import Category
from app.models.sucursal import Sucursal
from app.models.inventario import Inventario
from bson import ObjectId
import uuid
import pandas as pd

async def main():
    # Test valid product structure like in the endpoint
    tenant_id = "test"
    try:
        nuevo_prod = Product(
            id=ObjectId(),
            tenant_id=tenant_id,
            descripcion="Test",
            precio_venta=2.0,
            costo_producto=0,
            categoria_id="test_cat",
            codigo_corto="2005.0",
            codigo_sistema=str(uuid.uuid4())[:8].upper(),
            codigo_largo="",
            is_active=True
        )
        print("Product validated successfully!")
    except Exception as e:
        print("Product validation failed:", e)

if __name__ == "__main__":
    asyncio.run(main())
