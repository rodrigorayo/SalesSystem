import asyncio
import os
import sys
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import motor.motor_asyncio

async def fix_indexes():
    print("Corrección de índices conflictivos...")
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://user:password@localhost:27017")
    db = client.salessystem
    
    cols = ["price_change_requests", "sales", "audit_logs", "descuentos", "plans", "tenants", "users", "products", "inventario", "inventory_logs", "categories"]
    for col in cols:
        try:
            print(f"Dropping indexes for {col}...")
            await db[col].drop_indexes()
        except Exception as e:
            print(f"Error dropping indexes for {col}: {e}")

    print("Índices limpiados.")

if __name__ == "__main__":
    asyncio.run(fix_indexes())
