from fastapi import APIRouter, Depends
from typing import List, Optional
from app.domain.models.user import User, UserRole
from app.domain.models.audit import AuditLog
from app.infrastructure.core.dependencies import require_roles

router = APIRouter()

@router.get("/", response_model=List[AuditLog])
async def get_audit_logs(
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMIN_MATRIZ)),
    limit: int = 100,
    skip: int = 0,
    action: Optional[str] = None,
    entity: Optional[str] = None,
    username: Optional[str] = None
):
    query = {}
    if current_user.role != UserRole.SUPERADMIN:
        query["tenant_id"] = current_user.tenant_id or "default"

    if action:
        query["action"] = action
    if entity:
        query["entity"] = entity
    if username:
        query["username"] = {"$regex": username, "$options": "i"}

    logs = await AuditLog.find(query).sort("-created_at").skip(skip).limit(limit).to_list()
    return logs
