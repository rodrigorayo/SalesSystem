import io
import math
import uuid
import pandas as pd
from fastapi import HTTPException
from pymongo import UpdateOne
from bson import ObjectId

from app.domain.models.product import Product
from app.domain.models.category import Category
from app.domain.models.user import User, UserRole
from app.domain.models.sucursal import Sucursal
from app.domain.models.inventario import Inventario, InventoryLog, TipoMovimiento

class ExcelImportService:
    @staticmethod
    async def import_products(file_bytes: bytes, filename: str, current_user: User):
        if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
            raise HTTPException(status_code=403, detail="No autorizado para importar productos")
            
        if not filename.endswith((".xlsx", ".xls")):
            raise HTTPException(status_code=400, detail="Formato de archivo inválido. Solo se permite .xlsx o .xls")
            
        tenant_id = current_user.tenant_id or "default"
        
        try:
            df = pd.read_excel(io.BytesIO(file_bytes))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error al leer el archivo Excel: {str(e)}")
            
        df.columns = df.columns.astype(str).str.strip().str.lower()
        
        required_cols = {"codigo_corto", "nombre", "id_categoria"}
        if not required_cols.issubset(set(df.columns)):
            missing = required_cols - set(df.columns)
            raise HTTPException(status_code=400, detail=f"Faltan columnas obligatorias en el archivo: {missing}")
            
        categories = await Category.find(Category.tenant_id == tenant_id, Category.is_active == True).to_list()
        valid_category_ids = {str(c.id) for c in categories}
        
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
            fila_num = index + 2
            
            codigo_corto = str(row.get("codigo_corto", "")).strip()
            nombre = str(row.get("nombre", "")).strip()
            proveedor = str(row.get("proveedor", "")).strip()
            if proveedor == "nan": proveedor = ""
            
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
                
            if codigo_corto in existing_products_map:
                existing_product = existing_products_map[codigo_corto]
                updates = {
                    "descripcion": nombre,
                    "precio_venta": precio_base,
                    "categoria_id": id_categoria
                }
                if proveedor:
                    updates["proveedor"] = proveedor
                    
                operaciones_actualizacion.append(
                    UpdateOne(
                        {"_id": existing_product.id},
                        {"$set": updates}
                    )
                )
                actualizados += 1
            else:
                nuevo_prod = Product(
                    tenant_id=tenant_id,
                    codigo_corto=codigo_corto,
                    descripcion=nombre,
                    precio_venta=precio_base,
                    categoria_id=id_categoria,
                    codigo_sistema=str(uuid.uuid4())[:8].upper(),
                    proveedor=proveedor if proveedor else None
                )
                nuevos_productos.append(nuevo_prod)
                existing_products_map[codigo_corto] = nuevo_prod 
                insertados += 1
    
        if nuevos_productos:
            await Product.insert_many(nuevos_productos)
            
        if operaciones_actualizacion:
            collection = Product.get_pymongo_collection()
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
    
    @staticmethod
    async def importacion_global_excel(file_bytes: bytes, filename: str, current_user: User):
        if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
            raise HTTPException(status_code=403, detail="No autorizado para la importación global")
            
        if not filename.endswith((".xlsx", ".xls")):
            raise HTTPException(status_code=400, detail="Formato inválido. Solo .xlsx o .xls")
            
        tenant_id = current_user.tenant_id or "default"
        
        try:
            df = pd.read_excel(io.BytesIO(file_bytes))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error leyendo origen Excel: {str(e)}")
            
        df.columns = df.columns.astype(str).str.strip().str.upper()
        df.columns = df.columns.str.replace(' ', '_')
        
        if "CATEGORIA" not in df.columns:
            raise HTTPException(status_code=400, detail="Falta columna obligatoria: CATEGORIA")
            
        nombres_categorias_excel = df['CATEGORIA'].dropna().unique()
        
        categorias_db = await Category.find(Category.tenant_id == tenant_id).to_list()
        cat_map = {c.name.strip().upper(): c for c in categorias_db}
        
        categorias_a_insertar = []
        for cat_name in nombres_categorias_excel:
            cat_key = str(cat_name).strip().upper()
            if cat_key and cat_key not in cat_map:
                nueva_cat = Category(
                    id=ObjectId(),
                    tenant_id=tenant_id, 
                    name=str(cat_name).strip().capitalize(), 
                    is_active=True
                )
                categorias_a_insertar.append(nueva_cat)
                cat_map[cat_key] = nueva_cat
                
        if categorias_a_insertar:
            await Category.insert_many(categorias_a_insertar)
            
        sucursales_db = await Sucursal.find(Sucursal.tenant_id == tenant_id).to_list()
        suc_map = {}
        for s in sucursales_db:
            clean_name = s.nombre.replace(" ", "").upper()
            suc_map[clean_name] = str(s.id)
        suc_map["CENTRAL"] = "CENTRAL"
        
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
        
        def clean_codigo(val):
            s = str(val).strip()
            if s.endswith('.0'): s = s[:-2]
            if s.lower() == 'nan': return ""
            return s
    
        for index, row in df.iterrows():
            procesados += 1
            fila_num = index + 2
            
            codigo_corto = clean_codigo(row.get("CODIGO_CORTO", row.get("CODIGOCORTO", "")))
            if not codigo_corto:
                 codigo_corto = clean_codigo(row.get("CODIGO", ""))
                 
            if not codigo_corto:
                errores.append({"fila": fila_num, "motivo": "Falta CODIGO o CODIGO CORTO"})
                continue
                
            descripcion = str(row.get("DESCRIPCION", "")).strip()
            proveedor = str(row.get("PROVEEDOR", "")).strip()
            if proveedor == "nan": proveedor = ""
            
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
            
            if codigo_corto in prod_map:
                p = prod_map[codigo_corto]
                product_id = str(p.id)
                update_fields = {}
                if descripcion: update_fields["descripcion"] = descripcion
                if precio_publico > 0: update_fields["precio_venta"] = precio_publico
                if costo_unitario > 0: update_fields["costo_producto"] = costo_unitario
                if categoria_id: update_fields["categoria_id"] = categoria_id
                if codigo_largo: update_fields["codigo_largo"] = codigo_largo
                if proveedor: update_fields["proveedor"] = proveedor
                
                if update_fields:
                    operaciones_catalogo.append(
                        UpdateOne({"_id": p.id}, {"$set": update_fields})
                    )
                cat_procesados += 1
                
            else:
                nuevo_prod = Product(
                    tenant_id=tenant_id,
                    descripcion=descripcion or "S/N",
                    precio_venta=precio_publico,
                    costo_producto=costo_unitario,
                    categoria_id=categoria_id,
                    codigo_corto=codigo_corto,
                    codigo_sistema=str(uuid.uuid4())[:8].upper(),
                    codigo_largo=codigo_largo if codigo_largo else None,
                    proveedor=proveedor if proveedor else None,
                    is_active=True
                )
                product_id = str(nuevo_prod.id)
                productos_a_insertar.append(nuevo_prod)
                prod_map[codigo_corto] = nuevo_prod
                cat_procesados += 1
                
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
    
        if productos_a_insertar:
            await Product.insert_many(productos_a_insertar)
            
        if operaciones_catalogo:
            col_prod = Product.get_pymongo_collection()
            await col_prod.bulk_write(operaciones_catalogo)
            
        if logs_inventario:
            await InventoryLog.insert_many(logs_inventario)
            
        if operaciones_inventario:
            col_inv = Inventario.get_pymongo_collection()
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
    
    @staticmethod
    async def import_product_prices(sucursal_id: str, file_bytes: bytes, filename: str, current_user: User):
        if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
            raise HTTPException(status_code=403, detail="No autorizado para importar precios")
            
        if not filename.endswith((".xlsx", ".xls")):
            raise HTTPException(status_code=400, detail="Formato de archivo inválido. Solo se permite .xlsx o .xls")
            
        tenant_id = current_user.tenant_id or "default"
        
        sucursal = await Sucursal.get(sucursal_id)
        if not sucursal or (current_user.role != UserRole.SUPERADMIN and sucursal.tenant_id != tenant_id):
            raise HTTPException(status_code=400, detail="Sucursal no encontrada")
        
        try:
            df = pd.read_excel(io.BytesIO(file_bytes))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error al leer el archivo Excel: {str(e)}")
            
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
                ignorados += 1 
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
            col_inv = Inventario.get_pymongo_collection()
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
