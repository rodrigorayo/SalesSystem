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
from app.domain.models.user import User, UserRole
from app.infrastructure.auth import get_current_active_user
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
    
    query = {
        "tenant_id": tenant_id,
        "sucursal_id": sucursal_id,
        "almacen_id": almacen_id,
        "producto_id": ajuste.producto_id,
    }

    # Fetch previous stock to calculate 'cantidad_cambio'
    # We do a read first just to know the old stock for the Kardex log, 
    # but the actual update is atomic.
    entry_before = await motor_coll.find_one(query)
    stock_anterior = entry_before["cantidad"] if entry_before else 0

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
            "$set": {"updated_at": now},
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
                    "almacen_id": almacen_id,
                    "producto_id": ajuste.producto_id,
                    "created_at": {"$ifNull": ["$created_at", now]}
                }
            }
        ]
        tipo_mov = TipoMovimiento.SALIDA_MANUAL
    elif ajuste.tipo == "AJUSTE":
        update = {
            "$set": {"cantidad": ajuste.cantidad, "updated_at": now},
            "$setOnInsert": set_on_insert
        }
        tipo_mov = TipoMovimiento.AJUSTE_FISICO
    else:
        raise HTTPException(status_code=400, detail="Tipo de ajuste inválido")

    # Ejecutar operación atómica
    updated_doc = await motor_coll.find_one_and_update(
        query,
        update,
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    
    nuevo_stock = updated_doc["cantidad"]
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


@router.post("/inventario/ajuste-masivo")
async def ajustar_inventario_masivo(
    req: AjusteInventarioMasivoRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Manually adjust inventory for multiple products at once.
    """
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    tenant_id = current_user.tenant_id or ""
    sucursal_id = req.sucursal_id

    from app.domain.models.inventario import TipoMovimiento, InventoryLog
    
    resultados = []
    
    for ajuste in req.ajustes:
        if ajuste.cantidad < 0:
            continue
            
        product = await Product.get(ajuste.producto_id)
        if not product or (current_user.role != UserRole.SUPERADMIN and product.tenant_id != tenant_id):
            continue

        from pymongo import ReturnDocument
        from datetime import datetime

        motor_coll = Inventario.get_pymongo_collection()
        
        query = {
            "tenant_id": tenant_id,
            "sucursal_id": sucursal_id,
            "almacen_id": req.almacen_id,
            "producto_id": ajuste.producto_id,
        }

        entry_before = await motor_coll.find_one(query)
        stock_anterior = entry_before["cantidad"] if entry_before else 0

        now = datetime.utcnow()
        set_on_insert = {
            "tenant_id": tenant_id,
            "sucursal_id": sucursal_id,
            "almacen_id": req.almacen_id,
            "producto_id": ajuste.producto_id,
            "created_at": now,
        }

        if ajuste.tipo == "ENTRADA":
            update = {
                "$inc": {"cantidad": ajuste.cantidad},
                "$set": {"updated_at": now},
                "$setOnInsert": set_on_insert
            }
            tipo_mov = TipoMovimiento.ENTRADA_MANUAL
        elif ajuste.tipo == "SALIDA":
            update = [
                {
                    "$set": {
                        "cantidad": {"$max": [0, {"$subtract": [{"$ifNull": ["$cantidad", 0]}, ajuste.cantidad]}]},
                        "updated_at": now,
                        "tenant_id": tenant_id,
                        "sucursal_id": sucursal_id,
                        "almacen_id": req.almacen_id,
                        "producto_id": ajuste.producto_id,
                        "created_at": {"$ifNull": ["$created_at", now]}
                    }
                }
            ]
            tipo_mov = TipoMovimiento.SALIDA_MANUAL
        elif ajuste.tipo == "AJUSTE":
            update = {
                "$set": {"cantidad": ajuste.cantidad, "updated_at": now},
                "$setOnInsert": set_on_insert
            }
            tipo_mov = TipoMovimiento.AJUSTE_FISICO
        else:
            continue

        updated_doc = await motor_coll.find_one_and_update(
            query,
            update,
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
        
        nuevo_stock = updated_doc["cantidad"]
        cantidad_cambio = nuevo_stock - stock_anterior

        if cantidad_cambio != 0:
            mismatch_note = ""
            if ajuste.tipo == "AJUSTE":
                mismatch_note = f"[Ajuste Físico Masivo: Sistema tenía {stock_anterior} u., físico {nuevo_stock} u. Discrepancia: {'+' if cantidad_cambio > 0 else ''}{cantidad_cambio} u.]"
            elif ajuste.tipo == "ENTRADA":
                mismatch_note = f"[Entrada Masiva: {stock_anterior} u. -> {nuevo_stock} u. (+{ajuste.cantidad} u.)]"
            elif ajuste.tipo == "SALIDA":
                mismatch_note = f"[Salida Masiva: {stock_anterior} u. -> {nuevo_stock} u. (-{ajuste.cantidad} u.)]"
                
            final_notes = f"{mismatch_note} - {req.notas_generales}" if req.notas_generales else mismatch_note

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
            await log.create()
            
        resultados.append({
            "producto_id": ajuste.producto_id,
            "cantidad": nuevo_stock,
            "movimiento": cantidad_cambio
        })

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
        # Escapar caracteres especiales como ( ) + * para que se busquen literalmente y no rompan el motor de regex
        safe_search = re.escape(search)
        query["$or"] = [
            {"descripcion": {"$regex": safe_search, "$options": "i"}},
            {"notas": {"$regex": safe_search, "$options": "i"}},
            {"usuario_nombre": {"$regex": safe_search, "$options": "i"}},
            {"referencia_id": {"$regex": safe_search, "$options": "i"}}
        ]
        
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
        safe_search = re.escape(search)
        query["$or"] = [
            {"descripcion": {"$regex": safe_search, "$options": "i"}},
            {"notas": {"$regex": safe_search, "$options": "i"}},
            {"usuario_nombre": {"$regex": safe_search, "$options": "i"}},
            {"referencia_id": {"$regex": safe_search, "$options": "i"}}
        ]
        
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

