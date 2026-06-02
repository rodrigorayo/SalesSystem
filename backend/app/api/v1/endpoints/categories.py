from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.domain.models.category import Category
from app.domain.models.user import User, UserRole
from app.infrastructure.auth import get_current_active_user

router = APIRouter()

class CategoryCreate(BaseModel):
    name: str
    description: str = None

@router.get("/categories", response_model=List[Category])
async def get_categories(current_user: User = Depends(get_current_active_user)):
    # Superadmin sees all? Or just tenants? Let's stick to tenant isolation.
    if current_user.role == UserRole.SUPERADMIN:
        return await Category.find_all().to_list()
    return await Category.find(Category.tenant_id == current_user.tenant_id).to_list()

@router.post("/categories", response_model=Category)
async def create_category(category_in: CategoryCreate, current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if exists in tenant
    existing = await Category.find_one(Category.tenant_id == current_user.tenant_id, Category.name == category_in.name)
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")

    category = Category(
        **category_in.dict(),
        tenant_id=current_user.tenant_id
    )
    await category.create()
    return category

@router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    category = await Category.get(category_id)
    if not category or category.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Category not found")
        
    await category.delete()
    return {"message": "Category deleted"}
