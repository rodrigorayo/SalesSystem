import os
from pymongo import MongoClient, UpdateOne

def main():
    mongo_url = os.getenv("MONGODB_URL", "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/?appName=Cluster0")
    client = MongoClient(mongo_url)
    db = client.salessystem

    print("Connected to database:", db.name)

    # 1. Find all logs that have missing or empty description
    query = {"$or": [{"descripcion": {"$exists": False}}, {"descripcion": ""}, {"descripcion": None}]}
    logs = list(db.inventory_logs.find(query))
    print(f"Found {len(logs)} inventory logs with missing/empty description.")

    if not logs:
        print("No logs need backfilling. Everything is already up to date!")
        return

    # 2. Extract all unique product IDs
    product_ids = list(set(log["producto_id"] for log in logs if log.get("producto_id")))
    print(f"Unique product IDs to look up: {len(product_ids)}")

    # 3. Retrieve product details
    # Product IDs in the database can be strings or ObjectIds, let's match both
    # We will try both str and ObjectId lookup
    from bson import ObjectId
    
    products_map = {}
    
    # Try looking up using string ID first
    prods = list(db.products.find({"_id": {"$in": product_ids}}))
    for p in prods:
        products_map[str(p["_id"])] = p.get("descripcion") or "Producto Sin Nombre"

    # Also try converting to ObjectId for any missing ones
    obj_ids = []
    for pid in product_ids:
        if pid not in products_map:
            try:
                obj_ids.append(ObjectId(pid))
            except:
                pass

    if obj_ids:
        prods_obj = list(db.products.find({"_id": {"$in": obj_ids}}))
        for p in prods_obj:
            products_map[str(p["_id"])] = p.get("descripcion") or "Producto Sin Nombre"

    print(f"Fetched descriptions for {len(products_map)} products.")

    # 4. Generate bulk update operations
    operaciones = []
    skipped_count = 0
    updated_counts = {}

    for log in logs:
        log_id = log["_id"]
        prod_id = log.get("producto_id")
        
        desc = products_map.get(prod_id)
        if not desc:
            # Let's see if we can find it by looking up again or if it's really missing
            # If product is deleted, we might use a fallback or try looking up deleted products
            # (Products collection has soft delete so it's probably still there)
            skipped_count += 1
            continue

        operaciones.append(
            UpdateOne({"_id": log_id}, {"$set": {"descripcion": desc}})
        )
        updated_counts[desc] = updated_counts.get(desc, 0) + 1

    if operaciones:
        print(f"Prepared {len(operaciones)} updates. Executing bulk write...")
        result = db.inventory_logs.bulk_write(operaciones)
        print(f"Bulk write finished. Matched: {result.matched_count}, Modified: {result.modified_count}")
    else:
        print("No updates prepared.")

    print(f"Skipped {skipped_count} logs because their products were not found in the database.")
    print("\nBreakdown of updates by product name:")
    for desc, count in sorted(updated_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"- {desc}: {count} logs")

if __name__ == "__main__":
    main()
