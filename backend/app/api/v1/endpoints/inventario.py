import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from pymongo import UpdateOne
import pandas as pd
import io
import math
from app.domain.models.inventario import Inventario
from app.domain.models.product import Product
from app.domain.models.inventario import Inventario, InventoryLog, TipoMovimiento
from app.domain.models.user import User, UserRole
from app.infrastructure.auth import get_current_active_user, require_roles
from app.domain.schemas.inventario import InventarioItem, AjusteInventario, InventarioPaginated, AjusteInventarioMasivoRequest
from app.utils.date_utils import get_day_range_bolivia

router = APIRouter()


@router.get("/inventario", response_model=InventarioPaginated)
async def get_inventario(
    sucursal_id: str = "CENTRAL",
    almacen_id: str = "default",
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=2000),
    search: Optional[str] = Query(None, description="Filtrar por nombre del producto"),
    categoria_id: Optional[str] = Query(None, description="Filtrar por categoría del producto"),
    stock_bajo: bool = Query(False, description="Solo ver productos con stock <= 5"),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get inventory for a specific sucursal.
    Starts from Product to leverage Text Indexes, then lookups Inventario.
    """
    tenant_id = current_user.tenant_id or ""
    skip = (page - 1) * limit
    
    prod_match = {"tenant_id": tenant_id}
    if search and search.strip():
        # Escapar caracteres para búsqueda segura y permitir coincidencias parciales
        import re
        safe_search = re.escape(search.strip())
        prod_match["descripcion"] = {"$regex": safe_search, "$options": "i"}
        
    if categoria_id:
        prod_match["categoria_id"] = categoria_id

    pipeline = [{"$match": prod_match}]
    
    # Lookup the inventory for this specific branch
    # Prepare the lookup match conditions
    lookup_match = {
        "$expr": {"$eq": ["$producto_id", "$$pid"]},
        "sucursal_id": sucursal_id,
        "tenant_id": tenant_id
    }
    
    if almacen_id == "default":
        lookup_match["$or"] = [
            {"almacen_id": "default"},
            {"almacen_id": {"$exists": False}}
        ]
    else:
        lookup_match["almacen_id"] = almacen_id

    inv_coll = Inventario.get_collection_name()
    pipeline.append({
        "$lookup": {
            "from": inv_coll,
            "let": {"pid": {"$toString": "$_id"}},
            "pipeline": [
                {"$match": lookup_match}
            ],
            "as": "inventory"
        }
    })
    
    # Unwind inventory, keeping products even if they have 0 stock (no doc yet)
    pipeline.append({"$unwind": {"path": "$inventory", "preserveNullAndEmptyArrays": True}})
    
    if stock_bajo:
        # If no inventory doc exists, assumed 0, so it matches lte 5.
        pipeline.append({
            "$match": {
                "$or": [
                    {"inventory.cantidad": {"$lte": 5}},
                    {"inventory": {"$exists": False}}
                ]
            }
        })
        
    pipeline.append({
        "$facet": {
            "metadata": [{"$count": "total"}],
            "data": [
                {"$sort": {"descripcion": 1} if search else {"_id": -1}},
                {"$skip": skip},
                {"$limit": limit}
            ]
        }
    })
    
    motor_coll = Product.get_pymongo_collection()
    cursor = motor_coll.aggregate(pipeline)
    raw_results = await cursor.to_list(length=1)
    
    if not raw_results or not raw_results[0].get("metadata"):
        return InventarioPaginated(items=[], total=0, page=page, pages=1)
        
    total = raw_results[0]["metadata"][0]["total"]
    data = raw_results[0]["data"]
    
    result = []
    for doc in data:
        inv_doc = doc.get("inventory") or {}
        result.append(InventarioItem(
            inventario_id=str(inv_doc.get("_id", doc["_id"])), # Fallback id
            producto_id=str(doc["_id"]),
            producto_nombre=doc.get("descripcion", "Desconocido"),
            precio=doc.get("precio_venta", 0.0),
            precio_sucursal=inv_doc.get("precio_sucursal"),
            image_url=doc.get("image_url"),
            sucursal_id=sucursal_id,
            almacen_id=almacen_id,
            cantidad=inv_doc.get("cantidad", 0),
        ))
        
    return InventarioPaginated(
        items=result,
        total=total,
        page=page,
        pages=math.ceil(total / limit) if limit > 0 else 1
    )




@router.post("/inventario/ajuste")
async def ajustar_inventario(
    ajuste: AjusteInventario,
    sucursal_id: str = "CENTRAL",
    almacen_id: str = "default",
    current_user: User = Depends(get_current_active_user)
):
    """
    Manually adjust inventory (add/remove/set stock).
    ADMIN_MATRIZ for CENTRAL, ADMIN_SUCURSAL for their branch.
    """
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if ajuste.cantidad < 0:
        raise HTTPException(status_code=400, detail="La cantidad del ajuste debe ser un valor absoluto (positivo o cero).")

    tenant_id = current_user.tenant_id or ""

    # Verify product belongs to tenant
    product = await Product.get(ajuste.producto_id)
    if not product or (current_user.role != UserRole.SUPERADMIN and product.tenant_id != tenant_id):
        raise HTTPException(status_code=404, detail="Product not found")

    # Implementación Atómica con pymongo para evitar DuplicateKeyError y Condiciones de Carrera
    from pymongo import ReturnDocument
    from datetime import datetime
    import pymongo

    motor_coll = Inventario.get_pymongo_collection()
    
    # Búsqueda tolerante a documentos antiguos sin almacen_id (Auto-sanación)
    base_query = {
        "tenant_id": tenant_id,
        "sucursal_id": sucursal_id,
        "producto_id": ajuste.producto_id,
    }
    
    # Check if a document exists (with or without almacen_id for default)
    search_query = dict(base_query)
    if almacen_id == "default":
        search_query["$or"] = [{"almacen_id": "default"}, {"almacen_id": {"$exists": False}}]
    else:
        search_query["almacen_id"] = almacen_id
        
    existing_doc = await motor_coll.find_one(search_query)
    
    if existing_doc:
        # Use exact _id to avoid $or with upsert=True error in MongoDB
        update_query = {"_id": existing_doc["_id"]}
    else:
        # Use exact fields for clean upsert insertion
        update_query = dict(base_query)
        update_query["almacen_id"] = almacen_id

    from app.domain.models.inventario import TipoMovimiento, InventoryLog

    now = datetime.utcnow()
    set_on_insert = {
        "tenant_id": tenant_id,
        "sucursal_id": sucursal_id,
        "almacen_id": almacen_id,
        "producto_id": ajuste.producto_id,
        "created_at": now,
    }

    if ajuste.tipo == "ENTRADA":
        update = {
            "$inc": {"cantidad": ajuste.cantidad},
            "$set": {"updated_at": now, "almacen_id": almacen_id}, # Forzamos sanar el almacen_id
            "$setOnInsert": set_on_insert
        }
        tipo_mov = TipoMovimiento.ENTRADA_MANUAL
    elif ajuste.tipo == "SALIDA":
        # Para evitar saldos negativos en salidas atómicas, usamos pipeline update (MongoDB 4.2+)
        update = [
            {
                "$set": {
                    "cantidad": {"$max": [0, {"$subtract": [{"$ifNull": ["$cantidad", 0]}, ajuste.cantidad]}]},
                    "updated_at": now,
                    "tenant_id": tenant_id,
                    "sucursal_id": sucursal_id,
                    "almacen_id": almacen_id, # Forzamos sanar el almacen_id
                    "producto_id": ajuste.producto_id,
                    "created_at": {"$ifNull": ["$created_at", now]}
                }
            }
        ]
        tipo_mov = TipoMovimiento.SALIDA_MANUAL
    elif ajuste.tipo == "AJUSTE":
        update = {
            "$set": {"cantidad": ajuste.cantidad, "updated_at": now, "almacen_id": almacen_id},
            "$setOnInsert": set_on_insert
        }
        tipo_mov = TipoMovimiento.AJUSTE_FISICO
    else:
        raise HTTPException(status_code=400, detail="Tipo de ajuste inválido")

    # Ejecutar operación atómica
    # ReturnDocument.BEFORE nos asegura saber exactamente el stock que había
    # en el microsegundo exacto en el que MongoDB aplicó nuestro bloqueo de fila.
    doc_before = await motor_coll.find_one_and_update(
        update_query,
        update,
        upsert=True,
        return_document=ReturnDocument.BEFORE
    )
    
    stock_anterior = doc_before["cantidad"] if doc_before else 0.0

    if ajuste.tipo == "ENTRADA":
        nuevo_stock = stock_anterior + ajuste.cantidad
    elif ajuste.tipo == "SALIDA":
        nuevo_stock = max(0.0, stock_anterior - ajuste.cantidad)
    elif ajuste.tipo == "AJUSTE":
        nuevo_stock = ajuste.cantidad

    cantidad_cambio = nuevo_stock - stock_anterior

    # Guardar en Kárdex (Log Inmutable)
    if cantidad_cambio != 0:
        mismatch_note = ""
        if ajuste.tipo == "AJUSTE":
            mismatch_note = f"[Ajuste Físico: Sistema tenía {stock_anterior} u., físico {nuevo_stock} u. Discrepancia: {'+' if cantidad_cambio > 0 else ''}{cantidad_cambio} u.]"
        elif ajuste.tipo == "ENTRADA":
            mismatch_note = f"[Entrada Manual: {stock_anterior} u. -> {nuevo_stock} u. (+{ajuste.cantidad} u.)]"
        elif ajuste.tipo == "SALIDA":
            mismatch_note = f"[Salida Manual: {stock_anterior} u. -> {nuevo_stock} u. (-{ajuste.cantidad} u.)]"
            
        final_notes = f"{mismatch_note} - {ajuste.notas}" if ajuste.notas else mismatch_note

        log = InventoryLog(
            tenant_id=tenant_id,
            sucursal_id=sucursal_id,
            almacen_id=almacen_id,
            producto_id=ajuste.producto_id,
            descripcion=product.descripcion,
            tipo_movimiento=tipo_mov,
            cantidad_movida=cantidad_cambio,
            stock_resultante=nuevo_stock,
            usuario_id=str(current_user.id),
            usuario_nombre=current_user.username,
            notas=final_notes
        )
        await log.create()

    return {"sucursal_id": sucursal_id, "almacen_id": almacen_id, "producto_id": ajuste.producto_id, "cantidad": nuevo_stock, "movimiento": cantidad_cambio}


from app.dependencies import get_uow
from app.domain.uow.base_uow import BaseUnitOfWork

@router.post("/inventario/ajuste-masivo")
async def ajustar_inventario_masivo(
    req: AjusteInventarioMasivoRequest,
    current_user: User = Depends(require_roles([UserRole.ADMIN_MATRIZ])),
    uow: BaseUnitOfWork = Depends(get_uow)
):
    """
    Manually adjust inventory for multiple products at once using Bulk Write and ACID Transactions.
    """

    tenant_id = current_user.tenant_id or ""
    sucursal_id = req.sucursal_id

    from app.domain.models.inventario import TipoMovimiento, InventoryLog
    from pymongo import UpdateOne
    from datetime import datetime
    import bson

    # Filtrar solo ajustes válidos
    ajustes_validos = [a for a in req.ajustes if a.cantidad >= 0]
    if not ajustes_validos:
        return {"message": "No hay ajustes válidos para procesar", "procesados": 0}

    # Extraer IDs de productos y validar
    valid_pids = []
    for a in ajustes_validos:
        if bson.ObjectId.is_valid(a.producto_id):
            valid_pids.append(bson.ObjectId(a.producto_id))

    # 1. Obtener productos existentes
    product_query = {"_id": {"$in": valid_pids}}
    if current_user.role != UserRole.SUPERADMIN:
        product_query["tenant_id"] = tenant_id

    products_db = await Product.find(product_query).to_list()
    product_map = {str(p.id): p for p in products_db}

    ajustes_permitidos = [a for a in ajustes_validos if a.producto_id in product_map]
    if not ajustes_permitidos:
        return {"message": "No se encontraron productos válidos o autorizados", "procesados": 0}

    now = datetime.utcnow()
    operaciones_update = []
    logs_a_insertar = []
    resultados = []

    motor_coll = Inventario.get_pymongo_collection()

    async with uow:
        # 2. Obtener el inventario actual tolerando documentos antiguos (Auto-sanación)
        inventario_query = {
            "tenant_id": tenant_id,
            "sucursal_id": sucursal_id,
            "producto_id": {"$in": [a.producto_id for a in ajustes_permitidos]}
        }
        if req.almacen_id == "default":
            inventario_query["$or"] = [{"almacen_id": "default"}, {"almacen_id": {"$exists": False}}]
        else:
            inventario_query["almacen_id"] = req.almacen_id

        inventarios_db = await motor_coll.find(inventario_query, session=uow.session).to_list(length=None)
        inventario_map = {inv["producto_id"]: inv for inv in inventarios_db}

        # 3. Preparar Bulk Write en memoria (0 consultas a DB aquí)
        for ajuste in ajustes_permitidos:
            doc_actual = inventario_map.get(ajuste.producto_id)
            stock_anterior = doc_actual["cantidad"] if doc_actual else 0.0
            
            # Cálculo atómico seguro en Python porque estamos bajo un Unit Of Work
            if ajuste.tipo == "ENTRADA":
                nuevo_stock = stock_anterior + ajuste.cantidad
                tipo_mov = TipoMovimiento.ENTRADA_MANUAL
            elif ajuste.tipo == "SALIDA":
                nuevo_stock = max(0.0, stock_anterior - ajuste.cantidad)
                tipo_mov = TipoMovimiento.SALIDA_MANUAL
            elif ajuste.tipo == "AJUSTE":
                nuevo_stock = ajuste.cantidad
                tipo_mov = TipoMovimiento.AJUSTE_FISICO
            else:
                continue

            cantidad_cambio = nuevo_stock - stock_anterior

            # Preparar UpdateOne
            if doc_actual:
                query = {"_id": doc_actual["_id"]}
                update_set = {
                    "cantidad": nuevo_stock,
                    "updated_at": now,
                    "almacen_id": req.almacen_id # Auto-sana el campo si faltaba
                }
            else:
                query = {
                    "tenant_id": tenant_id,
                    "sucursal_id": sucursal_id,
                    "almacen_id": req.almacen_id,
                    "producto_id": ajuste.producto_id,
                }
                update_set = {
                    "cantidad": nuevo_stock,
                    "updated_at": now
                }

            update = {
                "$set": update_set,
                "$setOnInsert": {
                    "created_at": now
                }
            }
            operaciones_update.append(UpdateOne(query, update, upsert=True))

            # Preparar Log
            if cantidad_cambio != 0:
                mismatch_note = ""
                if ajuste.tipo == "AJUSTE":
                    mismatch_note = f"[Ajuste Físico Masivo: Sistema tenía {stock_anterior} u., físico {nuevo_stock} u. Discrepancia: {'+' if cantidad_cambio > 0 else ''}{cantidad_cambio} u.]"
                elif ajuste.tipo == "ENTRADA":
                    mismatch_note = f"[Entrada Masiva: {stock_anterior} u. -> {nuevo_stock} u. (+{ajuste.cantidad} u.)]"
                elif ajuste.tipo == "SALIDA":
                    mismatch_note = f"[Salida Masiva: {stock_anterior} u. -> {nuevo_stock} u. (-{ajuste.cantidad} u.)]"
                    
                final_notes = f"{mismatch_note} - {req.notas_generales}" if getattr(req, "notas_generales", None) else mismatch_note

                product = product_map[ajuste.producto_id]
                log = InventoryLog(
                    tenant_id=tenant_id,
                    sucursal_id=sucursal_id,
                    almacen_id=req.almacen_id,
                    producto_id=ajuste.producto_id,
                    descripcion=product.descripcion,
                    tipo_movimiento=tipo_mov,
                    cantidad_movida=cantidad_cambio,
                    stock_resultante=nuevo_stock,
                    usuario_id=str(current_user.id),
                    usuario_nombre=current_user.username,
                    notas=final_notes
                )
                logs_a_insertar.append(log)

            resultados.append({
                "producto_id": ajuste.producto_id,
                "cantidad": nuevo_stock,
                "movimiento": cantidad_cambio
            })

        # 4. Ejecutar todas las actualizaciones de inventario de una vez (1 consulta)
        if operaciones_update:
            await motor_coll.bulk_write(operaciones_update, session=uow.session)
        
        # 5. Insertar todo el Kárdex de una vez (1 consulta)
        if logs_a_insertar:
            await InventoryLog.insert_many(logs_a_insertar, session=uow.session)
            
        # Automáticamente se hace el commit() al salir del bloque 'async with uow'
        # Si falla, hace rollback() de todo.

    return {"message": "Ajuste masivo procesado exitosamente", "procesados": len(resultados)}

@router.get("/inventario/movimientos")
async def get_movimientos_inventario(
    producto_id: str = None,
    sucursal_id: str = "CENTRAL",
    almacen_id: str = "default",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    tipo_movimiento: Optional[str] = None,
    limit: int = Query(500, le=2000),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get movement history (Kárdex) for a branch and almacen.
    """
    tenant_id = current_user.tenant_id or ""
    
    query = {"tenant_id": tenant_id, "sucursal_id": sucursal_id, "almacen_id": almacen_id}
    if producto_id:
        query["producto_id"] = producto_id
        
    if tipo_movimiento:
        query["tipo_movimiento"] = tipo_movimiento

    # Soporte para búsqueda por texto en varios campos del log
    if search:
        # Escapar caracteres especiales y luego des-escapar el espacio porque MongoDB regex no maneja bien '\ '
        safe_search = re.escape(search).replace("\\ ", " ")
        
        # Buscar productos que coincidan con el texto para incluir sus IDs
        product_query = {"tenant_id": tenant_id, "$or": [
            {"descripcion": {"$regex": safe_search, "$options": "i"}},
            {"codigo_corto": {"$regex": safe_search, "$options": "i"}},
            {"codigo_largo": {"$regex": safe_search, "$options": "i"}},
        ]}
        matching_products = await Product.find(product_query).to_list()
        matching_product_ids = [str(p.id) for p in matching_products]
        
        query["$or"] = [
            {"descripcion": {"$regex": safe_search, "$options": "i"}},
            {"notas": {"$regex": safe_search, "$options": "i"}},
            {"usuario_nombre": {"$regex": safe_search, "$options": "i"}},
            {"referencia_id": {"$regex": safe_search, "$options": "i"}}
        ]
        if matching_product_ids:
            query["$or"].append({"producto_id": {"$in": matching_product_ids}})
        
    # Rangos de fecha flexibles (pueden venir solo uno o ambos)
    date_filter = {}
    try:
        if start_date:
            start_dt, _ = get_day_range_bolivia(start_date)
            date_filter["$gte"] = start_dt
        if end_date:
            _, end_dt = get_day_range_bolivia(end_date)
            date_filter["$lte"] = end_dt
            
        if date_filter:
            query["created_at"] = date_filter
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")
            
    from app.domain.models.inventario import InventoryLog
    
    movimientos = await InventoryLog.find(query).sort("-created_at").limit(limit).to_list()
    
    # Enrich with product names directly from the snapshot stored in InventoryLog
    # Eliminated N+1 queries here for massive performance boost
    result = []
    for mov in movimientos:
        data = mov.model_dump()
        data["producto_nombre"] = mov.descripcion or "Producto Sin Nombre"
        result.append(data)
        
    return result


