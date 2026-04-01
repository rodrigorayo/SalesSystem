import io
import pandas as pd
from typing import Optional, Dict, Any
from fastapi import HTTPException
from pymongo import UpdateOne

from app.domain.models.inventario import Inventario, InventoryLog, TipoMovimiento
from app.domain.models.product import Product
from app.domain.models.user import User, UserRole
from app.domain.schemas.inventario import AjusteInventario

class InventarioService:

    @staticmethod
    async def ajustar_inventario(ajuste: AjusteInventario, sucursal_id: str, current_user: User) -> Dict[str, Any]:
        if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.SUPERADMIN]:
            raise HTTPException(status_code=403, detail="Not authorized")

        if ajuste.cantidad < 0:
            raise HTTPException(status_code=400, detail="La cantidad del ajuste debe ser un valor absoluto (positivo o cero).")

        tenant_id = current_user.tenant_id or ""

        product = await Product.get(ajuste.producto_id)
        if not product or (current_user.role != UserRole.SUPERADMIN and product.tenant_id != tenant_id):
            raise HTTPException(status_code=404, detail="Product not found")

        client = Inventario.get_motor_collection().database.client
        
        async with await client.start_session() as session:
            async with session.start_transaction():
                entry = await Inventario.find_one(
                    Inventario.tenant_id == tenant_id,
                    Inventario.sucursal_id == sucursal_id,
                    Inventario.producto_id == ajuste.producto_id,
                    session=session
                )

                stock_anterior = entry.cantidad if entry else 0
                cantidad_cambio = 0

                if ajuste.tipo == "ENTRADA":
                    nuevo_stock = stock_anterior + ajuste.cantidad
                    cantidad_cambio = ajuste.cantidad
                    tipo_mov = TipoMovimiento.ENTRADA_MANUAL
                elif ajuste.tipo == "SALIDA":
                    nuevo_stock = max(0, stock_anterior - ajuste.cantidad)
                    cantidad_cambio = nuevo_stock - stock_anterior
                    tipo_mov = TipoMovimiento.SALIDA_MANUAL
                elif ajuste.tipo == "AJUSTE":
                    nuevo_stock = ajuste.cantidad
                    cantidad_cambio = nuevo_stock - stock_anterior
                    tipo_mov = TipoMovimiento.AJUSTE_FISICO
                else:
                    raise HTTPException(status_code=400, detail="Tipo de ajuste inválido (ENTRADA, SALIDA, AJUSTE)")

                if entry:
                    entry.cantidad = nuevo_stock
                    await entry.save(session=session)
                else:
                    entry = Inventario(
                        tenant_id=tenant_id,
                        sucursal_id=sucursal_id,
                        producto_id=ajuste.producto_id,
                        cantidad=nuevo_stock,
                    )
                    await entry.create(session=session)

                if cantidad_cambio != 0:
                    log = InventoryLog(
                        tenant_id=tenant_id,
                        sucursal_id=sucursal_id,
                        producto_id=ajuste.producto_id,
                        descripcion=product.descripcion,
                        tipo_movimiento=tipo_mov,
                        cantidad_movida=cantidad_cambio,
                        stock_resultante=nuevo_stock,
                        usuario_id=str(current_user.id),
                        usuario_nombre=current_user.username,
                        notas=ajuste.notas
                    )
                    await log.create(session=session)

                return {"sucursal_id": sucursal_id, "producto_id": ajuste.producto_id, "cantidad": entry.cantidad, "movimiento": cantidad_cambio}


    @staticmethod
    async def importar_inventario(sucursal_id: str, file_bytes: bytes, filename: str, current_user: User) -> Dict[str, Any]:
        if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.SUPERADMIN]:
            raise HTTPException(status_code=403, detail="No autorizado")
            
        if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR] and sucursal_id != current_user.sucursal_id:
            raise HTTPException(status_code=403, detail="Solo puedes importar a tu propia sucursal")
            
        tenant_id = current_user.tenant_id or "default"
        
        try:
            df = pd.read_excel(io.BytesIO(file_bytes))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error al leer el archivo Excel: {str(e)}")
            
        df.columns = df.columns.astype(str).str.strip().str.lower()
        required_cols = {"codigo_corto", "cantidad_fisica"}
        if not required_cols.issubset(set(df.columns)):
            missing = required_cols - set(df.columns)
            raise HTTPException(status_code=400, detail=f"Faltan columnas obligatorias: {missing}")
            
        df['cantidad_fisica'] = pd.to_numeric(df['cantidad_fisica'], errors='coerce').fillna(0)
        
        products = await Product.find(Product.tenant_id == tenant_id, Product.is_active == True).to_list()
        product_map = {p.codigo_corto: p for p in products if p.codigo_corto}
        
        current_inventory = await Inventario.find(
            Inventario.tenant_id == tenant_id,
            Inventario.sucursal_id == sucursal_id
        ).to_list()
        inventory_map = {i.producto_id: i for i in current_inventory}
        
        errores = []
        procesados = 0
        actualizados = 0
        fallidos = 0
        
        logs_a_insertar = []
        operaciones_inventario = []
        operaciones_productos = []
        codigo_sum_map = {}
        
        for index, row in df.iterrows():
            procesados += 1
            fila_num = index + 2 
            
            codigo_corto = str(row.get("codigo_corto", "")).strip()
            cantidad_fisica = row.get("cantidad_fisica", 0)
            proveedor_val = str(row.get("proveedor", "")).strip() if pd.notna(row.get("proveedor")) else ""
            
            if not codigo_corto or str(codigo_corto) == "nan":
                errores.append({"fila": fila_num, "motivo": "codigo_corto está vacío"})
                fallidos += 1
                continue
                
            if codigo_corto not in product_map:
                errores.append({"fila": fila_num, "motivo": f"El código '{codigo_corto}' no existe o inactivo"})
                fallidos += 1
                continue
                
            if codigo_corto not in codigo_sum_map:
                codigo_sum_map[codigo_corto] = {
                    "cantidad": 0,
                    "filas": [],
                    "proveedor": proveedor_val
                }
            
            codigo_sum_map[codigo_corto]["cantidad"] += cantidad_fisica
            codigo_sum_map[codigo_corto]["filas"].append(fila_num)
            
        for codigo_corto, data in codigo_sum_map.items():
            cantidad_final = int(data["cantidad"])
            if cantidad_final < 0:
                for f in data["filas"]:
                   errores.append({"fila": f, "motivo": "Cantidad física final no puede ser negativa acumulada"})
                   fallidos += 1
                continue
                
            product = product_map[codigo_corto]
            product_id = str(product.id)
            
            if data.get("proveedor"):
                operaciones_productos.append(
                    UpdateOne(
                        {"_id": product.id},
                        {"$set": {"proveedor": data["proveedor"]}}
                    )
                )
            
            stock_anterior = 0
            if product_id in inventory_map:
                stock_anterior = inventory_map[product_id].cantidad
                
            if cantidad_final == stock_anterior:
                continue
                
            cantidad_cambio = cantidad_final - stock_anterior
            
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
                            "precio_sucursal": None
                        },
                        "$inc": {"cantidad": cantidad_cambio},
                        "$currentDate": {"updated_at": True}
                    },
                    upsert=True
                )
            )
                
            logs_a_insertar.append(InventoryLog(
                tenant_id=tenant_id,
                sucursal_id=sucursal_id,
                producto_id=product_id,
                descripcion=product.descripcion,
                tipo_movimiento=TipoMovimiento.AJUSTE_FISICO,
                cantidad_movida=cantidad_cambio,
                stock_resultante=cantidad_final,
                usuario_id=str(current_user.id),
                usuario_nombre=current_user.full_name or current_user.username,
                notas="Importación Masiva (Excel)"
            ))
            
            actualizados += 1

        if logs_a_insertar:
            await InventoryLog.insert_many(logs_a_insertar)
            
        if operaciones_inventario:
            collection = Inventario.get_pymongo_collection()
            await collection.bulk_write(operaciones_inventario)
            
        if operaciones_productos:
            product_coll = Product.get_pymongo_collection()
            await product_coll.bulk_write(operaciones_productos)
            
        return {
            "resumen": {
                "procesados": procesados,
                "actualizados": actualizados,
                "fallidos": fallidos
            },
            "errores": errores
        }


    @staticmethod
    async def sincronizar_sucursal(sucursal_id_req: Optional[str], file_bytes: bytes, filename: str, current_user: User) -> Dict[str, Any]:
        if current_user.role not in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.CAJERO, UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
            raise HTTPException(status_code=403, detail="No autorizado")

        sucursal_id_user = current_user.sucursal_id
        if current_user.role in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
             sucursal_id_user = sucursal_id_req or "CENTRAL"
             
        if not sucursal_id_user:
            raise HTTPException(status_code=400, detail="El usuario no tiene una sucursal asignada")

        tenant_id = current_user.tenant_id or "default"

        try:
            df = pd.read_excel(io.BytesIO(file_bytes))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error leyendo Excel: {str(e)}")

        df.columns = df.columns.astype(str).str.strip().str.upper()
        df.columns = df.columns.str.replace(' ', '_')

        from app.domain.models.sucursal import Sucursal
        sucursal_db = None
        suc_name = "CENTRAL"

        if sucursal_id_user != "CENTRAL":
            sucursal_db = await Sucursal.get(sucursal_id_user)
            if not sucursal_db:
                 raise HTTPException(status_code=404, detail="Sucursal no encontrada en la BD")
            suc_name = sucursal_db.nombre.replace(" ", "").upper()

        columna_objetivo = f"INVENTARIO_FISICO_{suc_name}"
        columna_exacta_en_df = None
        for col in df.columns:
            c_clean = col.replace("\\n", "").replace("\\r", "").replace("_-_", "_").replace("INVENTARIO_FISICO_", "").replace("INV_", "").replace("_", "")
            if c_clean == suc_name:
                 columna_exacta_en_df = col
                 break

        if not columna_exacta_en_df:
            raise HTTPException(status_code=400, detail=f"No se encontró la columna de inventario para su sucursal ({suc_name}). Verifique el Excel.")

        col_codigo = "CODIGO_CORTO" if "CODIGO_CORTO" in df.columns else "CODIGOCORTO"
        if col_codigo not in df.columns and "CODIGO" in df.columns:
             col_codigo = "CODIGO"
             
        if col_codigo not in df.columns:
             raise HTTPException(status_code=400, detail="El archivo no contiene la columna 'CODIGO' o 'CODIGO CORTO'.")

        products = await Product.find(Product.tenant_id == tenant_id).to_list()
        product_map = {p.codigo_corto: p for p in products if p.codigo_corto}

        current_inventory = await Inventario.find(
            Inventario.tenant_id == tenant_id,
            Inventario.sucursal_id == sucursal_id_user
        ).to_list()
        inventory_map = {str(i.producto_id): i for i in current_inventory}

        errores = []
        procesados = 0
        actualizados = 0
        fallidos = 0

        logs_a_insertar = []
        operaciones_inventario = []
        operaciones_productos = []
        codigo_sum_map = {}
        
        for index, row in df.iterrows():
            procesados += 1
            fila_num = index + 2
            
            c = row.get(col_codigo, "")
            if pd.isna(c): c = ""
            codigo_corto = str(c).strip()
            
            val_proveedor = row.get("PROVEEDOR", "")
            if pd.isna(val_proveedor): val_proveedor = ""
            val_proveedor = str(val_proveedor).strip()
            
            val_cantidad = row.get(columna_exacta_en_df, 0)
            try:
                 cantidad_fisica = int(float(val_cantidad)) if pd.notna(val_cantidad) and str(val_cantidad).strip() != "" else 0
            except:
                 cantidad_fisica = 0

            if not codigo_corto or codigo_corto == "nan":
                 errores.append({"fila": fila_num, "motivo": "Código vacío."})
                 fallidos += 1
                 continue

            if codigo_corto not in product_map:
                 errores.append({"fila": fila_num, "motivo": f"El producto {codigo_corto} no existe en catálogo central."})
                 fallidos += 1
                 continue
                 
            if codigo_corto not in codigo_sum_map:
                 codigo_sum_map[codigo_corto] = {"cantidad": 0, "filas": [], "proveedor": val_proveedor}
                 
            codigo_sum_map[codigo_corto]["cantidad"] += cantidad_fisica
            codigo_sum_map[codigo_corto]["filas"].append(fila_num)

        for codigo_corto, data in codigo_sum_map.items():
            cantidad_final = data["cantidad"]
            if cantidad_final < 0:
                for f in data["filas"]: 
                    errores.append({"fila": f, "motivo": "Cantidad final no puede ser negativa."})
                    fallidos += 1
                continue

            product = product_map[codigo_corto]
            product_id = str(product.id)

            if data.get("proveedor"):
                operaciones_productos.append(
                    UpdateOne(
                        {"_id": product.id},
                        {"$set": {"proveedor": data["proveedor"]}}
                    )
                )

            stock_anterior = 0
            if product_id in inventory_map:
                stock_anterior = inventory_map[product_id].cantidad
                
            if cantidad_final == stock_anterior:
                continue
                
            cantidad_cambio = cantidad_final - stock_anterior

            operaciones_inventario.append(
                UpdateOne(
                    {
                        "tenant_id": tenant_id,
                        "sucursal_id": sucursal_id_user,
                        "producto_id": product_id
                    },
                    {
                        "$setOnInsert": {
                            "tenant_id": tenant_id,
                            "sucursal_id": sucursal_id_user,
                            "producto_id": product_id,
                            "precio_sucursal": None
                        },
                        "$set": {"cantidad": cantidad_final}, 
                        "$currentDate": {"updated_at": True}
                    },
                    upsert=True
                )
            )

            logs_a_insertar.append(InventoryLog(
                tenant_id=tenant_id,
                sucursal_id=sucursal_id_user,
                producto_id=product_id,
                descripcion=product.descripcion,
                tipo_movimiento=TipoMovimiento.AJUSTE_FISICO,
                cantidad_movida=cantidad_cambio,
                stock_resultante=cantidad_final,
                usuario_id=str(current_user.id),
                usuario_nombre=current_user.full_name or current_user.username,
                notas="Sincronización por Excel de Sucursal"
            ))
            actualizados += 1

        if logs_a_insertar:
            await InventoryLog.insert_many(logs_a_insertar)
            
        if operaciones_inventario:
            collection = Inventario.get_pymongo_collection()
            await collection.bulk_write(operaciones_inventario)

        if operaciones_productos:
            product_coll = Product.get_pymongo_collection()
            await product_coll.bulk_write(operaciones_productos)

        return {
            "resumen": {
                "procesados": procesados,
                "actualizados": actualizados,
                "fallidos": fallidos,
                "sucursal_objetivo": suc_name,
                "columna_leida": columna_exacta_en_df
            },
            "errores": errores
        }
