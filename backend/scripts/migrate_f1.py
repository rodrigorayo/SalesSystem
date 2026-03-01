import asyncio
import os
import sys

# Add backend to path so we can import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.plan import Plan
from app.models.tenant import Tenant
from app.models.user import User
from app.models.sucursal import Sucursal
from app.models.product import Product
from app.models.category import Category
from app.models.descuento import Descuento
from app.models.caja import CajaGastoCategoria
from app.db import init_db

async def migrate():
    print("Iniciando Migración Fase 1...")
    try:
        await init_db()
        print("DB Conectada.")
    except Exception as e:
        print(f"Error conectando a la DB: {e}")
        return

    # 1. Create Plans
    print("Creando planes BASIC y PRO...")
    basic = await Plan.find_one(Plan.code == "BASIC")
    if not basic:
        basic = Plan(
            code="BASIC",
            name="Plan Básico",
            max_sucursales=1,
            max_usuarios=3,
            features=["punto_venta_basico"],
            precio_mensual=29.99
        )
        await basic.insert()
        print("Plan BASIC creado.")
    
    pro = await Plan.find_one(Plan.code == "PRO")
    if not pro:
        pro = Plan(
            code="PRO",
            name="Plan Profesional",
            max_sucursales=-1,
            max_usuarios=-1,
            features=["multi_sucursal", "reportes_avanzados", "api_acceso"],
            precio_mensual=99.99
        )
        await pro.insert()
        print("Plan PRO creado.")

    # 2. Update Tenants
    print("Asociando plans a tenants...")
    basic_plan = await Plan.find_one(Plan.code == "BASIC")
    pro_plan = await Plan.find_one(Plan.code == "PRO")
    
    tenants = await Tenant.find_all().to_list()
    for t in tenants:
        if not t.plan_id:
            p = pro_plan if t.plan == "PRO" else basic_plan
            if p:
                t.plan_id = str(p.id)
                await t.save()
                print(f"Tenant {t.name} actualizado a {p.code}")

    # 3. Soft Delete Init
    print("Inicializando campos de soft delete...")
    models_to_fix = [Tenant, User, Category, Product, Sucursal, Descuento, CajaGastoCategoria]
    for model in models_to_fix:
        coll_name = model.get_collection_name()
        # set is_active if missing
        res1 = await model.find({"is_active": {"$exists": False}}).update({"$set": {"is_active": True}})
        # set deleted_at if missing
        res2 = await model.find({"deleted_at": {"$exists": False}}).update({"$set": {"deleted_at": None}})
        print(f"Modelo {model.__name__} actualizado.")

    print("Migración Fase 1 Completada con éxito.")

if __name__ == "__main__":
    asyncio.run(migrate())
