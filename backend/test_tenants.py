import asyncio
from app.infrastructure.db import init_db
from app.domain.models.user import User

async def run_test():
    await init_db()
    users = await User.find_all().to_list()
    for u in users:
        print(f"User: {u.username}, Role: {u.role}, Tenant: {u.tenant_id}")

if __name__ == "__main__":
    asyncio.run(run_test())
