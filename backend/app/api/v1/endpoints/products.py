from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from pymongo import UpdateOne
import pandas as pd
import io
import math
import uuid
from app.schemas.product import ProductCreate, ProductUpdate
from app.models.product import Product
from app.models.category import Category
from app.models.user import User, UserRole
from app.models.sucursal import Sucursal
from app.models.inventario import Inventario, InventoryLog, TipoMovimiento
from app.auth import get_current_active_user

router = APIRouter()
async def _enrich(product: Product) -> Product:
    """Resolve categoria_nombre for display."""
    if product.categoria_id:
        cat = await Category.get(product.categoria_id)
        if cat:
            product.categoria_nombre = cat.name
    return product


@router.get("/products", response_model=dict)
async def get_products(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=2000),
    search: Optional[str] = Query(default=None, description="Filtrar por nombre/descripción"),
    categoria_id: Optional[str] = Query(default=None, description="Filtrar por categoría"),
    current_user: User = Depends(get_current_active_user)
):
    from beanie.operators import RegEx
    
    skip = (page - 1) * limit
    base_filter = []
    
    if current_user.role != UserRole.SUPERADMIN:
        base_filter.append(Product.tenant_id == current_user.tenant_id)

    if search and search.strip():
        # Search by description or codigo_corto
        from beanie.operators import Or
        base_filter.append(
            Or(
                RegEx(Product.descripcion, search, options="i"),
                RegEx(Product.codigo_corto, search, options="i")
            )
        )
        
    if categoria_id and categoria_id != "ALL":
        base_filter.append(Product.categoria_id == categoria_id)

    query = Product.find(*base_filter) if base_filter else Product.find_all()
    
    total = await query.count()
    products = await query.skip(skip).limit(limit).to_list()
        
    p_ids = [str(p.id) for p in products]
    from beanie.operators import In
    
    if current_user.sucursal_id:
        invs = await Inventario.find(In(Inventario.producto_id, p_ids), Inventario.sucursal_id == current_user.sucursal_id).to_list()
        price_map = {i.producto_id: i.precio_sucursal for i in invs if i.precio_sucursal is not None}
        for p in products:
            if str(p.id) in price_map:
                p.precio_venta = price_map[str(p.id)]
            p.precios_sucursales = {} # Hide from branch
    else:
        invs = await Inventario.find(In(Inventario.producto_id, p_ids)).to_list()
        p_map = {str(p.id): {} for p in products}
        for i in invs:
            if i.precio_sucursal is not None:
                p_map[str(i.producto_id)][i.sucursal_id] = i.precio_sucursal
        for p in products:
            p.precios_sucursales = p_map.get(str(p.id), {})

    items = [await _enrich(p) for p in products]
    
    import math
    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if limit > 0 else 1
    }


@router.post("/products", response_model=Product)
async def create_product(
    data: ProductCreate,
    current_user: User = Depends(get_current_active_user)
):
    from app.services.product_service import ProductService
    return await ProductService.create_product(data, current_user)


@router.put("/products/{product_id}", response_model=Product)
async def update_product(
    product_id: str,
    data: ProductUpdate,
    current_user: User = Depends(get_current_active_user)
):
    from app.services.product_service import ProductService
    return await ProductService.update_product(product_id, data, current_user)


@router.delete("/products/{product_id}")
async def deactivate_product(
    product_id: str,
    current_user: User = Depends(get_current_active_user)
):
    from app.services.product_service import ProductService
    return await ProductService.deactivate_product(product_id, current_user)


@router.get("/productos/exportar-plantilla")
async def export_product_template(
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="No autorizado para exportar plantilla")
        
    tenant_id = current_user.tenant_id or "default"
    
    categories = await Category.find(Category.tenant_id == tenant_id, Category.is_active == True).to_list()
    sucursales = await Sucursal.find(Sucursal.tenant_id == tenant_id).to_list()
    
    # Construir cabeceras maestras
    headers = ["CODIGO", "CODIGO CORTO", "DESCRIPCION", "COSTO UNITARIO", "CATEGORIA"]
    
    # Agregar cabecera de precio por cada sucursal
    for s in sucursales:
        clean_name = s.nombre.replace(" ", "").upper()
        headers.append(f"PRECIO PUBLICO {clean_name}")
        
    df_products = pd.DataFrame(columns=headers)
    
    cat_data = [{"ID Categoría": str(c.id), "Nombre": c.name} for c in categories]
    df_categories = pd.DataFrame(cat_data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_products.to_excel(writer, sheet_name='Catálogo', index=False)
        if not df_categories.empty:
            df_categories.to_excel(writer, sheet_name='Categorias (Guia)', index=False)
        else:
            pd.DataFrame([{"Mensaje": "No tienes categorías creadas"}]).to_excel(writer, sheet_name='Categorias (Guia)', index=False)
            
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=plantilla_maestra_catalogo.xlsx"}
    )


@router.post("/productos/importar")
async def import_products(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    from app.services.product_service import ProductService
    contents = await file.read()
    return await ProductService.import_products(contents, file.filename, current_user)


@router.post("/productos/importacion-global")
async def importacion_global_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    from app.services.product_service import ProductService
    contents = await file.read()
    return await ProductService.importacion_global_excel(contents, file.filename, current_user)


@router.get("/productos/exportar-plantilla-precios")
async def export_product_price_template(
    sucursal_id: str,
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="No autorizado para exportar plantilla de precios")
        
    tenant_id = current_user.tenant_id or "default"
    
    # Validar sucursal
    sucursal = await Sucursal.get(sucursal_id)
    if not sucursal or (current_user.role != UserRole.SUPERADMIN and sucursal.tenant_id != tenant_id):
        raise HTTPException(status_code=400, detail="Sucursal no encontrada o no pertenece a tu empresa")
        
    products = await Product.find(Product.tenant_id == tenant_id, Product.is_active == True).to_list()
    
    # Obtener inventarios p/ precio actual
    invs = await Inventario.find(Inventario.sucursal_id == sucursal_id).to_list()
    price_map = {str(i.producto_id): i.precio_sucursal for i in invs}
    
    headers = ["CODIGO CORTO", "DESCRIPCION", "PRECIO ACTUAL", "NUEVO PRECIO"]
    data = []
    
    for p in products:
        if not p.codigo_corto: continue
        precio_actual = price_map.get(str(p.id))
        
        data.append({
            "CODIGO CORTO": p.codigo_corto,
            "DESCRIPCION": p.descripcion,
            "PRECIO ACTUAL": precio_actual if precio_actual is not None else p.precio_venta,
            "NUEVO PRECIO": "" # Usuario llena esto
        })
        
    df = pd.DataFrame(data, columns=headers)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='ActualizacionPrecios', index=False)
        
    output.seek(0)
    clean_name = sucursal.nombre.replace(" ", "_").lower()
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=plantilla_precios_{clean_name}.xlsx"}
    )


@router.post("/productos/importar-precios")
async def import_product_prices(
    sucursal_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    from app.services.product_service import ProductService
    contents = await file.read()
    return await ProductService.import_product_prices(sucursal_id, contents, file.filename, current_user)
