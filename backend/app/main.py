from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.db import init_db
from app.models.user import User, UserRole
from app.auth import get_password_hash
from app.api.v1.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    env_keys = list(os.environ.keys())
    
    if "localhost" in settings.MONGODB_URL or "127.0.0.1" in settings.MONGODB_URL:
        print(f"FATAL: MONGODB_URL IS LOCALHOST. ENV VARS IN VERCEL: {env_keys}")
        raise ValueError(f"Missing MONGODB_URL in Vercel Environment Variables! Re-check your Vercel Project Settings. Env keys found: {env_keys}")
        
    try:
        await init_db()
        print("Database initialized successfully.")
    except Exception as e:
        print(f"Failed to initialize database: {e}")
    
    # User initialization should be done via a dedicated script or secure endpoint
    yield

app = FastAPI(
    lifespan=lifespan,
    title=settings.PROJECT_NAME,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
)

@app.get("/")
def index():
    return {"message": "Welcome to Choco-Sys API - Please see /debug-env for debug info."}

@app.get("/debug-env")
def debug_env():
    import os
    env_vars = dict(os.environ)
    # Mask some sensitive vars except for the MONGODB_URL which we are debugging
    for k in list(env_vars.keys()):
        if "SECRET" in k or "JWT" in k:
            env_vars[k] = "***MASKED***"
    
    return {
        "status": "Vercel is running the Python code",
        "MONGODB_URL_CONFIG": settings.MONGODB_URL,
        "RAW_ENV_VARS": env_vars
    }

# Parse allowed origins from comma-separated env var
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
import os

STATIC_DIR = "/tmp/static" if settings.ENVIRONMENT == "production" else "static"
os.makedirs(os.path.join(STATIC_DIR, "images"), exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.include_router(api_router, prefix="/api/v1")
