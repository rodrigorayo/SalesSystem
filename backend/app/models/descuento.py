from pydantic import BaseModel, Field, model_validator
from typing import Optional, Literal
from datetime import datetime
from bson import ObjectId
from beanie import Document

from .base import SoftDeleteMixin, DecimalMoney

class Descuento(Document, SoftDeleteMixin):
    tenant_id: str
    sucursal_id: Optional[str] = None
    aplica_todas_sucursales: bool = False
    nombre: str
    tipo: Literal["MONTO", "PORCENTAJE"]
    valor: DecimalMoney
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    dias_semana: Optional[list[int]] = None # [0..6]
    hora_inicio: Optional[str] = None # "HH:MM"
    hora_fin: Optional[str] = None
    uso_maximo: Optional[int] = None
    uso_actual: int = 0
    creado_por_rol: str = "ADMIN_MATRIZ"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @model_validator(mode="after")
    def validar_sucursal(self):
        if not self.aplica_todas_sucursales and not self.sucursal_id:
            raise ValueError("Debe especificar sucursal_id o marcar aplica_todas_sucursales=True")
        return self

    class Settings:
        name = "descuentos"
        indexes = [
            [("tenant_id", 1), ("sucursal_id", 1)],
            [("tenant_id", 1), ("is_active", 1)],
        ]

class DescuentoBase(BaseModel):
    nombre: str = Field(..., description="Nombre del descuento (ej. Tercera Edad, Mayorista)")
    tipo: str = Field(..., description="Tipo de descuento: MONTO o PORCENTAJE")
    valor: DecimalMoney = Field(..., gt=0, description="Valor numérico del descuento")
    is_active: bool = Field(True, description="Si el descuento está disponible para usarse")
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None

class DescuentoCreate(DescuentoBase):
    aplica_todas_sucursales: bool = False
    sucursal_id: Optional[str] = None

class DescuentoUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    valor: Optional[DecimalMoney] = None
    is_active: Optional[bool] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    aplica_todas_sucursales: Optional[bool] = None
    sucursal_id: Optional[str] = None

class DescuentoResponse(DescuentoBase):
    id: str = Field(..., alias="_id")
    tenant_id: str
    sucursal_id: str
    creado_por_rol: str
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat()}
