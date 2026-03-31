import os
import re

file_path = "backend/app/api/v1/endpoints/products.py"
service_path = "backend/app/services/product_service.py"

with open(file_path, "r", encoding="utf-8", errors="surrogateescape") as f:
    original_code = f.read()

# 1. GENERATE PRODUCT SERVICE
service_header = """import io
import math
import uuid
import pandas as pd
from typing import Optional, Dict, Any
from fastapi import HTTPException
from pymongo import UpdateOne
from bson import ObjectId

from app.models.product import Product
from app.models.category import Category
from app.models.user import User, UserRole
from app.models.sucursal import Sucursal
from app.models.inventario import Inventario, InventoryLog, TipoMovimiento
from app.schemas.product import ProductCreate, ProductUpdate

async def _enrich(product: Product) -> Product:
    if product.categoria_id:
        cat = await Category.get(product.categoria_id)
        if cat:
            product.categoria_nombre = cat.name
    return product

class ProductService:
"""

# We just take the bodies of the controllers and wrap them in @staticmethod in ProductService
# We can do this with regex.
service_body = ""

# create_product
create_match = re.search(r'async def create_product\([\s\S]*?return await _enrich\(product\)\n', original_code)
if create_match:
    func = create_match.group(0)
    func = func.replace("async def create_product(\n    data: ProductCreate,\n    current_user: User = Depends(get_current_active_user)\n):", "    @staticmethod\n    async def create_product(data: ProductCreate, current_user: User) -> Product:")
    # Fix indentation
    lines = func.split("\n")
    fixed = lines[0] + "\n" + lines[1] + "\n" + "\n".join("    " + line for line in lines[2:])
    service_body += fixed + "\n"

# update_product
update_match = re.search(r'async def update_product\([\s\S]*?return await _enrich\(product\)\n', original_code)
if update_match:
    func = update_match.group(0)
    func = func.replace("async def update_product(\n    product_id: str,\n    data: ProductUpdate,\n    current_user: User = Depends(get_current_active_user)\n):", "    @staticmethod\n    async def update_product(product_id: str, data: ProductUpdate, current_user: User) -> Product:")
    lines = func.split("\n")
    fixed = lines[0] + "\n" + lines[1] + "\n" + "\n".join("    " + line for line in lines[2:])
    service_body += fixed + "\n"

# deactivate_product
deactiv_match = re.search(r'async def deactivate_product\([\s\S]*?return \{"message": "Product deactivated"\}\n', original_code)
if deactiv_match:
    func = deactiv_match.group(0)
    func = func.replace("async def deactivate_product(\n    product_id: str,\n    current_user: User = Depends(get_current_active_user)\n):", "    @staticmethod\n    async def deactivate_product(product_id: str, current_user: User):")
    lines = func.split("\n")
    fixed = lines[0] + "\n" + lines[1] + "\n" + "\n".join("    " + line for line in lines[2:])
    service_body += fixed + "\n"

# import_products
import_match = re.search(r'async def import_products\([\s\S]*?    \}\n', original_code)
if import_match:
    func = import_match.group(0)
    func = func.replace("async def import_products(\n    file: UploadFile = File(...),\n    current_user: User = Depends(get_current_active_user)\n):", "    @staticmethod\n    async def import_products(file_bytes: bytes, filename: str, current_user: User):")
    func = func.replace("contents = await file.read()", "contents = file_bytes")
    lines = func.split("\n")
    fixed = lines[0] + "\n" + lines[1] + "\n" + "\n".join("    " + line for line in lines[2:])
    service_body += fixed + "\n"

# importacion_global_excel
glob_match = re.search(r'async def importacion_global_excel\([\s\S]*?    \}\n', original_code)
if glob_match:
    func = glob_match.group(0)
    func = func.replace("async def importacion_global_excel(\n    file: UploadFile = File(...),\n    current_user: User = Depends(get_current_active_user)\n):", "    @staticmethod\n    async def importacion_global_excel(file_bytes: bytes, filename: str, current_user: User):")
    func = func.replace("contents = await file.read()", "contents = file_bytes")
    lines = func.split("\n")
    fixed = lines[0] + "\n" + lines[1] + "\n" + "\n".join("    " + line for line in lines[2:])
    service_body += fixed + "\n"

