import asyncio
import motor.motor_asyncio
from app.db import init_db
from app.models.user import User, UserRole
from app.auth import get_password_hash
from app.core.config import settings

async def main():
    print(f"Connecting to MongoDB at {settings.MONGO_URI}...")
    client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGO_URI)
    
    print("Dropping database 'salessystem'...")
    await client.drop_database('salessystem')
    print("Database dropped completely.")
    
    print("Initializing Beanie models...")
    await init_db()
    
    print("Creating new Super Admin...")
    hashed_password = get_password_hash("2946370Rm!")
    
    admin = User(
        username="rodrigorayomartinez@gmail.com",
        email="rodrigorayomartinez@gmail.com",
        hashed_password=hashed_password,
        role=UserRole.SUPERADMIN,
        full_name="Rodrigo Rayo Martinez"
    )
    await admin.create()
    print("Super Admin created successfully!")
    print(f"Username: {admin.username}")
    print("Password: [HIDDEN]")

if __name__ == "__main__":
    asyncio.run(main())
