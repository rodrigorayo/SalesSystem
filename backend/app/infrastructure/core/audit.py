from app.domain.models.audit import AuditLog
from typing import Dict, Any, Optional

async def log_audit(
    tenant_id: str,
    user_id: str,
    username: str,
    action: str,
    entity: str,
    entity_id: str,
    details: Optional[Dict[str, Any]] = None
):
    """
    Guarda una acción en la bóveda de auditoría.
    """
    try:
        audit_entry = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            username=username,
            action=action,
            entity=entity,
            entity_id=entity_id,
            details=details
        )
        await audit_entry.insert()
    except Exception as e:
        print(f"Failed to write audit log: {e}")
