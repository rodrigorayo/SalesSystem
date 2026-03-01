from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class SoftDeleteMixin(BaseModel):
    is_active: bool = True
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
