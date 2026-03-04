from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pymongo import UpdateOne
import pandas as pd
import io
from pydantic import BaseModel
from app.models.inventario import Inventario
from app.models.product import Product
from app.models.user import User, UserRole
from app.auth import get_current_active_user

router = APIRouter()


class InventarioItem(BaseModel):
    """Inventory entry enriched with product details for display."""
    inventario_id: str
    producto_id: str
    producto_nombre: str
    precio: float
    precio_sucursal: Optional[float] = None
    image_url: Optional[str] = None
    sucursal_id: str
    cantidad: int


class AjusteInventario(BaseModel):
    producto_id: str
    tipo: str      # 'ENTRADA', 'SALIDA', 'AJUSTE'
    cantidad: int  # Must be positive (absolute value of change)
    notas: str = ""


@router.get("/inventario", response_model=List[InventarioItem])
async def get_inventario(
    sucursal_id: str = "CENTRAL",
    current_user: User = Depends(get_current_active_user)
):
    """
    Get inventory for a specific sucursal (or CENTRAL).
    Automatically scoped to the user's tenant.
    """
    tenant_id = current_user.tenant_id or ""
    entries = await Inventario.find(
        Inventario.tenant_id == tenant_id,
        Inventario.sucursal_id == sucursal_id,
    ).to_list()

    result = []
    for entry in entries:
        product = await Product.get(entry.producto_id)
        if product:
            result.append(InventarioItem(
                inventario_id=str(entry.id),
                producto_id=str(product.id),
                producto_nombre=product.descripcion,
                precio=product.precio_venta,
                precio_sucursal=entry.precio_sucursal,
                image_url=product.image_url,
                sucursal_id=entry.sucursal_id,
                cantidad=entry.cantidad,
            ))
    return result



@router.post("/inventario/ajuste")
async def ajustar_inventario(
    ajuste: AjusteInventario,
    sucursal_id: str = "CENTRAL",
    current_user: User = Depends(get_current_active_user)
):
    """
    Manually adjust inventory (add/remove/set stock).
    ADMIN_MATRIZ for CENTRAL, ADMIN_SUCURSAL for their branch.
    """
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if ajuste.cantidad < 0:
        raise HTTPException(status_code=400, detail="La cantidad del ajuste debe ser un valor absoluto (positivo o cero).")

    tenant_id = current_user.tenant_id or ""

    # Verify product belongs to tenant
    product = await Product.get(ajuste.producto_id)
    if not product or (current_user.role != UserRole.SUPERADMIN and product.tenant_id != tenant_id):
        raise HTTPException(status_code=404, detail="Product not found")

    entry = await Inventario.find_one(
        Inventario.tenant_id == tenant_id,
        Inventario.sucursal_id == sucursal_id,
        Inventario.producto_id == ajuste.producto_id,
    )

    stock_anterior = entry.cantidad if entry else 0
    cantidad_cambio = 0
    
    from app.models.inventario import TipoMovimiento, InventoryLog

    if ajuste.tipo == "ENTRADA":
        nuevo_stock = stock_anterior + ajuste.cantidad
        cantidad_cambio = ajuste.cantidad
        tipo_mov = TipoMovimiento.ENTRADA_MANUAL
    elif ajuste.tipo == "SALIDA":
        nuevo_stock = max(0, stock_anterior - ajuste.cantidad)
        cantidad_cambio = nuevo_stock - stock_anterior  # will be negative
        tipo_mov = TipoMovimiento.SALIDA_MANUAL
    elif ajuste.tipo == "AJUSTE":
        nuevo_stock = ajuste.cantidad
        cantidad_cambio = nuevo_stock - stock_anterior
        tipo_mov = TipoMovimiento.AJUSTE_FISICO
    else:
        raise HTTPException(status_code=400, detail="Tipo de ajuste inválido (ENTRADA, SALIDA, AJUSTE)")

    if entry:
        entry.cantidad = nuevo_stock
        await entry.save()
    else:
        entry = Inventario(
            tenant_id=tenant_id,
            sucursal_id=sucursal_id,
            producto_id=ajuste.producto_id,
            cantidad=nuevo_stock,
        )
        await entry.create()

    # Guardar en Kárdex (Log Inmutable)
    if cantidad_cambio != 0:
        log = InventoryLog(
            tenant_id=tenant_id,
            sucursal_id=sucursal_id,
            producto_id=ajuste.producto_id,
            tipo_movimiento=tipo_mov,
            cantidad_movida=cantidad_cambio,
            stock_resultante=nuevo_stock,
            usuario_id=str(current_user.id),
            usuario_nombre=current_user.username,
            notas=ajuste.notas
        )
        await log.create()

    return {"sucursal_id": sucursal_id, "producto_id": ajuste.producto_id, "cantidad": entry.cantidad, "movimiento": cantidad_cambio}


