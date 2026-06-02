@echo off
echo Iniciando Servidor Backend...
cd /d "%~dp0backend"
if exist "..\.venv\Scripts\activate" (
    call "..\.venv\Scripts\activate"
)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
