import os
import re

file_path = "backend/app/api/v1/endpoints/inventario.py"

with open(file_path, "r", encoding="utf-8", errors="surrogateescape") as f:
    content = f.read()

# 1. Ajustar Inventario
new_ajustar = '''@router.post("/inventario/ajuste")
async def ajustar_inventario(
    ajuste: AjusteInventario,
    sucursal_id: str = "CENTRAL",
    current_user: User = Depends(get_current_active_user)
):
    from app.services.inventario_service import InventarioService
    return await InventarioService.ajustar_inventario(ajuste, sucursal_id, current_user)
'''
content = re.sub(r'@router\.post\("/inventario/ajuste"\)\nasync def ajustar_inventario\([\s\S]*?    return \{"sucursal_id": sucursal_id, "producto_id": ajuste\.producto_id\S*\s*\}', new_ajustar, content, count=1)

# 2. Importar Inventario
new_importar = '''@router.post("/inventario/importar")
async def import_inventory(
    sucursal_id: str = "CENTRAL",
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    from app.services.inventario_service import InventarioService
    contents = await file.read()
    return await InventarioService.importar_inventario(sucursal_id, contents, file.filename, current_user)
'''
# Careful with the regex. The function ends with: return { ... "errores": errores }
content = re.sub(r'@router\.post\("/inventario/importar"\)\nasync def import_inventory\([\s\S]*?    \}\n', new_importar, content, count=1)

# 3. Sincronizar Inventario Sucursal
new_sincronizar = '''@router.post("/inventario/sincronizar-sucursal")
async def sincronizar_inventario_sucursal(
    sucursal_id: str = None,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    from app.services.inventario_service import InventarioService
    contents = await file.read()
    return await InventarioService.sincronizar_sucursal(sucursal_id, contents, file.filename, current_user)
'''
content = re.sub(r'@router\.post\("/inventario/sincronizar-sucursal"\)\nasync def sincronizar_inventario_sucursal\([\s\S]*?    \}\n', new_sincronizar, content, count=1)

with open(file_path, "w", encoding="utf-8", errors="surrogateescape") as f:
    f.write(content)

print("Inventario API routing swapped to Services successfully.")
