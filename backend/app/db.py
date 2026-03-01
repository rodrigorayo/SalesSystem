import motor.motor_asyncio
from beanie import init_beanie
from app.models.user import User
from app.models.tenant import Tenant
from app.models.sucursal import Sucursal
from app.models.product import Product
from app.models.inventario import Inventario, InventoryLog
from app.models.pedido_interno import PedidoInterno
from app.models.sale import Sale
from app.models.category import Category
from app.models.audit import AuditLog
from app.models.descuento import Descuento
from app.models.caja import CajaMovimiento, CajaSesion, CajaGastoCategoria
from app.models.plan import Plan
from app.models.sale_item import SaleItem
from app.models.cost_history import ProductCostHistory
from app.models.price_request import PriceChangeRequest
from app.models.plan_feature import PlanFeatureDocument
from app.models.pedido_item import PedidoItemDocument
from app.models.cliente import Cliente
from app.models.price_list import ListaPrecio, ListaPrecioItem

from app.core.config import settings

async def init_db():
    client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGO_URI)
    await init_beanie(
        database=client.salessystem,
        document_models=[
            User,
            Tenant,
            Sucursal,
            Product,
            Inventario,
            InventoryLog,
            PedidoInterno,
            Sale,
            Category,
            AuditLog,
            Descuento,
            CajaMovimiento,
            CajaSesion,
            CajaGastoCategoria,
            Plan,
            SaleItem,
            ProductCostHistory,
            PriceChangeRequest,
            PlanFeatureDocument,
            PedidoItemDocument,
            Cliente,
            ListaPrecio,
            ListaPrecioItem,
        ]
    )
