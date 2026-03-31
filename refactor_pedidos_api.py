import os

file_path = "backend/app/api/v1/endpoints/pedidos.py"

with open(file_path, "r", encoding="utf-8", errors="surrogateescape") as f:
    content = f.read()

import re

# Regex to find these functions and replace them with short delegators

new_crear = '''@router.post("/pedidos", response_model=PedidoInterno)
async def crear_pedido(
    data: PedidoCreate,
    current_user: User = Depends(get_current_active_user)
):
    from app.services.pedidos_service import PedidosService
    return await PedidosService.crear_pedido(data, current_user)
'''
content = re.sub(r'@router\.post\("/pedidos", response_model=PedidoInterno\)\nasync def crear_pedido\([\s\S]*?    return pedido\n', new_crear, content, count=1)

new_cancelar = '''@router.patch("/pedidos/{pedido_id}/cancelar", response_model=PedidoInterno)
async def cancelar_pedido(
    pedido_id: str,
    current_user: User = Depends(get_current_active_user)
):
    from app.services.pedidos_service import PedidosService
    return await PedidosService.cancelar_pedido(pedido_id, current_user)
'''
content = re.sub(r'@router\.patch\("/pedidos/\{pedido_id\}/cancelar", response_model=PedidoInterno\)\nasync def cancelar_pedido\([\s\S]*?    return pedido\n', new_cancelar, content, count=1)


new_aceptar = '''@router.patch("/pedidos/{pedido_id}/aceptar", response_model=PedidoInterno)
async def aceptar_pedido(
    pedido_id: str,
    current_user: User = Depends(get_current_active_user)
):
    from app.services.pedidos_service import PedidosService
    return await PedidosService.aceptar_pedido(pedido_id, current_user)
'''
content = re.sub(r'@router\.patch\("/pedidos/\{pedido_id\}/aceptar", response_model=PedidoInterno\)\nasync def aceptar_pedido\([\s\S]*?    return pedido\n', new_aceptar, content, count=1)


new_despachar = '''@router.patch("/pedidos/{pedido_id}/despachar", response_model=PedidoInterno)
async def despachar_pedido(
    pedido_id: str,
    current_user: User = Depends(get_current_active_user)
):
    from app.services.pedidos_service import PedidosService
    return await PedidosService.despachar_pedido(pedido_id, current_user)
'''
content = re.sub(r'@router\.patch\("/pedidos/\{pedido_id\}/despachar", response_model=PedidoInterno\)\nasync def despachar_pedido\([\s\S]*?    return pedido\n', new_despachar, content, count=1)


new_recibir = '''@router.patch("/pedidos/{pedido_id}/recibir", response_model=PedidoInterno)
async def recibir_pedido(
    pedido_id: str,
    data: Optional[PedidoRecepcion] = None,
    current_user: User = Depends(get_current_active_user)
):
    from app.services.pedidos_service import PedidosService
    return await PedidosService.recibir_pedido(pedido_id, data, current_user)
'''
content = re.sub(r'@router\.patch\("/pedidos/\{pedido_id\}/recibir", response_model=PedidoInterno\)\nasync def recibir_pedido\([\s\S]*?    return pedido\n', new_recibir, content, count=1)


with open(file_path, "w", encoding="utf-8", errors="surrogateescape") as f:
    f.write(content)

print("Pedidos API routing swapped to Services successfully.")
