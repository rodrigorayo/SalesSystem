@echo off
title SalesSystem - Iniciando Servidores...
color 0A

echo.
echo  ==========================================
echo   SALSSYSTEM - Iniciando entorno completo
echo  ==========================================
echo.

:: ── BACKEND ──────────────────────────────────
echo  [1/2] Iniciando Backend (FastAPI)...
cd /d "%~dp0backend"

if not exist "..\.venv\Scripts\activate.bat" (
    echo  [ERROR] No se encontro el entorno virtual en la raiz (.venv)
    echo  Ejecuta: python -m venv .venv ^&^& .venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

start "SalesSystem Backend :8000" cmd /k "cd /d %~dp0backend && call ..\.venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --port 8000"

:: Esperar 3 segundos para que el backend inicie
timeout /t 3 /nobreak > nul

:: ── FRONTEND ─────────────────────────────────
echo  [2/2] Iniciando Frontend (Vite/React)...
start "SalesSystem Frontend :5173" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo  ==========================================
echo   LISTO! Abre tu navegador en:
echo   http://localhost:5173
echo  ==========================================
echo.
echo  Cierra las ventanas de cmd para detener los servidores.
pause
