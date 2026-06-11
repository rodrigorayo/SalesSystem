import pytest
import pytest_asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from app.infrastructure.db import init_db
from app.infrastructure.core.config import settings

# Sobreescribimos la variable de entorno para que Beanie use una DB de prueba
os.environ["MONGODB_URL"] = os.getenv("MONGO_URI", "mongodb://localhost:27017/salessystem_test_local")

@pytest_asyncio.fixture(scope="session", autouse=True)
async def initialize_test_database():
    """
    Se ejecuta automáticamente al inicio de los tests.
    Levanta una conexión real o en memoria a MongoDB para que Beanie inicialice sus colecciones.
    """
    # Para tests, ignoramos la configuración de entorno y forzamos la URL de prueba
    client = AsyncIOMotorClient(os.environ["MONGODB_URL"])
    
    # Inicializa los modelos de Beanie
    await init_db()
    
    yield
    
    # Limpieza final si se necesita (opcional, GitHub Actions destruye el contenedor)
    await client.drop_database(client.get_default_database().name)
