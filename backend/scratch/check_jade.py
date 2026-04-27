import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.getcwd())

async def check_user():
    from app.domain.models.user import User
    from app.domain.models.sucursal import Sucursal
    from motor.motor_asyncio import AsyncIOMotorClient
    from beanie import init_beanie
    from app.infrastructure.core.config import settings

    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db_name = settings.MONGODB_URL.split("/")[-1].split("?")[0]
    await init_beanie(database=client[db_name], document_models=[User, Sucursal])

    user = await User.find_one(User.username == "jade.daza")
    if user:
        print(f"User: {user.username}")
        print(f"Role: {user.role}")
        print(f"Sucursal ID: {user.sucursal_id}")
        
        sucursal = await Sucursal.get(user.sucursal_id)
        if sucursal:
            print(f"Sucursal Name: {sucursal.nombre}")
            print(f"Sucursal Type: {sucursal.tipo}")
    else:
        print("User not found")

if __name__ == "__main__":
    asyncio.run(check_user())
