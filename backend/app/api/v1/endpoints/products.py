from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pymongo import UpdateOne
import pandas as pd
import io
import math
import uuid
from pydantic import BaseModel
from app.models.product import Product
from app.models.category import Category
from app.models.user import User, UserRole
from app.auth import get_current_active_user

router = APIRouter()


class ProductCreate(BaseModel):
    descripcion: str
    categoria_id: str
    precio_venta: float
    costo_producto: float = 0.0
    codigo_largo: Optional[str] = None
    codigo_corto: Optional[str] = None
    image_url: Optional[str] = None


class ProductUpdate(BaseModel):
    descripcion: Optional[str] = None
    categoria_id: Optional[str] = None
    precio_venta: Optional[float] = None
    costo_producto: Optional[float] = None
    codigo_largo: Optional[str] = None
    codigo_corto: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None


async def _enrich(product: Product) -> Product:
    """Resolve categoria_nombre for display."""
    if product.categoria_id:
        cat = await Category.get(product.categoria_id)
        if cat:
            product.categoria_nombre = cat.name
    return product


@router.get("/products", response_model=List[Product])
async def get_products(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role == UserRole.SUPERADMIN:
        products = await Product.find_all().skip(skip).limit(limit).to_list()
    else:
        products = await Product.find(Product.tenant_id == current_user.tenant_id).skip(skip).limit(limit).to_list()
    return [await _enrich(p) for p in products]


@router.post("/products", response_model=Product)
async def create_product(
    data: ProductCreate,
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    tenant_id = current_user.tenant_id or "default"

    # Validate category belongs to tenant
    cat = await Category.get(data.categoria_id)
    if not cat or (current_user.role != UserRole.SUPERADMIN and cat.tenant_id != tenant_id):
        raise HTTPException(status_code=400, detail="Categoría no encontrada o no pertenece a tu empresa")

    # Validate codigo_corto uniqueness within tenant
    if data.codigo_corto:
        existing = await Product.find_one(
            Product.tenant_id == tenant_id,
            Product.codigo_corto == data.codigo_corto,
        )
        if existing:
            raise HTTPException(status_code=400, detail=f"El código corto '{data.codigo_corto}' ya existe en tu catálogo")

    product = Product(
        tenant_id=tenant_id,
        **data.model_dump(),
    )
    await product.create()
    return await _enrich(product)


@router.put("/products/{product_id}", response_model=Product)
async def update_product(
    product_id: str,
    data: ProductUpdate,
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    product = await Product.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if current_user.role != UserRole.SUPERADMIN and product.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Product not found")

    # Audit log
    from app.models.audit import AuditLog
    from app.models.cost_history import ProductCostHistory
    old = product.model_dump()
    updates = data.model_dump(exclude_none=True)
    changes = {k: {"old": old.get(k), "new": v} for k, v in updates.items() if old.get(k) != v}
    
    if changes:
        # P-02: Cost History Trigger
        if "costo_producto" in changes:
            await ProductCostHistory(
                tenant_id=product.tenant_id,
                producto_id=str(product.id),
                descripcion=product.descripcion,
                costo_anterior=old.get("costo_producto"),
                costo_nuevo=updates.get("costo_producto"),
                diferencia=round(updates.get("costo_producto") - old.get("costo_producto"), 4),
                motivo=None, # Motivo from Request could be added in schema later
                cambiado_por=str(current_user.id),
                cambiado_por_nombre=current_user.full_name or current_user.username
            ).create()

        await AuditLog(
            tenant_id=current_user.tenant_id,
            user_id=str(current_user.id),
            username=current_user.username,
            action="UPDATE", entity="PRODUCT",
            entity_id=product_id, details=changes,
        ).create()

    for field, value in updates.items():
        setattr(product, field, value)
    await product.save()
    return await _enrich(product)


@router.delete("/products/{product_id}")
async def deactivate_product(
    product_id: str,
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    product = await Product.get(product_id)
    if not product or (current_user.role != UserRole.SUPERADMIN and product.tenant_id != current_user.tenant_id):
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    await product.save()
    return {"message": "Product deactivated"}


@router.get("/productos/exportar-plantilla")
async def export_product_template(
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="No autorizado para exportar plantilla")
        
    tenant_id = current_user.tenant_id or "default"
    
    # Get categories for this tenant
    categories = await Category.find(Category.tenant_id == tenant_id, Category.is_active == True).to_list()
    
    # Create the Products sheet (Empty template with headers)
    df_products = pd.DataFrame(columns=["codigo_corto", "nombre", "precio_base", "id_categoria"])
    
    # Create the Categories sheet (Reference)
    cat_data = [{"ID Categoría": str(c.id), "Nombre": c.name} for c in categories]
    df_categories = pd.DataFrame(cat_data)
    
    # Generate Excel in memory
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_products.to_excel(writer, sheet_name='Productos', index=False)
        if not df_categories.empty:
            df_categories.to_excel(writer, sheet_name='Categorias (Guia)', index=False)
        else:
            pd.DataFrame([{"Mensaje": "No tienes categorías creadas"}]).to_excel(writer, sheet_name='Categorias (Guia)', index=False)
            
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=plantilla_productos.xlsx"}
    )


@router.post("/productos/importar")
async def import_products(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="No autorizado para importar productos")
        
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Formato de archivo inválido. Solo se permite .xlsx o .xls")
        
    tenant_id = current_user.tenant_id or "default"
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al leer el archivo Excel: {str(e)}")
        
    # Standardize columns
    df.columns = df.columns.astype(str).str.strip().str.lower()
    
    # Required columns
    required_cols = {"codigo_corto", "nombre", "precio_base", "id_categoria"}
    if not required_cols.issubset(set(df.columns)):
        missing = required_cols - set(df.columns)
        raise HTTPException(status_code=400, detail=f"Faltan columnas obligatorias en el archivo: {missing}")
        
    # Valid categories cache
    categories = await Category.find(Category.tenant_id == tenant_id, Category.is_active == True).to_list()
    valid_category_ids = {str(c.id) for c in categories}
    
    # Existing products cache
    products = await Product.find(Product.tenant_id == tenant_id).to_list()
    existing_products_map = {p.codigo_corto: p for p in products if p.codigo_corto}
    
    errores = []
    procesados = 0
    insertados = 0
    actualizados = 0
    fallidos = 0
    
    nuevos_productos = []
    operaciones_actualizacion = []
    
    for index, row in df.iterrows():
        procesados += 1
        fila_num = index + 2 # Header is row 1
        
        codigo_corto = str(row.get("codigo_corto", "")).strip()
        nombre = str(row.get("nombre", "")).strip()
        
        # Validar numérico
        try:
            val = row.get("precio_base", 0)
            if isinstance(val, str):
                val = val.replace(',', '')
            precio_base = float(val)
            if math.isnan(precio_base):
                precio_base = 0.0
        except ValueError:
            errores.append({"fila": fila_num, "motivo": f"El precio_base '{row.get('precio_base')}' no es numérico"})
            fallidos += 1
            continue
            
        id_categoria = str(row.get("id_categoria", "")).strip()
        
        # Validaciones de existencia
        if not codigo_corto or str(codigo_corto) == "nan":
            errores.append({"fila": fila_num, "motivo": "codigo_corto está vacío"})
            fallidos += 1
            continue
        if not nombre or str(nombre) == "nan":
            errores.append({"fila": fila_num, "motivo": "nombre está vacío"})
            fallidos += 1
            continue
        if id_categoria not in valid_category_ids:
            errores.append({"fila": fila_num, "motivo": f"La categoría '{id_categoria}' no existe o está inactiva"})
            fallidos += 1
            continue
            
        # Logica de Upsert
        if codigo_corto in existing_products_map:
            # Update (Bulk update con PyMongo)
            existing_product = existing_products_map[codigo_corto]
            operaciones_actualizacion.append(
                UpdateOne(
                    {"_id": existing_product.id},
                    {"$set": {
                        "descripcion": nombre,
                        "precio_venta": precio_base,
                        "categoria_id": id_categoria
                    }}
                )
            )
            actualizados += 1
        else:
            # Insertar (Bulk insert con Beanie)
            nuevo_prod = Product(
                tenant_id=tenant_id,
                codigo_corto=codigo_corto,
                descripcion=nombre,
                precio_venta=precio_base,
                categoria_id=id_categoria,
                codigo_sistema=str(uuid.uuid4())[:8].upper()
            )
            nuevos_productos.append(nuevo_prod)
            # Prevenir duplicados en el mismo archivo
            existing_products_map[codigo_corto] = nuevo_prod 
            insertados += 1

    if nuevos_productos:
        await Product.insert_many(nuevos_productos)
        
    if operaciones_actualizacion:
        # Intenta usar motor_collection
        collection = getattr(Product, "get_motor_collection", Product.get_pymongo_collection)()
        await collection.bulk_write(operaciones_actualizacion)
        
    return {
        "resumen": {
            "procesados": procesados,
            "insertados": insertados,
            "actualizados": actualizados,
            "fallidos": fallidos
        },
        "errores": errores
    }
