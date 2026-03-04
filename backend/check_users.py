import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.tenant import Tenant
from app.models.user import User
from beanie import init_beanie

async def check():
    url = os.environ.get("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db = client.get_default_database()
    await init_beanie(database=db, document_models=[Tenant, User])
    ts = [(str(t.id), t.name) for t in await Tenant.find_all().to_list()]
    us = [(str(u.id), u.email, u.tenant_id) for u in await User.find_all().to_list()]
    print("Tenants:", ts)
    print("Users:", us)

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    asyncio.run(check())
