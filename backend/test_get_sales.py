import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, Document
from typing import List, Optional
from datetime import datetime
from pydantic import Field, BaseModel

# Redefine models for script
class SaleItem(BaseModel):
    producto_id: str
    producto_nombre: str
    cantidad: int
    precio: float
    subtotal: float

class PagoItem(BaseModel):
    metodo: str
    monto: float

class Sale(Document):
    tenant_id: str
    sucursal_id: str = "CENTRAL"
    items: List[SaleItem]
    total: float
    pagos: List[PagoItem] = []
    anulada: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "sales"

async def run():
    client = AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    await init_beanie(database=client.salessystem, document_models=[Sale])
    
    # Mock current_user (rodrigo)
    # rodrigo in DB has tenant_id: default, role: ADMIN_MATRIZ
    current_user_tenant_id = "default"
    current_user_role = "ADMIN_MATRIZ"
    
    # Simulate get_sales(sucursal_id=None)
    sucursal_id = None
    
    filters = [Sale.tenant_id == current_user_tenant_id]
    if sucursal_id:
        filters.append(Sale.sucursal_id == sucursal_id)
        
    print(f"Applying filters: tenant_id='{current_user_tenant_id}', sucursal_id={sucursal_id}")
    
    sales = await Sale.find(*filters).sort(-Sale.created_at).limit(100).to_list()
    print(f"Found {len(sales)} sales.")
    for s in sales[:3]:
        print(f"ID: {s.id}, Date: {s.created_at}, Tenant: {s.tenant_id}, Suc: {s.sucursal_id}")

if __name__ == '__main__':
    asyncio.run(run())
