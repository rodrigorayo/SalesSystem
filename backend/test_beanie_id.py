import asyncio
from bson import ObjectId
from app.models.product import Product

async def main():
    try:
        new_id = ObjectId()
        print("ObjectId created:", new_id)
        p = Product(
            id=new_id,
            tenant_id="test",
            descripcion="test desc",
            precio_venta=10.0,
            categoria_id="test_cat"
        )
        print("Success Product creation:", p.id)
    except Exception as e:
         print("Error creating product:", type(e), str(e))

asyncio.run(main())
