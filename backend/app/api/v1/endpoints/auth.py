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

router = APIRouter()

@router.post("/token")
@limiter.limit("5/minute")
async def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    import re
    # Use native re case-insensitive regex match — re.escape() prevents dots/@ in emails from breaking the pattern
    user = await User.find_one({"username": re.compile(f"^{re.escape(form_data.username)}$", re.IGNORECASE)})
    if not user or not verify_password(form_data.password, user.hashed_password):
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

@router.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

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