@router.get("/inventario/movimientos")
async def get_movimientos(
    producto_id: str = None,
    sucursal_id: str = "CENTRAL",
    limit: int = 50,
    current_user: User = Depends(get_current_active_user)
):
    """
    Get the movement history (Kárdex) for a specific branch and optionally filtered by product.
    """
    tenant_id = current_user.tenant_id or ""
    
    query = {"tenant_id": tenant_id, "sucursal_id": sucursal_id}
    if producto_id:
        query["producto_id"] = producto_id
        
    from app.models.inventario import InventoryLog
    
    movimientos = await InventoryLog.find(query).sort("-created_at").limit(limit).to_list()
    
    # Enrich with product names for UI
    result = []
    for mov in movimientos:
        prod = await Product.get(mov.producto_id)
        data = mov.model_dump()
        data["producto_nombre"] = prod.descripcion if prod else "Producto Desconocido"
        result.append(data)
        
    return result


@router.get("/inventario/exportar-plantilla")
async def export_inventory_template(
    sucursal_id: str = "CENTRAL",
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="No autorizado")
        
    tenant_id = current_user.tenant_id or "default"
    
    # Validation branch access
    if current_user.role == UserRole.ADMIN_SUCURSAL and sucursal_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="Solo puedes exportar tu propia sucursal")
        
    from app.models.sucursal import Sucursal
    sucursal_db = await Sucursal.get(sucursal_id)
    suc_name = sucursal_db.nombre.replace(" ", "").upper() if sucursal_db else "CENTRAL"
        
    products = await Product.find(Product.tenant_id == tenant_id, Product.is_active == True).to_list()
    
    data = []
    for p in products:
        data.append({
            "CODIGO": p.codigo_largo or "",
            "CODIGO CORTO": p.codigo_corto,
            "DESCRIPCION": p.descripcion,
            "CATEGORIA": p.categoria_id, # Can be enriched if needed
            f"PRECIO PUBLICO {suc_name}": p.precio_venta,
            f"INVENTARIO FISICO {suc_name}": "" # Leaves it empty for them to fill
        })
        
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Conteo Fisico', index=False)
            
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=plantilla_inventario_{sucursal_id}.xlsx"}
    )