# import_product_prices
prices_match = re.search(r'async def import_product_prices\([\s\S]*?    \}\n', original_code)
if prices_match:
    func = prices_match.group(0)
    func = func.replace("async def import_product_prices(\n    sucursal_id: str = Form(...),\n    file: UploadFile = File(...),\n    current_user: User = Depends(get_current_active_user)\n):", "    @staticmethod\n    async def import_product_prices(sucursal_id: str, file_bytes: bytes, filename: str, current_user: User):")
    func = func.replace("contents = await file.read()", "contents = file_bytes")
    lines = func.split("\n")
    fixed = lines[0] + "\n" + lines[1] + "\n" + "\n".join("    " + line for line in lines[2:])
    service_body += fixed + "\n"

with open(service_path, "w", encoding="utf-8") as f:
    f.write(service_header + service_body)


# 2. GENERATE AND SWAP ENDPOINTS
content = original_code

new_create = '''@router.post("/products", response_model=Product)
async def create_product(
    data: ProductCreate,
    current_user: User = Depends(get_current_active_user)
):
    from app.services.product_service import ProductService
    return await ProductService.create_product(data, current_user)
'''
content = re.sub(r'@router\.post\("/products", response_model=Product\)\nasync def create_product\([\s\S]*?return await _enrich\(product\)\n', new_create, content, count=1)

new_update = '''@router.put("/products/{product_id}", response_model=Product)
async def update_product(
    product_id: str,
    data: ProductUpdate,
    current_user: User = Depends(get_current_active_user)
):
    from app.services.product_service import ProductService
    return await ProductService.update_product(product_id, data, current_user)
'''
content = re.sub(r'@router\.put\("/products/\{product_id\}", response_model=Product\)\nasync def update_product\([\s\S]*?return await _enrich\(product\)\n', new_update, content, count=1)

new_deactivate = '''@router.delete("/products/{product_id}")
async def deactivate_product(
    product_id: str,
    current_user: User = Depends(get_current_active_user)
):
    from app.services.product_service import ProductService
    return await ProductService.deactivate_product(product_id, current_user)
'''
content = re.sub(r'@router\.delete\("/products/\{product_id\}"\)\nasync def deactivate_product\([\s\S]*?return \{"message": "Product deactivated"\}\n', new_deactivate, content, count=1)


new_import = '''@router.post("/productos/importar")
async def import_products(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    from app.services.product_service import ProductService
    contents = await file.read()
    return await ProductService.import_products(contents, file.filename, current_user)
'''
content = re.sub(r'@router\.post\("/productos/importar"\)\nasync def import_products\([\s\S]*?    \}\n', new_import, content, count=1)

new_glob = '''@router.post("/productos/importacion-global")
async def importacion_global_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    from app.services.product_service import ProductService
    contents = await file.read()
    return await ProductService.importacion_global_excel(contents, file.filename, current_user)
'''
content = re.sub(r'@router\.post\("/productos/importacion-global"\)\nasync def importacion_global_excel\([\s\S]*?    \}\n', new_glob, content, count=1)

new_prices = '''@router.post("/productos/importar-precios")
async def import_product_prices(
    sucursal_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    from app.services.product_service import ProductService
    contents = await file.read()
    return await ProductService.import_product_prices(sucursal_id, contents, file.filename, current_user)
'''
content = re.sub(r'@router\.post\("/productos/importar-precios"\)\nasync def import_product_prices\([\s\S]*?    \}\n', new_prices, content, count=1)

with open(file_path, "w", encoding="utf-8", errors="surrogateescape") as f:
    f.write(content)

print("Product API routing swapped to Services successfully.")
