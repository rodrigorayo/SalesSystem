# Testing in SalesSystem

We use **Pytest** with **pytest-asyncio** and **httpx** to handle asynchronous API integration tests. 

### Why Tests?
Manual QA is impossible as the monolith grows. Every new piece of business logic (like restricting Colporteur stock or processing a Credit payment) should have at least one test.

### How to Run Tests
Before opening a Pull Request, run tests locally from the `backend/` folder:

```bash
# If using Unix/WSL/GitBash
PYTHONPATH=. pytest tests/ -v

# If using powershell
$env:PYTHONPATH="."; pytest tests/ -v
```

### The CI Pipeline (GitHub Actions)
If you forget to run tests or linters, **GitHub will block your PR**.
On every push/PR to `develop` or `main`:
1. `ruff check` will run. If it finds a trailing comma, unused import, or `NameError`, your build will fail.
2. `pytest tests/` will run. If an API behaves unexpectedly, your build will fail.

### Structure
- `tests/test_health.py` - Core stability endpoints.
- `tests/test_auth.py` *(planned)* - JWT, roles, and branch boundaries.
- `tests/test_sales.py` *(planned)* - POS workflows, credit validations.
