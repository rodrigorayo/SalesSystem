import asyncio
from app.db import init_db
from app.models.user import User, UserRole
from app.auth import get_password_hash

async def main():
    print("Initializing DB...")
    await init_db()
    
    print("Checking for admin user...")
    admin = await User.find_one(User.username == "admin")
    
    if admin:
        print(f"Admin user found: {admin.username}, Role: {admin.role}")
        print("Resetting password to 'admin123'...")
        admin.hashed_password = get_password_hash("admin123")
        await admin.save()
        print("Password reset successfully.")
    else:
        print("Admin user not found. Creating...")
        hashed_password = get_password_hash("admin123")
        admin = User(
            username="admin",
            hashed_password=hashed_password,
            role=UserRole.SUPERADMIN,
            full_name="Super Administrator"
        )
        await admin.create()
        print("Super Admin created: admin / admin123")

if __name__ == "__main__":
    asyncio.run(main())
