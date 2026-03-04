import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
from app.models.sucursal import Sucursal

async def test():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(database=client[settings.MONGODB_DB_NAME], document_models=[Sucursal])
    try:
        res = await Sucursal.find(fetch_links=True).to_list()
        print("SUCCESS fetch_links:", len(res))
    except Exception as e:
        print("ERROR fetch_links:", type(e), str(e))

asyncio.run(test())
