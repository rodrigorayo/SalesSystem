import asyncio
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.inventario import Inventario, InventoryLog
from app.models.product import Product
from pymongo import DeleteMany

async def main():
    client = AsyncIOMotorClient("mongodb+srv://rodrigorayomartinez:eXk3B57J0N2A4Hl4@cluster0.1eih7.mongodb.net/testdb?retryWrites=true&w=majority")
    db = client.testdb
    
    deleted_inv = 0
    deleted_logs = 0
    
    # 1. Clean up "None", "null", or empty producto_ids natively in motor
    inv_col = db.get_collection("Inventario")
    res_inv = await inv_col.delete_many({"$or": [
        {"producto_id": {"$in": ["None", "null", "", None]}},
    ]})
    deleted_inv += res_inv.deleted_count
    
    log_col = db.get_collection("InventoryLog")
    res_log = await log_col.delete_many({"$or": [
        {"producto_id": {"$in": ["None", "null", "", None]}},
    ]})
    deleted_logs += res_log.deleted_count
    
    print(f"Cleaned {deleted_inv} broken Inventario records")
    print(f"Cleaned {deleted_logs} broken InventoryLog records")
    
if __name__ == "__main__":
    asyncio.run(main())
