from typing import Optional, Any, Annotated
from datetime import datetime
from pydantic import BaseModel, BeforeValidator, PlainSerializer
import decimal
from decimal import Decimal, ROUND_HALF_UP

# Configuración Global: Desactivar trampas de Inexact y Rounded.
# Esto evita que PyMongo lance excepciones al convertir Decimal -> Decimal128
# cuando hay residuos mínimos de punto flotante en ambientes como Render.
decimal.getcontext().traps[decimal.Inexact] = False
decimal.getcontext().traps[decimal.Rounded] = False




# Smart Type: Coerces BSON/floats to Decimal exactly, while satisfying React/Pydantic JSON with floats.
def _coerce_decimal(v: Any) -> Decimal:
    if v is None:
        return v
    if type(v).__name__ == "Decimal128":
        return v.to_decimal().quantize(Decimal("0.00"), rounding=ROUND_HALF_UP)
    
    # Convert to string to avoid float precision artifacts, then quantize to 2 decimals
    return Decimal(str(v)).quantize(Decimal("0.00"), rounding=ROUND_HALF_UP)


DecimalMoney = Annotated[
    Decimal,
    BeforeValidator(_coerce_decimal),
    PlainSerializer(lambda v: float(v), return_type=float, when_used='json')
]

class SoftDeleteMixin(BaseModel):
    is_active: bool = True
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
