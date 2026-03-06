"""
Diagnostic script: checks if a specific user exists in the DB and verifies
their password using the same logic as the auth endpoint.
Run from backend/ directory: python diag_login.py
"""
import asyncio, os, re
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def main():
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://user:password@localhost:27017")
    client = AsyncIOMotorClient(mongo_url)

    # Determine DB name from URL
    db_name = mongo_url.split("/")[-1].split("?")[0]
    if not db_name or "localhost" in db_name or db_name == "":
        db_name = "salessystem"

    db = client[db_name]
    print(f"Connected to DB: {db_name}")

    username_to_find = "taboada.heroinas@gmail.com"
    password_to_check = "7415963Ht@"

    # 1. Exact match
    user = await db["users"].find_one({"username": username_to_find})
    if user:
        print(f"[EXACT MATCH] username='{user['username']}' role={user.get('role')}")
    else:
        print("[NO EXACT MATCH] Trying case-insensitive...")
        user = await db["users"].find_one({
            "username": re.compile(f"^{re.escape(username_to_find)}$", re.IGNORECASE)
        })
        if user:
            print(f"[CASE-INSENSITIVE MATCH] username='{user['username']}' role={user.get('role')}")
        else:
            print("[NOT FOUND] User does not exist in the database at all.")
            # List all users for debugging
            all_users = await db["users"].find({}, {"username": 1, "role": 1}).to_list(50)
            print(f"\n--- All users in DB ({len(all_users)}) ---")
            for u in all_users:
                print(f"  {u.get('username')}  ({u.get('role')})")
            return

    # 2. Password check
    hashed = user.get("hashed_password", "")
    if not hashed:
        print("[ERROR] User has no hashed_password field!")
        return

    is_valid = pwd_context.verify(password_to_check, hashed)
    print(f"\nPassword '{password_to_check}' valid? => {is_valid}")
    if not is_valid:
        print("Password does NOT match the stored hash.")
        print(f"Stored hash: {hashed[:30]}...")
    else:
        print("Password matches. Login should work. Check backend deployment / restart.")

if __name__ == "__main__":
    asyncio.run(main())
