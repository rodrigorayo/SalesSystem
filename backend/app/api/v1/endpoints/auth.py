from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.domain.models.user import User, UserRole
from app.infrastructure.auth import (
    create_access_token,
    verify_password,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    get_current_active_user
)
from fastapi import Request
from app.infrastructure.core.rate_limit import limiter
from bson import ObjectId

router = APIRouter()

# Hash falso pre-generado (bcrypt tarda ~300ms en procesarlo)
DUMMY_HASH = "$2b$12$EP.cEit4Tq3J2kI4kC/uFOq/jN0uC.P0oW.Hl0Qy5W7u3l/L8Q0H2"

@router.post("/token")
@limiter.limit("5/minute")
async def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    import re
    # Use native re case-insensitive regex match — re.escape() prevents dots/@ in emails from breaking the pattern
    user = await User.find_one({"username": re.compile(f"^{re.escape(form_data.username)}$", re.IGNORECASE)})
    
    # Prevenimos el Timing Attack: Siempre evaluamos un hash, exista el usuario o no
    password_valid = verify_password(form_data.password, user.hashed_password if user else DUMMY_HASH)
    
    if not user or not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

@router.get("/users/me")
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    user_dict = current_user.model_dump()
    if current_user.tenant_id:
        from app.domain.models.tenant import Tenant
        from beanie import PydanticObjectId
        try:
            tenant = await Tenant.get(PydanticObjectId(current_user.tenant_id))
            if tenant:
                user_dict["configuracion"] = tenant.configuracion
                user_dict["rubro"] = tenant.rubro.value
                user_dict["modulos_activos"] = tenant.modulos_activos
            else:
                user_dict["configuracion"] = {}
                user_dict["rubro"] = "RETAIL"
                user_dict["modulos_activos"] = ["INVENTARIO", "POS", "KARDEX"]
        except Exception:
            user_dict["configuracion"] = {}
            user_dict["rubro"] = "RETAIL"
            user_dict["modulos_activos"] = ["INVENTARIO", "POS", "KARDEX"]
    else:
        user_dict["configuracion"] = {}
        user_dict["rubro"] = "RETAIL"
        user_dict["modulos_activos"] = ["INVENTARIO", "POS", "KARDEX"]
    
    # Asegurar que el ID sea string
    user_dict["id"] = str(current_user.id)
    user_dict["_id"] = str(current_user.id)
    return user_dict

@router.post("/impersonate/{tenant_id}")
async def impersonate_tenant(tenant_id: str, current_user: User = Depends(get_current_active_user)):
    """[SUPERADMIN] Logs in as the ADMIN of the target tenant without password."""
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    admin_user = await User.find_one({"tenant_id": tenant_id, "role": UserRole.ADMIN_MATRIZ})
    if not admin_user:
        admin_user = await User.find_one({"tenant_id": tenant_id, "role": "ADMIN"})
        if not admin_user:
            raise HTTPException(status_code=404, detail="No ADMIN found for this tenant")
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": admin_user.username, "role": admin_user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": admin_user.role}

@router.post("/impersonate/user/{user_id}")
async def impersonate_user(user_id: str, current_user: User = Depends(get_current_active_user)):
    """[ADMIN_MATRIZ] Logs in as a specific user within the same tenant."""
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL]:
        raise HTTPException(status_code=403, detail="Not authorized to impersonate users")
        
    target_user = await User.get(ObjectId(user_id))
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if current_user.role != UserRole.SUPERADMIN and target_user.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Cannot impersonate user from another tenant")
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": target_user.username, "role": target_user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": target_user.role}
