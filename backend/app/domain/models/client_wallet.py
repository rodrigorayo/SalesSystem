from typing import Optional
from beanie import Document
from pydantic import Field
from datetime import datetime

class ClientWallet(Document):
    """
    Billetera de créditos/servicios para clientes (ej. Dark Kitchens, Servicios, Suscripciones).
    Almacena los paquetes comprados y su saldo o caducidad.
    """
    tenant_id: str
    cliente_id: str
    producto_paquete_id: str
    saldo_creditos: float = Field(default=0.0)
    fecha_vencimiento: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "client_wallets"
        indexes = [
            "tenant_id",
            "cliente_id",
            ["tenant_id", "cliente_id"]
        ]
