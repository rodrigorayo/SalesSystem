from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
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
from app.models.sucursal import Sucursal
from app.models.inventario import Inventario, InventoryLog, TipoMovimiento
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
    precios_sucursales: Optional[dict[str, float]] = None


class ProductUpdate(BaseModel):
    descripcion: Optional[str] = None
    categoria_id: Optional[str] = None
    precio_venta: Optional[float] = None
    costo_producto: Optional[float] = None
    codigo_largo: Optional[str] = None
    codigo_corto: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    precios_sucursales: Optional[dict[str, float]] = None


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
        **data.model_dump(exclude={"precios_sucursales"}),
    )
    await product.create()
    
    if data.precios_sucursales:
        from pymongo import UpdateOne
        ops = []
        for suc_id, precio in data.precios_sucursales.items():
            if precio is not None and precio >= 0:
                ops.append(
                    UpdateOne(
                        {"tenant_id": tenant_id, "sucursal_id": suc_id, "producto_id": str(product.id)},
                        {
                            "$setOnInsert": {"cantidad": 0},
                            "$set": {"precio_sucursal": precio},
                            "$currentDate": {"updated_at": True}
                        },
                        upsert=True
                    )
                )
        if ops:
            await Inventario.get_motor_collection().bulk_write(ops)
            
    product.precios_sucursales = data.precios_sucursales or {}
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
        if field == "precios_sucursales": continue
        setattr(product, field, value)
    await product.save()
    
    if "precios_sucursales" in updates and updates["precios_sucursales"] is not None:
        from pymongo import UpdateOne
        precios = updates["precios_sucursales"]
        ops = []
        for suc_id, precio in precios.items():
            if precio is not None and precio >= 0:
                ops.append(
                    UpdateOne(
                        {"tenant_id": product.tenant_id, "sucursal_id": suc_id, "producto_id": str(product.id)},
                        {
                            "$setOnInsert": {"cantidad": 0},
                            "$set": {"precio_sucursal": precio},
                            "$currentDate": {"updated_at": True}
                        },
                        upsert=True
                    )
                )
        if ops:
            await Inventario.get_motor_collection().bulk_write(ops)
        product.precios_sucursales = precios
    else:
        # Load them to return properly to admin
        invs = await Inventario.find(Inventario.producto_id == str(product.id)).to_list()
        product.precios_sucursales = {i.sucursal_id: i.precio_sucursal for i in invs if i.precio_sucursal is not None}
        
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
    required_cols = {"codigo_corto", "nombre", "id_categoria"}
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


