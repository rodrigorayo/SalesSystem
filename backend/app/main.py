from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.infrastructure.core.config import settings
from app.infrastructure.db import init_db
from app.api.v1.router import api_router
from app.infrastructure.core.rate_limit import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

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

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/")
def index():
    return {"message": "Welcome to Choco-Sys API", "docs": "/docs"}

@app.get("/health")
def health():
    """Safe health check — does not expose any environment variables."""
    return {"status": "ok", "environment": settings.ENVIRONMENT}

# Parse allowed origins from comma-separated env var
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]

# Permitir siempre la landing page de FEXCO
if "https://taboada-fexco.vercel.app" not in origins:
    origins.append("https://taboada-fexco.vercel.app")
# Permitir localhost para pruebas de la landing
if "http://localhost:4321" not in origins:
    origins.append("http://localhost:4321")

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
