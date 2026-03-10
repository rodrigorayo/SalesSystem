import asyncio
from bson import ObjectId
from app.models.product import Product
import uuid
import traceback

def main():
    try:
        new_object_id = ObjectId()
        print("ObjectId created:", new_object_id)
        prod = Product(
            id=new_object_id,
            tenant_id="test",
            descripcion="test",
            categoria_id="cat",
            precio_venta=10.0
        )
        print("Product created successfully")
    except Exception as e:
        print("Error:")
        traceback.print_exc()

if __name__ == "__main__":
    main()
