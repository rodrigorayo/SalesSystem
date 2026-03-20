import asyncio
import motor.motor_asyncio
import os
from app.db import init_db
from app.models.user import User, UserRole
from app.auth import get_password_hash

# USAGE: 
# Windows PowerShell: 
# $env:MONGODB_URL="tu_connection_string_aqui"; python create_superadmin.py

async def main():
    mongo_uri = os.environ.get("MONGODB_URL")
    if not mongo_uri:
        print("ERROR: Necesitas definir la variable de entorno MONGODB_URL")
        return

    print(f"Connecting to MongoDB...")
    
    print("Initializing Beanie models...")
    # Le pasamos la URL directamente a init_db para que se conecte a Atlas
    os.environ["MONGODB_URL"] = mongo_uri
    await init_db()
    
    # 2. Check if admin already exists to avoid duplicates
    existing_admin = await User.find_one(User.email == "rodrigorayomartinez@gmail.com")
    
    if existing_admin:
        print("El superadmin ya existe en la base de datos.")
        return

    print("Creating new Super Admin in Production...")
    hashed_password = get_password_hash("2946370Rm!")
    
    admin = User(
        username="rodrigorayomartinez@gmail.com",
        email="rodrigorayomartinez@gmail.com",
        hashed_password=hashed_password,
        role=UserRole.SUPERADMIN,
        full_name="Rodrigo Rayo Martinez"
    )
    await admin.create()
    print("Super Admin created successfully in MongoDB Atlas!")
    print(f"Username: {admin.username}")
    print("Password: [HIDDEN]")

if __name__ == "__main__":
    asyncio.run(main())
