import asyncio
from app.db.database import init_db
from app.models.product import Inventario

async def main():
    await init_db()
    
    print("Settings dir:", dir(Inventario.get_settings()))
    print("Inventario dir:", dir(Inventario))

if __name__ == "__main__":
    asyncio.run(main())
