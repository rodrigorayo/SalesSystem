from typing import List, Optional
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, EmailStr, field_validator
from app.models.user import User, UserRole
from app.auth import get_current_active_user, get_password_hash

router = APIRouter()


class CajeroCreate(BaseModel):
    username: str
    email: EmailStr
    password: str = Field(
        ...,
        min_length=8,
        description="Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character."
    )
    full_name: str
    role: Optional[str] = "CAJERO"
    # NOTE: sucursal_id is intentionally NOT here — it is extracted from the JWT token

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r"[@$!%*?&#]", v):
            raise ValueError("Password must contain at least one special character (@$!%*?&#)")
        return v


@router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_active_user)):
    """
    Returns users scoped to the current user's context:
    - ADMIN_MATRIZ: all employees of the tenant
    - ADMIN_SUCURSAL: only cajeros in their own sucursal
    """
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if current_user.role == UserRole.SUPERADMIN:
        return await User.find(User.role == UserRole.CAJERO).to_list()

    if current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR]:
        # Strict isolation: only sees cajeros of their own sucursal
        return await User.find(
            User.tenant_id == current_user.tenant_id,
            User.sucursal_id == current_user.sucursal_id,
            User.role == UserRole.CAJERO,
        ).to_list()

    # ADMIN_MATRIZ: all employees of the tenant
    return await User.find(
        User.tenant_id == current_user.tenant_id,
        User.role == UserRole.CAJERO,
    ).to_list()


@router.post("/users/employee", response_model=User)
async def create_cajero(
    data: CajeroCreate,
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a CAJERO user.

    SECURITY RULE: sucursal_id is NEVER accepted from the request body.
    It is always extracted from the authenticated user's JWT context.

    - ADMIN_SUCURSAL → cajero is bound to their sucursal automatically.
    - ADMIN_MATRIZ   → cajero is bound to the matrix (no sucursal).
    """
    if current_user.role not in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    import re
    username_lower = data.username.lower()
    if await User.find_one({"username": re.compile(f"^{username_lower}$", re.IGNORECASE)}):
        raise HTTPException(status_code=400, detail="Username already exists")

    email_lower = data.email.lower()
    if await User.find_one({"email": re.compile(f"^{email_lower}$", re.IGNORECASE)}):
        raise HTTPException(status_code=400, detail="El correo electrónico ya está registrado")

    # Strict injection from JWT — client cannot override this
    sucursal_id = current_user.sucursal_id  # None if ADMIN_MATRIZ (matrix-level)

    hashed = get_password_hash(data.password)
    cajero = User(
        username=username_lower,
        email=data.email,
        hashed_password=hashed,
        full_name=data.full_name,
        role=data.role,
        tenant_id=current_user.tenant_id,
        sucursal_id=sucursal_id,  # injected from JWT, never from request
    )
    await cajero.create()
    return cajero


# Legacy /employees aliases kept for backward compatibility
@router.get("/employees", response_model=List[User])
async def get_employees(current_user: User = Depends(get_current_active_user)):
    return await get_users(current_user)


@router.post("/employees", response_model=User)
async def create_employee(data: CajeroCreate, current_user: User = Depends(get_current_active_user)):
    return await create_cajero(data, current_user)
