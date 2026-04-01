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
from app.domain.schemas.inventario import InventarioItem, AjusteInventario, InventarioPaginated

router = APIRouter()


@router.get("/inventario", response_model=InventarioPaginated)
async def get_inventario(
    sucursal_id: str = "CENTRAL",
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
        # Using $text native index search! Extremely fast.
        prod_match["$text"] = {"$search": search.strip()}
    if categoria_id:
        prod_match["categoria_id"] = categoria_id

    pipeline = [{"$match": prod_match}]
    
    # Lookup the inventory for this specific branch
    inv_coll = Inventario.get_collection_name()
    pipeline.append({
        "$lookup": {
            "from": inv_coll,
            "let": {"pid": {"$toString": "$_id"}},
            "pipeline": [
                {"$match": {
                    "$expr": {"$eq": ["$producto_id", "$$pid"]},
                    "sucursal_id": sucursal_id,
                    "tenant_id": tenant_id
                }}
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
                {"$sort": {"score": {"$meta": "textScore"}} if search else {"_id": -1}},
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

    entry = await Inventario.find_one(
        Inventario.tenant_id == tenant_id,
        Inventario.sucursal_id == sucursal_id,
        Inventario.producto_id == ajuste.producto_id,
    )

    stock_anterior = entry.cantidad if entry else 0
    cantidad_cambio = 0
    
    from app.domain.models.inventario import TipoMovimiento, InventoryLog

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
        
    from app.domain.models.inventario import InventoryLog
    
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
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="No autorizado")
        
    tenant_id = current_user.tenant_id or "default"
    
    # Validation branch access
    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR] and sucursal_id != current_user.sucursal_id:
        raise HTTPException(status_code=403, detail="Solo puedes exportar tu propia sucursal")
        
    from app.domain.models.sucursal import Sucursal
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
            "PROVEEDOR": getattr(p, "proveedor", "") or "",
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

