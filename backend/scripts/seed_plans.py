"""
Script para sembrar los 4 planes base en MongoDB.
Ejecutar una sola vez en producción:
    python scripts/seed_plans.py

Si los planes ya existen, los actualiza (upsert por code).
"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.infrastructure.db import init_db
from app.domain.models.plan import Plan
from app.domain.models.plan_feature import PlanFeature
from decimal import Decimal


PLANES = [
    {
        "code": "BASICO",
        "name": "Plan Básico",
        "max_sucursales": 1,
        "max_usuarios": 5,
        "precio_mensual": Decimal("150.00"),
        "is_public": True,
        "features": [
            PlanFeature.VENTAS,
            PlanFeature.INVENTARIO,
            PlanFeature.CAJA,
            PlanFeature.CLIENTES,
            PlanFeature.CREDITOS,
        ],
    },
    {
        "code": "PRO",
        "name": "Plan Profesional",
        "max_sucursales": 3,
        "max_usuarios": 20,
        "precio_mensual": Decimal("350.00"),
        "is_public": True,
        "features": [
            PlanFeature.VENTAS,
            PlanFeature.INVENTARIO,
            PlanFeature.CAJA,
            PlanFeature.CAJA_AVANZADA,
            PlanFeature.CLIENTES,
            PlanFeature.CREDITOS,
            PlanFeature.DESCUENTOS_AVANZADOS,
            PlanFeature.LISTAS_PRECIOS,
            PlanFeature.PRICE_REQUESTS,
            PlanFeature.REPORTES_AVANZADOS,
            PlanFeature.AUDITORIA,
        ],
    },
    {
        "code": "ENTERPRISE",
        "name": "Plan Enterprise",
        "max_sucursales": -1,
        "max_usuarios": -1,
        "precio_mensual": Decimal("800.00"),
        "is_public": True,
        "features": [
            PlanFeature.VENTAS,
            PlanFeature.INVENTARIO,
            PlanFeature.CAJA,
            PlanFeature.CAJA_AVANZADA,
            PlanFeature.CLIENTES,
            PlanFeature.CREDITOS,
            PlanFeature.DESCUENTOS_AVANZADOS,
            PlanFeature.LISTAS_PRECIOS,
            PlanFeature.PRICE_REQUESTS,
            PlanFeature.REPORTES_AVANZADOS,
            PlanFeature.AUDITORIA,
            PlanFeature.MULTI_SUCURSAL,
            PlanFeature.PEDIDOS_INTERNOS,
            PlanFeature.CONTROL_QR,
            PlanFeature.API_ACCESO,
        ],
    },
    {
        "code": "ILIMITADO",
        "name": "Plan Ilimitado (Interno)",
        "max_sucursales": -1,
        "max_usuarios": -1,
        "precio_mensual": Decimal("0.00"),
        "is_public": False,   # No aparece en página de precios
        "features": list(PlanFeature),  # TODOS los módulos
    },
]


async def seed():
    await init_db()

    for plan_data in PLANES:
        existing = await Plan.find_one({"code": plan_data["code"]})
        if existing:
            existing.name            = plan_data["name"]
            existing.max_sucursales  = plan_data["max_sucursales"]
            existing.max_usuarios    = plan_data["max_usuarios"]
            existing.precio_mensual  = plan_data["precio_mensual"]
            existing.is_public       = plan_data["is_public"]
            existing.features        = plan_data["features"]
            await existing.save()
            print(f"  ✔ Actualizado: {plan_data['code']}")
        else:
            plan = Plan(**plan_data)
            await plan.create()
            print(f"  ✅ Creado:     {plan_data['code']}")

    print("\n🎉 Seed de planes completado.")


if __name__ == "__main__":
    asyncio.run(seed())