@router.post("/productos/importacion-global")
async def importacion_global_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """
    Súper Endpoint a Medida: Sube el Catálogo Maestro y el Inventario Físico de TODAS las sucursales a la vez.
    Opcional: Crea categorías al vuelo que no existan.
    Las columnas esperadas: CODIGO CORTO (o CODIGO_CORTO), DESCRIPCION, PRECIO PUBLICO, CATEGORIA.
    Para el inventario físico, usar la cabecera "INV_..." (ej: INV_CENTRAL).
    """
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="No autorizado para la importación global")
        
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Formato inválido. Solo .xlsx o .xls")
        
    tenant_id = current_user.tenant_id or "default"
    
    from bson import ObjectId
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error leyendo origen Excel: {str(e)}")
        
    df.columns = df.columns.astype(str).str.strip().str.upper()
    df.columns = df.columns.str.replace(' ', '_')
    
    if "CATEGORIA" not in df.columns:
        raise HTTPException(status_code=400, detail="Falta columna obligatoria: CATEGORIA")
        
    nombres_categorias_excel = df['CATEGORIA'].dropna().unique()
    
    # 1. CATEGORÍAS
    categorias_db = await Category.find(Category.tenant_id == tenant_id).to_list()
    cat_map = {c.name.strip().upper(): c for c in categorias_db}
    
    categorias_a_insertar = []
    for cat_name in nombres_categorias_excel:
        cat_key = str(cat_name).strip().upper()
        if cat_key and cat_key not in cat_map:
            new_cat_id = ObjectId()
            nueva_cat = Category(
                id=new_cat_id,
                tenant_id=tenant_id, 
                name=str(cat_name).strip().capitalize(), 
                is_active=True
            )
            categorias_a_insertar.append(nueva_cat)
            cat_map[cat_key] = nueva_cat
            
    if categorias_a_insertar:
        await Category.insert_many(categorias_a_insertar)
        
    # 2. SUCURSALES (Multi-stock)
    sucursales_db = await Sucursal.find(Sucursal.tenant_id == tenant_id).to_list()
    suc_map = {}
    for s in sucursales_db:
        clean_name = s.nombre.replace(" ", "").upper()
        suc_map[clean_name] = str(s.id)
    suc_map["CENTRAL"] = "CENTRAL" # Fallback mapping
    
    inv_columns = [col for col in df.columns if col.startswith("INV_") or col.startswith("INVENTARIO_")]
    col_to_sucursal_id = {}
    
    for col in inv_columns:
        if col.startswith("INV_"):
            suc_name = col.replace("INV_", "").replace(" ", "").upper()
        else:
            suc_name = col.replace("INVENTARIO_FISICO_", "").replace("INVENTARIO_", "").replace("_", "").replace("\n", "").replace(" ", "").upper()
            
        if suc_name in suc_map:
            col_to_sucursal_id[col] = suc_map[suc_name]
            
    precio_cols = [col for col in df.columns if col.startswith("PRECIO_PUBLICO_") and col != "PRECIO_PUBLICO"]
    col_to_precio_sucursal_id = {}
    for col in precio_cols:
        suc_name = col.replace("PRECIO_PUBLICO_", "").replace(" ", "").upper()
        if suc_name in suc_map:
            col_to_precio_sucursal_id[col] = suc_map[suc_name]
            
    # 3. PROCESAR CATÁLOGO E INVENTARIO
    productos_db = await Product.find(Product.tenant_id == tenant_id).to_list()
    prod_map = {p.codigo_corto: p for p in productos_db if p.codigo_corto}
    
    inventarios_db = await Inventario.find(Inventario.tenant_id == tenant_id).to_list()
    inv_map = {}
    for i in inventarios_db:
        if i.sucursal_id not in inv_map:
            inv_map[i.sucursal_id] = {}
        inv_map[i.sucursal_id][str(i.producto_id)] = i

    operaciones_catalogo = []
    productos_a_insertar = []
    operaciones_inventario = []
    logs_inventario = []
    
    errores = []
    procesados = 0
    cat_procesados = 0
    inv_procesados = 0
    
    from bson import ObjectId
    
    def clean_codigo(val):
        s = str(val).strip()
        if s.endswith('.0'): s = s[:-2]
        if s.lower() == 'nan': return ""
        return s

    for index, row in df.iterrows():
        procesados += 1
        fila_num = index + 2
        
        # CODIGO CORTO validation
        codigo_corto = clean_codigo(row.get("CODIGO_CORTO", row.get("CODIGOCORTO", "")))
        if not codigo_corto:
             codigo_corto = clean_codigo(row.get("CODIGO", ""))
             
        if not codigo_corto:
            errores.append({"fila": fila_num, "motivo": "Falta CODIGO o CODIGO CORTO"})
            continue
            
        descripcion = str(row.get("DESCRIPCION", "")).strip()
        
        # Parse precios safely
        def safe_float(val):
            try:
                return float(val) if pd.notnull(val) else 0.0
            except: return 0.0
            
        precio_publico = safe_float(row.get("PRECIO_PUBLICO", 0))
        costo_unitario = safe_float(row.get("COSTO_UNITARIO", 0))
        codigo_largo = str(row.get("CODIGO", "")).strip()
        if codigo_largo == "nan": codigo_largo = ""
        
        cat_str = str(row.get("CATEGORIA", "")).strip().upper()
        categoria_id = str(cat_map.get(cat_str).id) if (cat_str in cat_map and cat_map[cat_str].id) else ""
        if not categoria_id:
            errores.append({"fila": fila_num, "motivo": "Falta categoría o id de categoría no encontrado"})
            continue
        
        product_id = ""
        
        # -- CATÁLOGO UPSERT --
        if codigo_corto in prod_map:
            # Producto existe: Se actualiza
            p = prod_map[codigo_corto]
            product_id = str(p.id)
            # Evitar sobreescribir con valores nulos si no vienen en este excel
            update_fields = {}
            if descripcion: update_fields["descripcion"] = descripcion
            if precio_publico > 0: update_fields["precio_venta"] = precio_publico
            if costo_unitario > 0: update_fields["costo_producto"] = costo_unitario
            if categoria_id: update_fields["categoria_id"] = categoria_id
            if codigo_largo: update_fields["codigo_largo"] = codigo_largo
            
            if update_fields:
                operaciones_catalogo.append(
                    UpdateOne({"_id": p.id}, {"$set": update_fields})
                )
            cat_procesados += 1
            
        else:
            # Producto nuevo: Se inserta
            nuevo_prod = Product(
                tenant_id=tenant_id,
                descripcion=descripcion or "S/N",
                precio_venta=precio_publico,
                costo_producto=costo_unitario,
                categoria_id=categoria_id,
                codigo_corto=codigo_corto,
                codigo_sistema=str(uuid.uuid4())[:8].upper(),
                codigo_largo=codigo_largo if codigo_largo else None,
                is_active=True
            )
            product_id = str(nuevo_prod.id)
            productos_a_insertar.append(nuevo_prod)
            prod_map[codigo_corto] = nuevo_prod
            cat_procesados += 1
            
        # -- PRECIOS POR SUCURSAL (Sin alterar inventario físico, solo precio_sucursal) --
        for col in precio_cols:
            if col in col_to_precio_sucursal_id:
                suc_val = col_to_precio_sucursal_id[col]
                precio_suc = safe_float(row.get(col, 0))
                
                if precio_suc > 0:
                    precio_anterior = None
                    if suc_val in inv_map and product_id in inv_map[suc_val]:
                        precio_anterior = inv_map[suc_val][product_id].precio_sucursal
                        
                    if precio_suc != precio_anterior:
                        operaciones_inventario.append(
                            UpdateOne(
                                {
                                    "tenant_id": tenant_id,
                                    "sucursal_id": suc_val,
                                    "producto_id": product_id
                                },
                                {
                                    "$setOnInsert": {
                                        "tenant_id": tenant_id,
                                        "sucursal_id": suc_val,
                                        "producto_id": product_id,
                                        "cantidad": 0
                                    },
                                    "$set": {"precio_sucursal": precio_suc},
                                    "$currentDate": {"updated_at": True}
                                },
                                upsert=True
                            )
                        )
                    
        # -- INVENTARIO UPSERT --
        for col in inv_columns:
            if col in col_to_sucursal_id:
                suc_val = col_to_sucursal_id[col]
                valor_celda = row.get(col, 0)
                
                try:
                    cantidad_fisica = float(valor_celda) if pd.notnull(valor_celda) else 0.0
                except:
                    cantidad_fisica = 0.0
                    
                stock_anterior = 0.0
                if suc_val in inv_map and product_id in inv_map[suc_val]:
                    stock_anterior = inv_map[suc_val][product_id].cantidad
                    
                # Sólo ajustar si el excel marca una cantidad diferente al stock en bd
                if cantidad_fisica != stock_anterior:
                    diff = cantidad_fisica - stock_anterior
                    
                    operaciones_inventario.append(
                        UpdateOne(
                            {
                                "tenant_id": tenant_id,
                                "sucursal_id": suc_val,
                                "producto_id": product_id
                            },
                            {
                                "$setOnInsert": {
                                    "tenant_id": tenant_id,
                                    "sucursal_id": suc_val,
                                    "producto_id": product_id,
                                    "precio_sucursal": None
                                },
                                "$inc": {"cantidad": diff},
                                "$currentDate": {"updated_at": True}
                            },
                            upsert=True
                        )
                    )
                    
                    logs_inventario.append(InventoryLog(
                        tenant_id=tenant_id,
                        sucursal_id=suc_val,
                        producto_id=product_id,
                        tipo_movimiento=TipoMovimiento.AJUSTE_FISICO,
                        cantidad_movida=int(diff),
                        stock_resultante=int(cantidad_fisica),
                        usuario_id=str(current_user.id),
                        usuario_nombre=current_user.full_name or current_user.username,
                        notas="Súper Importación: Auto-Ajuste desde Excel A Medida."
                    ))
                    inv_procesados += 1

    # EJECUTAR TODOS LOS BULK
    if productos_a_insertar:
        await Product.insert_many(productos_a_insertar)
        
    if operaciones_catalogo:
        col_prod = getattr(Product, "get_motor_collection", Product.get_pymongo_collection)()
        await col_prod.bulk_write(operaciones_catalogo)
        
    if logs_inventario:
        await InventoryLog.insert_many(logs_inventario)
        
    if operaciones_inventario:
        col_inv = getattr(Inventario, "get_motor_collection", Inventario.get_pymongo_collection)()
        await col_inv.bulk_write(operaciones_inventario)
        
    sucess_msg = [f"Sucursales vinculadas a columnas Excel: {list({k: v for k, v in col_to_sucursal_id.items()}.keys())}"]
    
    return {
        "resumen": {
            "filas_leidas": procesados,
            "productos_catalogo_afectados": cat_procesados,
            "ajustes_inventario_generados": inv_procesados,
            "detalles": sucess_msg
        },
        "errores": errores
    }


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
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="No autorizado para importar precios")
        
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Formato de archivo inválido. Solo se permite .xlsx o .xls")
        
    tenant_id = current_user.tenant_id or "default"
    
    # Validar sucursal
    sucursal = await Sucursal.get(sucursal_id)
    if not sucursal or (current_user.role != UserRole.SUPERADMIN and sucursal.tenant_id != tenant_id):
        raise HTTPException(status_code=400, detail="Sucursal no encontrada")
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al leer el archivo Excel: {str(e)}")
        
    # Standardize columns
    df.columns = df.columns.astype(str).str.strip().str.upper()
    df.columns = df.columns.str.replace(' ', '_')
    
    if "CODIGO_CORTO" not in df.columns or "NUEVO_PRECIO" not in df.columns:
        raise HTTPException(status_code=400, detail="Faltan columnas obligatorias: CODIGO_CORTO o NUEVO_PRECIO")
        
    products = await Product.find(Product.tenant_id == tenant_id).to_list()
    prod_map = {p.codigo_corto: p for p in products if p.codigo_corto}
    
    errores = []
    procesados = 0
    actualizados = 0
    ignorados = 0
    
    operaciones_inventario = []
    
    for index, row in df.iterrows():
        procesados += 1
        fila_num = index + 2
        
        codigo_corto = str(row.get("CODIGO_CORTO", "")).strip()
        if not codigo_corto or codigo_corto == "nan":
            errores.append({"fila": fila_num, "motivo": "Falta CODIGO_CORTO"})
            ignorados += 1
            continue
            
        nuevo_precio_val = row.get("NUEVO_PRECIO")
        if pd.isna(nuevo_precio_val) or str(nuevo_precio_val).strip() == "":
            ignorados += 1 # Empty price ignored
            continue
            
        try:
            nuevo_precio = float(nuevo_precio_val)
            if math.isnan(nuevo_precio) or nuevo_precio < 0:
                raise ValueError()
        except ValueError:
            errores.append({"fila": fila_num, "motivo": f"Precio '{nuevo_precio_val}' inválido"})
            ignorados += 1
            continue
            
        if codigo_corto not in prod_map:
            errores.append({"fila": fila_num, "motivo": f"Producto con código '{codigo_corto}' no existe en la base de datos"})
            ignorados += 1
            continue
            
        p = prod_map[codigo_corto]
        product_id = str(p.id)
        
        operaciones_inventario.append(
            UpdateOne(
                {
                    "tenant_id": tenant_id,
                    "sucursal_id": sucursal_id,
                    "producto_id": product_id
                },
                {
                    "$setOnInsert": {
                        "tenant_id": tenant_id,
                        "sucursal_id": sucursal_id,
                        "producto_id": product_id,
                        "cantidad": 0
                    },
                    "$set": {"precio_sucursal": nuevo_precio},
                    "$currentDate": {"updated_at": True}
                },
                upsert=True
            )
        )
        actualizados += 1
        
    if operaciones_inventario:
        col_inv = getattr(Inventario, "get_motor_collection", Inventario.get_pymongo_collection)()
        await col_inv.bulk_write(operaciones_inventario)
        
    return {
        "resumen": {
            "filas_leidas": procesados,
            "precios_actualizados": actualizados,
            "filas_ignoradas": ignorados,
            "errores": len(errores)
        },
        "errores": errores
    }