@router.post("/inventario/importar")
async def import_inventory(
    sucursal_id: str = "CENTRAL",
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="No autorizado")
        
    if current_user.role == UserRole.ADMIN_SUCURSAL and sucursal_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="Solo puedes importar a tu propia sucursal")
        
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Formato de archivo inválido. Solo se permite .xlsx o .xls")
        
    tenant_id = current_user.tenant_id or "default"
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
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
    # Map by product_id
    inventory_map = {i.producto_id: i for i in current_inventory}
    
    errores = []
    procesados = 0
    actualizados = 0
    fallidos = 0
    
    from app.models.inventario import InventoryLog, TipoMovimiento
    import datetime
    
    logs_a_insertar = []
    operaciones_inventario = []
    codigo_sum_map = {}
    
    for index, row in df.iterrows():
        procesados += 1
        fila_num = index + 2 
        
        codigo_corto = str(row.get("codigo_corto", "")).strip()
        cantidad_fisica = row.get("cantidad_fisica", 0)
        
        # Validations
        if not codigo_corto or str(codigo_corto) == "nan":
            errores.append({"fila": fila_num, "motivo": "codigo_corto está vacío"})
            fallidos += 1
            continue
            
        if codigo_corto not in product_map:
            errores.append({"fila": fila_num, "motivo": f"El código '{codigo_corto}' no existe o está inactivo en el catálogo maestro"})
            fallidos += 1
            continue
            
        if codigo_corto not in codigo_sum_map:
            codigo_sum_map[codigo_corto] = {
                "cantidad": 0,
                "filas": []
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
        
        stock_anterior = 0
        if product_id in inventory_map:
            stock_anterior = inventory_map[product_id].cantidad
            
        if cantidad_final == stock_anterior:
            # We skip them if there's no differential
            continue
            
        cantidad_cambio = cantidad_final - stock_anterior
        
        # Concurrency safety wrapper: we use an atomic increment for the diff instead of a blind SET
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
        collection = getattr(Inventario, "get_motor_collection", Inventario.get_pymongo_collection)()
        await collection.bulk_write(operaciones_inventario)
        
    return {
        "resumen": {
            "procesados": procesados,
            "actualizados": actualizados,
            "fallidos": fallidos
        },
        "errores": errores
    }


@router.post("/inventario/sincronizar-sucursal")
async def sincronizar_inventario_sucursal(
    sucursal_id: str = None,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """
    Endpoint para CAJEROS / ADMIN_SUCURSAL.
    Recibe el Excel maestro (ej: test1.xlsx) y extrae SOLO la columna de inventario correspondiente a su sucursal actual.
    Ignora las columnas de otras sucursales, así como los productos que NO existen en el catálogo original.
    """
    if current_user.role not in [UserRole.ADMIN_SUCURSAL, UserRole.CAJERO, UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="No autorizado")

    sucursal_id_user = current_user.sucursal_id
    if current_user.role in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
         # Para pruebas del admin matriz, se usa lo que envíe, sino CENTRAL
         sucursal_id_user = sucursal_id or "CENTRAL"
         
    if not sucursal_id_user:
        raise HTTPException(status_code=400, detail="El usuario no tiene una sucursal asignada")

    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Formato inválido. Solo .xlsx o .xls")

    tenant_id = current_user.tenant_id or "default"

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error leyendo Excel: {str(e)}")

    # Estandarizamos cabeceras a mayúsculas sin espacios de más y con guión bajo para cruzar
    df.columns = df.columns.astype(str).str.strip().str.upper()
    df.columns = df.columns.str.replace(' ', '_')

    # Identificar la columna objetivo del usuario actual
    from app.models.sucursal import Sucursal
    sucursal_db = None
    suc_name = "CENTRAL"

    if sucursal_id_user != "CENTRAL":
        sucursal_db = await Sucursal.get(sucursal_id_user)
        if not sucursal_db:
             raise HTTPException(status_code=404, detail="Sucursal no encontrada en la BD")
        # Remover espacios para match fácil (Ej: "LA PAZ" -> "LAPAZ")
        suc_name = sucursal_db.nombre.replace(" ", "").upper()

    columna_objetivo = f"INVENTARIO_FISICO_{suc_name}"
    
    # Algunas veces puede venir en otra variante como "INV_LAPAZ" o con un salto de linea "INVENTARIO FISICO \nLA PAZ"
    # Buscamos en las columnas estandarizadas alguna que contenga INVENTARIO FISICO y el nombre
    columna_exacta_en_df = None
    for col in df.columns:
        c_clean = col.replace("\n", "").replace("\r", "").replace("_-_", "_").replace("INVENTARIO_FISICO_", "").replace("INV_", "").replace("_", "")
        if c_clean == suc_name:
             columna_exacta_en_df = col
             break

    if not columna_exacta_en_df:
        raise HTTPException(status_code=400, detail=f"No se encontró la columna de inventario para su sucursal ({suc_name}). Verifique el Excel.")

    # Validamos CODIGO o CODIGO CORTO
    col_codigo = "CODIGO_CORTO" if "CODIGO_CORTO" in df.columns else "CODIGOCORTO"
    if col_codigo not in df.columns and "CODIGO" in df.columns:
         col_codigo = "CODIGO"
         
    if col_codigo not in df.columns:
         raise HTTPException(status_code=400, detail="El archivo no contiene la columna 'CODIGO' o 'CODIGO CORTO'.")

    # Cache de productos
    products = await Product.find(Product.tenant_id == tenant_id).to_list()
    product_map = {p.codigo_corto: p for p in products if p.codigo_corto}

    # Cache de inventario actual de ESTA SUCURSAL
    current_inventory = await Inventario.find(
        Inventario.tenant_id == tenant_id,
        Inventario.sucursal_id == sucursal_id_user
    ).to_list()
    inventory_map = {str(i.producto_id): i for i in current_inventory}

    errores = []
    procesados = 0
    actualizados = 0
    fallidos = 0

    from app.models.inventario import InventoryLog, TipoMovimiento
    logs_a_insertar = []
    operaciones_inventario = []
    
    # Preprocesar sumas de cantidades repetidas si hubiera filas del mismo producto
    codigo_sum_map = {}
    
    for index, row in df.iterrows():
        procesados += 1
        fila_num = index + 2
        
        c = row.get(col_codigo, "")
        if pd.isna(c): c = ""
        codigo_corto = str(c).strip()
        
        # Validar numéricos en la columna de cantidad (ignorando strings raros, nans, vacíos)
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
             codigo_sum_map[codigo_corto] = {"cantidad": 0, "filas": []}
             
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
                    "$set": {"cantidad": cantidad_final}, # Usamos SET porque es un Cierre de Conteo Físico
                    "$currentDate": {"updated_at": True}
                },
                upsert=True
            )
        )

        logs_a_insertar.append(InventoryLog(
            tenant_id=tenant_id,
            sucursal_id=sucursal_id_user,
            producto_id=product_id,
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
        collection = getattr(Inventario, "get_motor_collection", Inventario.get_pymongo_collection)()
        await collection.bulk_write(operaciones_inventario)

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

