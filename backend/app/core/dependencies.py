"""
Centralized FastAPI dependencies for authentication and role-based authorization.

Usage:
    from app.core.dependencies import require_roles, get_tenant_id

    # In an endpoint:
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERADMIN))
"""

from typing import Callable
from fastapi import Depends, HTTPException, status
from app.auth import get_current_active_user
from app.models.user import User, UserRole


def require_roles(*roles: UserRole) -> Callable:
    """
    Dependency factory that checks if the current user has one of the required roles.

    Example:
        @router.post("/products")
        async def create_product(
            data: ProductCreate,
            current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERADMIN))
        ):
            ...
    """
    async def checker(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para realizar esta acción."
            )
        return current_user
    return checker


def require_same_tenant(current_user: User, resource_tenant_id: str) -> None:
    """
    Helper (not a dependency) — validates that a resource belongs to the
    current user's tenant. SUPERADMIN bypasses this check.

    Raises HTTPException 403 if the tenant does not match.

    Example:
        product = await Product.get(product_id)
        require_same_tenant(current_user, product.tenant_id)
    """
    if current_user.role == UserRole.SUPERADMIN:
        return
    if current_user.tenant_id != resource_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este recurso."
        )


def get_tenant_id(current_user: User = Depends(get_current_active_user)) -> str:
    """
    Simple dependency that returns the current user's tenant_id.
    Useful to avoid repeating `current_user.tenant_id or 'default'` in every endpoint.
    """
    return current_user.tenant_id or "default"
