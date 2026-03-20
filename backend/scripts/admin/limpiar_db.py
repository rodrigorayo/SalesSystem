import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.models.product import Product
from app.models.inventario import Inventario, InventoryLog
from beanie import init_beanie

async def cleanup_catalog_and_inventory():
    print("Conectando a MongoDB para limpieza profunda...")
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    # Extraer el db_name desde la URL o por defecto 'sales_system'
    db_name = settings.MONGODB_URL.split('/')[-1].split('?')[0]
    if not db_name:
        db_name = "test"
    db = client[db_name]
    
    # Inicializar Beanie con los modelos a afectar
    await init_beanie(database=db, document_models=[Product, Inventario, InventoryLog])
    
    print("\n[!] ADVERTENCIA: Se borrarán TODOS los productos y el inventario.")
    print("Contando registros actuales...")
    
    productos_count = await Product.count()
    inv_count = await Inventario.count()
    logs_count = await InventoryLog.count()
    
    print(f"- Productos en Catálogo: {productos_count}")
    print(f"- Registros de Inventario (por Sucursales): {inv_count}")
    print(f"- Movimientos en el Kárdex (Logs): {logs_count}")
    
    confirm = input("\n¿Estás seguro de continuar? (Escribe SI para proceder o dejalo vacio para auto): ")
    if confirm.strip().upper() not in ['SI', 'Y', 'YES', '']:
        print("Operación cancelada.")
        return
        
    print("\nBorrando Kárdex de Movimientos (Logs)...")
    await InventoryLog.delete_all()
    
    print("Borrando Registros de Inventario Físico...")
    await Inventario.delete_all()
    
    print("Borrando Catálogo Central de Productos...")
    await Product.delete_all()
    
    print("\n✅ ¡Limpieza exitosa! El Catálogo e Inventario han sido vaciados.")
    print("Nota: Las Categorías y Sucursales se mantuvieron intactas para no romper dependencias clave.")
    print("Ahora puedes importar tu archivo excel desde cero y pruebas de manera limpia y sin basura.")

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    asyncio.run(cleanup_catalog_and_inventory())
