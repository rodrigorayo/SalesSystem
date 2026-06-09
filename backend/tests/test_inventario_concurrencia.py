import pytest
import asyncio
from httpx import AsyncClient
from app.main import app

@pytest.mark.skip(reason="Requires a test database and fixtures setup (e.g. authenticated_client)")
@pytest.mark.asyncio
async def test_ajuste_inventario_concurrencia():
    # Asume que tienes fixtures `authenticated_client`, `create_tenant` y `create_product`.
    # Si no tienes estas fixtures en tu entorno de test actual, este test es una muestra de cómo 
    # se estructura una prueba de concurrencia.
    
    tenant_id = create_tenant["_id"]
    producto_id = create_product["_id"]
    sucursal_id = "CENTRAL"
    
    # Payload para ajustar inventario (+1 unidad)
    payload = {
        "producto_id": str(producto_id),
        "tipo": "ENTRADA",
        "cantidad": 1,
        "notas": "Prueba de concurrencia"
    }

    # Lanzamos 20 peticiones simultáneas
    reqs = [
        authenticated_client.post(f"/api/v1/inventario/ajuste?sucursal_id={sucursal_id}", json=payload)
        for _ in range(20)
    ]
    
    responses = await asyncio.gather(*reqs)
    
    # Todas las peticiones deberían ser 200 OK
    for res in responses:
        assert res.status_code == 200
        
    # El stock final debería ser 20
    # Obtenemos el stock final consultando la API
    res = await authenticated_client.get(f"/api/v1/inventario?sucursal_id={sucursal_id}&search={create_product['descripcion']}")
    data = res.json()
    
    items = data["items"]
    assert len(items) == 1
    assert items[0]["cantidad"] == 20
