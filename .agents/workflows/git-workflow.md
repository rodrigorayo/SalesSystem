---
description: Reglas estrictas de Git para el desarrollo de nuevas funciones, refactorización y corrección de bugs
---

# Git Workflow: Creación de Funciones, Fixes y Refactorización

**IMPORTANTE:** Como Asistente de IA (Antigravity), nunca debes hacer commits directos ni empujar (`git push`) directamente a las ramas `main` o `develop` a menos que el usuario lo solicite expresamente de manera explícita para un Hotfix urgente.

Para todo nuevo desarrollo, debes seguir de manera rigurosa los siguientes pasos:

## 1. Sincronización Inicial
Asegúrate de partir siempre desde una base actualizada:
```bash
git checkout develop
git pull origin develop
```

## 2. Creación de Rama de Trabajo (Feature Branch)
Crea siempre una rama aislada con prefijos estándar según el tipo de trabajo:
- `feat/nombre-descriptivo` (Para nuevas características)
- `fix/nombre-descriptivo` (Para resolver errores o bugs)
- `refactor/nombre-descriptivo` (Para reestructuración de código)

```bash
git checkout -b feat/descripcion-corta
```

## 3. Desarrollo y Verificación Local
- Escribe el código necesario en la arquitectura (Backend/Frontend).
- Asegúrate de correr los linters (ej. `ruff`) y cualquier test en el que el código impacte.
- Si tocaste frontend, puedes verificar la compilación con `npm run build`.

## 4. Commits Atomizados y Claros
Haz commits que sigan las convenciones de *Conventional Commits*:
```bash
git add .
git commit -m "feat(modulo): descripción clara de lo que se implementó"
```

## 5. Subir a GitHub (Empujar Rama)
Publica tu rama de trabajo en el servidor remoto (GitHub) para que el Usuario y el resto del equipo puedan revisar los cambios visualmente:
```bash
git push -u origin feat/descripcion-corta
```

## 6. Notificar al Usuario
Inmediatamente terminada la subida, utiliza `notify_user` para avisarle al usuario que:
1. La rama `feat/xyz` ya está en GitHub.
2. Un resumen breve y claro de la lógica que se programó en dicha rama, para que puedan probar localmente o iniciar un Pull Request web.
