from app.infrastructure.db import init_db, get_client

async def get_raw_db():
    client = get_client()
    return client.salessystem
