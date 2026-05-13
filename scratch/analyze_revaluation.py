from pymongo import MongoClient

def run_analysis():
    uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/?appName=Cluster0"
    client = MongoClient(uri)
    db = client.salessystem

    sucursal = db.sucursales.find_one({"nombre": "FEXCO"})
    sucursal_id = str(sucursal["_id"])

    pipeline = [
        {"$match": {"sucursal_id": sucursal_id}},
        {"$sort": {"created_at": 1}},
        {
            "$group": {
                "_id": "$producto_id",
                "nombre": {"$first": "$descripcion"},
                "total_incomes": {
                    "$sum": {
                        "$cond": [{"$gt": ["$cantidad_movida", 0]}, {"$multiply": ["$cantidad_movida", {"$toDouble": "$costo_unitario_momento"}]}, 0]
                    }
                },
                "total_outcomes": {
                    "$sum": {
                        "$cond": [{"$lt": ["$cantidad_movida", 0]}, {"$multiply": [{"$abs": "$cantidad_movida"}, {"$toDouble": "$costo_unitario_momento"}]}, 0]
                    }
                },
                "last_stock": {"$last": "$stock_resultante"},
                "last_cost": {"$last": {"$toDouble": "$costo_unitario_momento"}},
                "costos_historia": {"$addToSet": {"$toDouble": "$costo_unitario_momento"}}
            }
        },
        {"$match": {"last_stock": {"$gt": 0}}},
        {
            "$project": {
                "nombre": 1,
                "total_incomes": 1,
                "total_outcomes": 1,
                "last_stock": 1,
                "last_cost": 1,
                "costos_historia": 1,
                "inventario_final_calculado": {"$multiply": ["$last_stock", "$last_cost"]},
                "inventario_historico": {"$subtract": ["$total_incomes", "$total_outcomes"]}
            }
        },
        {
            "$project": {
                "nombre": 1,
                "last_stock": 1,
                "last_cost": 1,
                "costos_historia": 1,
                "inventario_final_calculado": 1,
                "inventario_historico": 1,
                "revalorizacion": {"$subtract": ["$inventario_final_calculado", "$inventario_historico"]}
            }
        },
        {"$sort": {"revalorizacion": -1}},
        {"$limit": 5}
    ]

    results = list(db.inventory_logs.aggregate(pipeline))
    print("\n=== TOP 5 PRODUCTOS CON MAYOR REVALORIZACION POSITIVA ===")
    for r in results:
        print(f"Producto: {r['nombre']}")
        print(f"  Costos registrados: {r['costos_historia']}")
        print(f"  Stock actual: {r['last_stock']}")
        print(f"  Revalorizacion: +Bs. {r['revalorizacion']:,.2f}")

    pipeline_neg = pipeline[:-2] + [{"$sort": {"revalorizacion": 1}}, {"$limit": 5}]
    results_neg = list(db.inventory_logs.aggregate(pipeline_neg))
    print("\n=== TOP 5 PRODUCTOS CON MAYOR DESVALORIZACION NEGATIVA ===")
    for r in results_neg:
        print(f"Producto: {r['nombre']}")
        print(f"  Costos registrados: {r['costos_historia']}")
        print(f"  Stock actual: {r['last_stock']}")
        print(f"  Revalorizacion: Bs. {r['revalorizacion']:,.2f}")

if __name__ == "__main__":
    run_analysis()
