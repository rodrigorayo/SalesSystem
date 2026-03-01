from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Choco-Sys API"
    MONGO_URI: str = "mongodb://user:password@localhost:27017"
    JWT_SECRET_KEY: str = "supersecretkey_change_me_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    ENVIRONMENT: str = "development"
    
    class Config:
        env_file = ".env"

settings = Settings()
