import motor.motor_asyncio
from beanie import init_beanie
from app.domain.models.user import User
from app.domain.models.tenant import Tenant
from app.domain.models.sucursal import Sucursal
from app.domain.models.product import Product
from app.domain.models.inventario import Inventario, InventoryLog
from app.domain.models.pedido_interno import PedidoInterno
from app.domain.models.sale import Sale
from app.domain.models.category import Category
from app.domain.models.audit import AuditLog
from app.domain.models.descuento import Descuento
from app.domain.models.caja import CajaMovimiento, CajaSesion, CajaGastoCategoria
from app.domain.models.plan import Plan
from app.domain.models.sale_item import SaleItem
from app.domain.models.cost_history import ProductCostHistory
from app.domain.models.price_request import PriceChangeRequest
from app.domain.models.plan_feature import PlanFeatureDocument
from app.domain.models.pedido_item import PedidoItemDocument
from app.domain.models.cliente import Cliente
from app.domain.models.price_list import ListaPrecio, ListaPrecioItem
from app.domain.models.credito import CuentaCredito, Deuda, TransaccionCredito
from app.domain.models.b2b import NotaDevolucionMerma, NotaTraspaso, InventarioMovil

from app.infrastructure.core.config import settings

_client = None

async def init_db():
    global _client
    _client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=_client.salessystem,
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
            CuentaCredito,
            Deuda,
            TransaccionCredito,
            NotaDevolucionMerma,
            NotaTraspaso,
            InventarioMovil
        ]
    )

def get_client() -> motor.motor_asyncio.AsyncIOMotorClient:
    """
    Retorna el cliente asíncrono de MongoDB conectado.
    Sigue el principio DRY para no tener que extraer el cliente
    desde los Modelos individualmente en cada servicio.
    """
    global _client
    if _client is None:
        raise RuntimeError("Database not initialized")
    return _client
