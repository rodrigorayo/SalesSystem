from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, tenants, users, products, sales,
    caja, categories, upload, analytics,
    sucursales, inventario, pedidos, descuentos,
    price_requests, clientes, price_lists, reports
)

api_router = APIRouter()

api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(tenants.router, tags=["tenants"])
api_router.include_router(sucursales.router, tags=["sucursales"])
api_router.include_router(users.router, tags=["users"])
api_router.include_router(products.router, tags=["products"])
api_router.include_router(inventario.router, tags=["inventario"])
api_router.include_router(pedidos.router, tags=["pedidos"])
api_router.include_router(sales.router, tags=["sales"])
api_router.include_router(caja.router, prefix="/caja", tags=["caja"])
api_router.include_router(categories.router, tags=["categories"])
api_router.include_router(upload.router, tags=["upload"])
api_router.include_router(descuentos.router, prefix="/descuentos", tags=["descuentos"])
api_router.include_router(price_requests.router, tags=["price_requests"])
api_router.include_router(clientes.router, tags=["clientes"])
api_router.include_router(price_lists.router, prefix="/listas-precios", tags=["price_lists"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])

