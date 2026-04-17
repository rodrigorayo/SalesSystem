import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_tenants():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/?appName=Cluster0"
    client = AsyncIOMotorClient(uri)
    db = client.salessystem
    
    tenants = await db.tenants.find({}).to_list(length=20)
    print(f"Total tenants: {len(tenants)}")
    for t in tenants:
        count_sales = await db.sales.count_documents({"tenant_id": str(t['_id'])})
        count_creditos = await db.cuentas_credito.count_documents({"tenant_id": str(t['_id'])})
        print(f"  ID: {t['_id']} | Nombre: {t.get('name')} | Ventas: {count_sales} | Creditos: {count_creditos}")

if __name__ == "__main__":
    asyncio.run(check_tenants())
