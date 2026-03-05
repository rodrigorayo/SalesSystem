from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
import re
from app.models.sucursal import Sucursal
from app.models.user import User, UserRole
from app.auth import get_current_active_user, get_password_hash

router = APIRouter()


class SucursalCreate(BaseModel):
    nombre: str
    ciudad: str            # required — e.g. "Cochabamba", "La Paz"
    direccion: str         # required — full street address
    telefono: Optional[str] = None
    # Admin credentials — created automatically with the branch
    admin_username: EmailStr
    admin_password: str = Field(
        ...,
        min_length=8,
        description="Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character."
    )

    @field_validator("admin_password")
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


class SucursalUpdate(BaseModel):
    nombre: Optional[str] = None
    ciudad: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    is_active: Optional[bool] = None


class SucursalCreatedResponse(BaseModel):
    sucursal: dict
    admin_credentials: dict  # surface credentials so the superadmin can hand them over


@router.get("/sucursales", response_model=List[Sucursal])
async def list_sucursales(current_user: User = Depends(get_current_active_user)):
    """List all branches for the current tenant."""
    if not current_user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant context")
    return await Sucursal.find(Sucursal.tenant_id == current_user.tenant_id).to_list()


@router.post("/sucursales")
async def create_sucursal(
    data: SucursalCreate,
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new branch AND its ADMIN_SUCURSAL user atomically.

    Only ADMIN_MATRIZ can do this. The new user is scoped strictly to this tenant + branch.
    Returns the created branch and the admin credentials for hand-off.
    """
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Only matrix admins can create branches")
    if not current_user.tenant_id:
        raise HTTPException(status_code=403, detail="No tenant context")

    # Validate username is not taken
    admin_username_lower = data.admin_username.lower()
    if await User.find_one({"username": {"$regex": f"^{admin_username_lower}$", "$options": "i"}}):
        raise HTTPException(status_code=400, detail=f"Username '{data.admin_username}' already exists")

    # 1. Create the Sucursal
    sucursal = Sucursal(
        tenant_id=current_user.tenant_id,
        nombre=data.nombre,
        ciudad=data.ciudad,
        direccion=data.direccion,
        telefono=data.telefono,
    )
    await sucursal.create()

    # 2. Create the ADMIN_SUCURSAL user bound to this branch
    hashed = get_password_hash(data.admin_password)
    admin = User(
        username=admin_username_lower,
        hashed_password=hashed,
        full_name=f"Admin {data.nombre}",
        role=UserRole.ADMIN_SUCURSAL,
        tenant_id=current_user.tenant_id,
        sucursal_id=str(sucursal.id),
    )
    await admin.create()

    return {
        "sucursal": {
            "id": str(sucursal.id),
            "nombre": sucursal.nombre,
            "ciudad": sucursal.ciudad,
            "direccion": sucursal.direccion,
            "telefono": sucursal.telefono,
            "tenant_id": sucursal.tenant_id,
            "is_active": sucursal.is_active,
            "created_at": sucursal.created_at.isoformat(),
        },
        "admin_credentials": {
            "username": data.admin_username,
            "password": data.admin_password,   # show once so admin can hand it over
            "role": "ADMIN_SUCURSAL",
            "sucursal_id": str(sucursal.id),
        }
    }


@router.put("/sucursales/{sucursal_id}", response_model=Sucursal)
async def update_sucursal(
    sucursal_id: str,
    data: SucursalUpdate,
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    sucursal = await Sucursal.get(sucursal_id)
    if not sucursal or sucursal.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Branch not found")

    updates = data.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(sucursal, field, value)
    await sucursal.save()
    return sucursal


@router.delete("/sucursales/{sucursal_id}")
async def deactivate_sucursal(
    sucursal_id: str,
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    sucursal = await Sucursal.get(sucursal_id)
    if not sucursal or sucursal.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Branch not found")

    sucursal.is_active = False
    await sucursal.save()
    return {"message": "Branch deactivated"}
