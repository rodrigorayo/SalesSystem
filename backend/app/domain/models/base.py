from typing import Optional, Any, Annotated
from datetime import datetime
from pydantic import BaseModel, BeforeValidator, PlainSerializer
from decimal import Decimal

# Smart Type: Coerces BSON/floats to Decimal exactly, while satisfying React/Pydantic JSON with floats.
def _coerce_decimal(v: Any) -> Decimal:
    if v is None:
        return v
    if type(v).__name__ == "Decimal128":
        return v.to_decimal()
    return Decimal(str(v))

DecimalMoney = Annotated[
    Decimal,
    BeforeValidator(_coerce_decimal),
    PlainSerializer(lambda v: float(v), return_type=float, when_used='json')
]

class SoftDeleteMixin(BaseModel):
    is_active: bool = True
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
