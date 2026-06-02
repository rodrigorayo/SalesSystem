---
description: Pipeline y Reglas Estrictas de GitHub Actions
---

# 🛡️ Reglas Strictas de GitHub Actions (Pre-Push Checks)

Antes de hacer un `git push` a `main` o a cualquier rama sincronizada, el agente y los desarrolladores deben respetar las siguientes directrices y verificar localmente para evitar roturas del Pipeline de Integración Continua (CI/CD) de GitHub.

## 1. Zero Warning Policy (Pydantic & Pytest)
GitHub Actions en este repositorio está configurado para fallar si los tests no pasan, y deberíamos evitar cualquier advertencia de Deprecación (DeprecationWarnings).
- **Pydantic V2:** No utilizar `class Config:`. En su lugar usar `model_config = ConfigDict(...)` en los modelos de Beanie/Pydantic, o `model_config = SettingsConfigDict(...)` para variables de entorno.
- **Imports Limpios:** El proyecto utiliza Arquitectura Limpia estricta. Ningún esquema (`domain/schemas`) puede importar de `application` o `api`. Ningún test (`tests/`) puede importar dependencias legacy como `app.schemas...`, deben apuntar a `app.domain.schemas...`.

## 2. Test Suites (Pytest)
Siempre ejecutar la suite de pruebas localmente. Si la lógica del modelo cambia, el test respectivo debe cambiar acorde a ello (Mapear parámetros actualizados o campos mandatorios como `PROVEEDOR`).
Comando de verificación local recomendada:
```bash
# Ejecutar desde root/backend
pytest tests/ -v
```

## 3. Ignorar Cache Locales (Gitignore) 
Bajo ninguna circunstancia subir archivos de cache, entornos virtuales o configuraciones privadas. 
**LA REGLA DE ORO:** Lo que se genera automáticamente por tu computadora NO va al repositorio. Solo el código fuente escrito por humanos (o el Agente) tiene permitido entrar.
Revisar que `.env*`, `.pytest_cache/`, `.vercel/`, `__pycache__/`, `.venv/` estén listados en el `.gitignore`.

// turbo
## Paso de Revisión Previa (Pre-Push)
Antes de un commit, si ves archivos de cache marcados para subir, bórralos del índice con:
```bash
git rm -r --cached .pytest_cache/
git rm -r --cached __pycache__/
```

1. `pytest tests/` (Verificar tests exitosos)
2. `python -c "from app.main import app; print('App syntax OK')"` (Verificar compilación e integridad de ruteadores)

## 4. Control Estricto de Dependencias Acopladas (Pip)
**LA REGLA ABSOLUTA:** Cualquier librería nueva que se instale en local (`pip install libreria_equis`) **DEBE SER ANOTADA INMEDIATAMENTE** en `backend/requirements.txt` (y `frontend/package.json` en JS).
Si esta regla se rompe ocurrirán 2 Desastres Críticos:
1. El CI/CD de GitHub fallará en las pruebas (Ej. `ModuleNotFoundError`) trancando subidas.
2. (Lo más grave): El servidor de **Producción (Render/Vercel/DigitalOcean)** **explotará y se caerá (Downtime)** en el reinicio del Build porque no tendrá instruido descargar el paquete vital para encender la App.
