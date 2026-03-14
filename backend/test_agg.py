import asyncio
from app.db import init_db
from app.models.sale_item import SaleItem

async def main():
    await init_db()
    pipeline = [{"$match": {"tenant_id": "test"}}]
    
    # Bypass Beanie's broken aggregate and Motor version mismatch
    col = SaleItem.get_pymongo_collection()
    cursor = col.aggregate(pipeline)
    res = await cursor.to_list(length=1)
    
    print("Direct Motor aggregate works!", res)

if __name__ == "__main__":
    asyncio.run(main())
