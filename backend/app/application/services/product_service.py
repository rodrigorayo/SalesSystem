import io
import math
import uuid
import pandas as pd
from typing import Optional, Dict, Any
from fastapi import HTTPException
from pymongo import UpdateOne
from bson import ObjectId

from app.domain.models.product import Product
from app.domain.models.category import Category
from app.domain.models.user import User, UserRole
from app.domain.models.sucursal import Sucursal
from app.domain.models.inventario import Inventario, InventoryLog, TipoMovimiento
from app.domain.schemas.product import ProductCreate, ProductUpdate

async def _enrich(product: Product) -> Product:
    if product.categoria_id:
        cat = await Category.get(product.categoria_id)
        if cat:
            product.categoria_nombre = cat.name
    return product

class ProductService:
    @staticmethod
    async def create_product(data: ProductCreate, current_user: User) -> Product:
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
                await Inventario.get_pymongo_collection().bulk_write(ops)
                
        product.precios_sucursales = data.precios_sucursales or {}
        return await _enrich(product)
    
    @staticmethod
    async def update_product(product_id: str, data: ProductUpdate, current_user: User) -> Product:
        if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN, UserRole.SUPERADMIN]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
        product = await Product.get(product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        if current_user.role != UserRole.SUPERADMIN and product.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=403, detail="Product not found")
    
        # Audit log
        from app.domain.models.audit import AuditLog
        from app.domain.models.cost_history import ProductCostHistory
        old = product.model_dump()
        updates = data.model_dump(exclude_none=True)
        changes = {k: {"old": old.get(k), "new": v} for k, v in updates.items() if old.get(k) != v}
        
        if changes:
            # P-02: Cost History Trigger
            if "costo_producto" in changes:
                from decimal import Decimal
                costo_ant = Decimal(str(old.get("costo_producto") or 0))
                costo_nue = Decimal(str(updates.get("costo_producto") or 0))
                
                await ProductCostHistory(
                    tenant_id=product.tenant_id,
                    producto_id=str(product.id),
                    descripcion=product.descripcion,
                    costo_anterior=costo_ant,
                    costo_nuevo=costo_nue,
                    diferencia=round(costo_nue - costo_ant, 4),
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
                await Inventario.get_pymongo_collection().bulk_write(ops)
            product.precios_sucursales = precios
        else:
            # Load them to return properly to admin
            invs = await Inventario.find(Inventario.producto_id == str(product.id)).to_list()
            product.precios_sucursales = {i.sucursal_id: i.precio_sucursal for i in invs if i.precio_sucursal is not None}
            
        return await _enrich(product)
    
    @staticmethod
    async def deactivate_product(product_id: str, current_user: User):
        if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN, UserRole.SUPERADMIN]:
            raise HTTPException(status_code=403, detail="Not authorized")
        product = await Product.get(product_id)
        if not product or (current_user.role != UserRole.SUPERADMIN and product.tenant_id != current_user.tenant_id):
            raise HTTPException(status_code=404, detail="Product not found")
        product.is_active = False
        await product.save()
        return {"message": "Product deactivated"}
    
