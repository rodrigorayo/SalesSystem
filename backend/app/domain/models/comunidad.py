from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field
from beanie import Document
from enum import Enum

class PremioComunidad(str, Enum):
    TRUFA_CHOCOLATE = "TRUFA_CHOCOLATE"
    CHOCOLATE = "CHOCOLATE"
    DESCUENTO_2_MES = "DESCUENTO_2_MES"
    DESCUENTO_3_2SEMANAS = "DESCUENTO_3_2SEMANAS"
    DESCUENTO_4_1SEMANA = "DESCUENTO_4_1SEMANA"
    # Nuevos Descuentos Mayo FEXCO
    DESCUENTO_7_MAYO = "DESCUENTO_7_MAYO"
    DESCUENTO_5_MAYO = "DESCUENTO_5_MAYO"
    DESCUENTO_3_MAYO = "DESCUENTO_3_MAYO"

class ComunidadUser(Document):
    """
    Representa a un usuario que se registra desde la Landing Page de la comunidad (FEXCO).
    """
    tenant_id: str = "default"
    telefono: str
    
    # Datos de contacto
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    email: Optional[str] = None
    
    # Progreso
    ha_reclamado: bool = False
    premio_reclamado: Optional[PremioComunidad] = None
    reclamado_at: Optional[datetime] = None
    
    # Métricas
    visitas_pagina: int = 0
    ultima_visita: datetime = Field(default_factory=datetime.utcnow)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "comunidad_users"
        indexes = ["tenant_id", "telefono"]

class VisitaRegistro(Document):
    """
    Para trackear visitas genéricas a la landing page.
    """
    tenant_id: str = "default"
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    endpoint: str = "/"
    fecha: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "comunidad_visitas"
        indexes = ["tenant_id", "fecha"]
