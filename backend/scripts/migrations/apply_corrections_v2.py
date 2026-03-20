import asyncio
import os
import sys
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db import init_db
from app.models.plan_feature import PlanFeature, PlanFeatureDocument
import motor.motor_asyncio

async def apply_corrections():
    print("Aplicando Correcciones v2...")
    await init_db()
    
    # 1. D-01: Schema validation for sales
    print("Aplicando Schema Validation a 'sales'...")
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    # Check if collection exists
    collections = await db.list_collection_names()
    if "sales" not in collections:
        await db.create_collection("sales")
        
    await db.command({
        "collMod": "sales",
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["tenant_id", "sucursal_id", "items", "total", "cashier_id"],
                "properties": {
                    "items": {
                        "bsonType": "array",
                        "minItems": 1,
                        "description": "Items must be an array of objects",
                        "items": {
                            "bsonType": "object",
                            "required": ["producto_id", "descripcion", "cantidad", "precio_unitario", "subtotal"],
                            "properties": {
                                "producto_id":        { "bsonType": "string" },
                                "descripcion":        { "bsonType": "string" },
                                "cantidad":           { "bsonType": "int", "minimum": 1 },
                                "precio_unitario":    { "bsonType": "double", "minimum": 0 },
                                "costo_unitario":     { "bsonType": "double", "minimum": 0 },
                                "descuento_unitario": { "bsonType": "double", "minimum": 0 },
                                "subtotal":           { "bsonType": "double", "minimum": 0 }
                            }
                        }
                    },
                    "pagos": {
                        "bsonType": "array",
                        "minItems": 1,
                        "description": "Payments must be an array",
                        "items": {
                            "bsonType": "object",
                            "required": ["metodo", "monto"],
                            "properties": {
                                "metodo": { "bsonType": "string", "enum": ["EFECTIVO", "QR", "TARJETA", "TRANSFERENCIA"] },
                                "monto":  { "bsonType": "double", "minimum": 0 }
                            }
                        }
                    }
                }
            }
        },
        "validationLevel": "strict",
        "validationAction": "error"
    })

    # 2. D-05: Seed Plan Features
    print("Seeding Plan Features catalog...")
    FEATURES_SEED = [
        { "code": "MULTI_SUCURSAL",       "name": "Múltiples Sucursales",    "description": "Acceso a más de una sucursal" },
        { "code": "REPORTES_AVANZADOS",   "name": "Reportes Avanzados",      "description": "Dashboards y exportaciones" },
        { "code": "API_ACCESO",           "name": "Acceso a API",            "description": "Integración vía REST API" },
        { "code": "PRICE_REQUESTS",       "name": "Solicitudes de Precio",   "description": "Flujo de aprobación de precios" },
        { "code": "PEDIDOS_INTERNOS",     "name": "Pedidos Internos",        "description": "Transferencias entre sucursales" },
        { "code": "DESCUENTOS_AVANZADOS", "name": "Descuentos Avanzados",    "description": "Descuentos con vigencia y horario" },
        { "code": "CLIENTES",             "name": "Gestión de Clientes",     "description": "Historial y fidelización" },
        { "code": "LISTAS_PRECIOS",       "name": "Listas de Precios",       "description": "Precios por segmento o volumen" },
    ]

    for f_data in FEATURES_SEED:
        await PlanFeatureDocument.find_one(PlanFeatureDocument.code == f_data["code"]).upsert(
            {"$set": f_data, "$setOnInsert": {"created_at": datetime.utcnow()}},
            on_insert=PlanFeatureDocument(**f_data)
        )
        
    print("Correcciones v2 aplicadas.")

if __name__ == "__main__":
    asyncio.run(apply_corrections())
