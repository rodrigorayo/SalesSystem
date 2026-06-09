from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Choco-Sys API"
    MONGODB_URL: str = "mongodb://user:password@localhost:27017"
    JWT_SECRET_KEY: str = "supersecretkey_change_me_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 hour
    ALLOWED_ORIGINS: str = "https://salessystem-app.vercel.app,http://localhost:5173,http://127.0.0.1:5173"
    ENVIRONMENT: str = "development"
    
    # Cloudinary Integration
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