@router.get("/inventario/movimientos/exportar")
async def exportar_movimientos(
    producto_id: str = None,
    sucursal_id: str = "CENTRAL",
    almacen_id: str = "default",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    tipo_movimiento: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    Exports the movement history (Kárdex) to Excel.
    """
    tenant_id = current_user.tenant_id or ""
    
    query = {"tenant_id": tenant_id, "sucursal_id": sucursal_id, "almacen_id": almacen_id}
    if producto_id: query["producto_id"] = producto_id
    if tipo_movimiento: query["tipo_movimiento"] = tipo_movimiento
    if search:
        safe_search = re.escape(search).replace("\\ ", " ")
        
        product_query = {"tenant_id": tenant_id, "$or": [
            {"descripcion": {"$regex": safe_search, "$options": "i"}},
            {"codigo_corto": {"$regex": safe_search, "$options": "i"}},
            {"codigo_largo": {"$regex": safe_search, "$options": "i"}},
        ]}
        matching_products = await Product.find(product_query).to_list()
        matching_product_ids = [str(p.id) for p in matching_products]
        
        query["$or"] = [
            {"descripcion": {"$regex": safe_search, "$options": "i"}},
            {"notas": {"$regex": safe_search, "$options": "i"}},
            {"usuario_nombre": {"$regex": safe_search, "$options": "i"}},
            {"referencia_id": {"$regex": safe_search, "$options": "i"}}
        ]
        if matching_product_ids:
            query["$or"].append({"producto_id": {"$in": matching_product_ids}})
        
    try:
        date_filter = {}
        if start_date:
            start_dt, _ = get_day_range_bolivia(start_date)
            date_filter["$gte"] = start_dt
        if end_date:
            _, end_dt = get_day_range_bolivia(end_date)
            date_filter["$lte"] = end_dt
        if date_filter: query["created_at"] = date_filter
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
            
    from app.domain.models.inventario import InventoryLog
    from app.utils.date_utils import BOLIVIA_TZ
    from datetime import datetime
    
    movimientos = await InventoryLog.find(query).sort("-created_at").limit(5000).to_list()
    
    rows = []
    for mov in movimientos:
        rows.append({
            "FECHA": mov.created_at.astimezone(BOLIVIA_TZ).strftime("%Y-%m-%d %H:%M:%S"),
            "PRODUCTO": mov.descripcion or "Producto Sin Nombre",
            "TIPO MOVIMIENTO": mov.tipo_movimiento.replace('_', ' '),
            "CANTIDAD": float(mov.cantidad_movida),
            "STOCK RESULTANTE": float(mov.stock_resultante),
            "COSTO UNIT.": float(mov.costo_unitario_momento or 0),
            "PRECIO VENTA UNIT.": float(mov.precio_venta_momento or 0),
            "USUARIO": mov.usuario_nombre,
            "NOTAS": mov.notas or ""
        })
        
    df = pd.DataFrame(rows)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Kardex', index=False)
        
    output.seek(0)
    
    fecha_str = datetime.now(BOLIVIA_TZ).strftime("%Y-%m-%d")
    filename = f"Kardex_{sucursal_id}_{fecha_str}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/inventario/exportar-plantilla")
async def export_inventory_template(
    sucursal_id: str = "CENTRAL",
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="No autorizado")
        
    tenant_id = current_user.tenant_id or "default"
    
    # Validation branch access
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR] and sucursal_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="Solo puedes exportar tu propia sucursal")
        
    from app.domain.models.sucursal import Sucursal
    from app.domain.models.category import Category

    # "CENTRAL" is a logical name, not a real ObjectId — handle gracefully
    suc_name = "CENTRAL"
    if sucursal_id and sucursal_id != "CENTRAL":
        try:
            sucursal_db = await Sucursal.get(sucursal_id)
            if sucursal_db:
                suc_name = sucursal_db.nombre.replace(" ", "").upper()
        except Exception:
            pass  # Invalid ObjectId or not found — fall back to "CENTRAL"

    products = await Product.find(Product.tenant_id == tenant_id, Product.is_active == True).to_list()

    # Build category map once (DRY) to resolve IDs → names without N+1 queries
    categories = await Category.find(Category.tenant_id == tenant_id).to_list()
    cat_name_map: dict = {str(c.id): c.name for c in categories}

    data = []
    for p in products:
        data.append({
            "CODIGO":        p.codigo_largo or "",
            "CODIGO CORTO":  p.codigo_corto or "",
            "DESCRIPCION":   p.descripcion,
            "CATEGORIA":     cat_name_map.get(p.categoria_id, p.categoria_id),  # name, not raw ID
            "PROVEEDOR":     getattr(p, "proveedor", "") or "",
            f"INVENTARIO FISICO {suc_name}": ""  # User fills this in
        })

    df = pd.DataFrame(data)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Conteo Fisico', index=False)

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=plantilla_inventario_{suc_name}.xlsx"}
    )


@router.post("/inventario/importar")
async def import_inventory(
    sucursal_id: str = "CENTRAL",
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    from app.application.services.inventario_service import InventarioService
    contents = await file.read()
    return await InventarioService.importar_inventario(sucursal_id, contents, file.filename, current_user)
        

@router.post("/inventario/sincronizar-sucursal")
async def sincronizar_inventario_sucursal(
    sucursal_id: str = None,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    from app.application.services.inventario_service import InventarioService
    contents = await file.read()
    return await InventarioService.sincronizar_sucursal(sucursal_id, contents, file.filename, current_user)

