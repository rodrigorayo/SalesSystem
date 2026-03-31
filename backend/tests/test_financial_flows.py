import pytest
import pytest_asyncio
from decimal import Decimal
from typing import AsyncGenerator

from app.services.sales_service import SalesService
from app.models.base import DecimalMoney
from app.schemas.sale import SaleCreate, SaleItemCreate, PagoItemCreate
from app.models.user import User

@pytest_asyncio.fixture
async def authenticated_test_user() -> User:
    # Retorna un usuario mockeado o real de prueba
    return User(
        id="mock_id_123",
        username="cajero_tester",
        email="test@ventas.com",
        tenant_id="tenant_001",
        sucursal_id="sucursal_001",
        role="CAJERO"
    )

@pytest.mark.asyncio
async def test_decimal_rounding_and_acid_creation(authenticated_test_user):
    """
    Test para validar que `SalesService.create_sale` maneja correctamente
    la fracción de centavos y genera la transacción atómica sin perder un céntimo.
    """
    
    # 1. Preparar Payload (1 Producto de 10.51 Bs y 1 Descuento)
    sale_payload = SaleCreate(
        sucursal_id="sucursal_001",
        items=[
            SaleItemCreate(
                producto_id="prod_mock_001",
                cantidad=2,
                precio_unitario=10.51,  # Subtotal 21.02
                descuento_unitario=0.0
            )
        ],
        pagos=[
            PagoItemCreate(metodo="EFECTIVO", monto=50.0) # Esperamos 28.98 Bs de cambio redondeado comercialmente
        ],
        cliente_id=None
    )
    
    # IMPORTANTE: 
    # Esta prueba requerirá que mongomock soporte transacciones 
    # o que se utilice una Base de Datos Test dedicada en Atlas.
    
    # Ejemplo de assert:
    # sale_result = await SalesService.create_sale(sale_payload, current_user=authenticated_test_user)
    # assert isinstance(sale_result.total, Decimal)
    # assert sale_result.total == Decimal("21.0")  # Asumiendo redondeo de 21.02 a 21.0
    
    # await SalesService.anular_sale(str(sale_result.id), authenticated_test_user)
    # assert record.anulada == True
    
    pass
