# 🍫 Taboada System (Sales & Inventory Management)

![Project Status](https://img.shields.io/badge/status-active-success)
![Python](https://img.shields.io/badge/python-3.11+-blue)
![FastAPI](https://img.shields.io/badge/fastapi-0.100+-green)
![Architecture](https://img.shields.io/badge/architecture-clean-orange)

Sistema integral de gestión de ventas, inventarios y finanzas para empresas con múltiples sucursales (Multi-tenant). Diseñado con **Arquitectura Limpia (Hexagonal)** para garantizar escalabilidad, mantenibilidad y robustez financiera.

---

## 🚀 Arquitectura del Proyecto

El backend está estructurado siguiendo los principios de **Clean Architecture**, dividiendo las responsabilidades en capas desacopladas:

- **`app/domain`**: Modelos de datos (Beanie/MongoDB) y esquemas de validación (Pydantic). Contiene la lógica central del negocio.
- **`app/application`**: Casos de uso y servicios (lógica de orquestación, importación masiva de Excel, reglas financieras).
- **`app/infrastructure`**: Configuraciones de base de datos, autenticación JWT, rate limiting y utilidades del sistema.
- **`app/api`**: Ruteadores y puntos de entrada de FastAPI (V1).

---

## 🛠️ Stack Tecnológico

### Backend
- **Framework:** FastAPI
- **Base de Datos:** MongoDB (Motor / Beanie ODM)
- **Validación:** Pydantic V2
- **Excel:** Pandas / OpenPyXL
- **Autenticación:** JWT + OAuth2

### Frontend
- **Framework:** React + Vite
- **Styling:** Tailwind CSS
- **Estado:** Zustand

---

## 📦 Instalación y Desarrollo Local

### 1. Requisitos Previos
- Python 3.11+
- MongoDB (Local o Atlas)
- Node.js 18+

### 2. Configuración del Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Crea un archivo `.env` en la raíz de `/backend`:
```env
MONGODB_URL=tu_url_de_mongo
JWT_SECRET_KEY=tu_secreto_super_seguro
```

### 3. Ejecución
```bash
# Backend
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

---

## 🛡️ Integración Continua (CI/CD)
Este repositorio cuenta con un pipeline de **GitHub Actions** automatizado que valida:
1. **Linter:** Verificación estricta de sintaxis con Ruff.
2. **Tests:** Ejecución de suites de prueba con Pytest (cobertura de flujos financieros).
3. **Pydantic V2:** Cumplimiento de reglas de configuración modernas.

---

## 🤝 Contribución
Consulta el archivo [CONTRIBUTING.md](CONTRIBUTING.md) para conocer los estándares de código y flujos de trabajo de Git.

---

## 📝 Licencia
Este proyecto es de uso privado. Todos los derechos reservados.
