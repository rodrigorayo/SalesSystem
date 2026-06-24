"""
Diagnostic script v2: Check what data exists for TODAY and yesterday
"""
import pymongo
from datetime import datetime, timezone, timedelta
from bson.decimal128 import Decimal128

uri = "mongodb+srv://rodrigorayomartinez_db_user:RqunkSiTBxQU2oew@cluster0.teutv4o.mongodb.net/salessystem?appName=Cluster0"
client = pymongo.MongoClient(uri)
db = client["salessystem"]

def to_float(val):
    if isinstance(val, Decimal128):
        return float(val.to_decimal())
    return float(val) if val else 0.0

# Bolivia time
now_bol = datetime.now(timezone(timedelta(hours=-4)))
today_start = now_bol.replace(hour=0, minute=0, second=0, microsecond=0)
today_end = now_bol.replace(hour=23, minute=59, second=59, microsecond=999999)

yesterday = now_bol - timedelta(days=1)
yest_start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
yest_end = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)

print(f"=== DIAGNOSTICO DE DATOS ({now_bol.strftime('%Y-%m-%d %H:%M BOL')}) ===\n")

# ---- ventas_historicas_crudas: fecha_max ----
max_doc = db.ventas_historicas_crudas.find_one(sort=[("fecha_transaccion", -1)])
fecha_max = max_doc["fecha_transaccion"] if max_doc else None
print(f"fecha_max en ventas_historicas_crudas: {fecha_max}")

# Check if fecha_max is today or yesterday
if fecha_max:
    if hasattr(fecha_max, 'date'):
        fmax_date = fecha_max.date()
    else:
        fmax_date = fecha_max
    
    # Records on fecha_max date
    d_start = datetime(fmax_date.year, fmax_date.month, fmax_date.day, 0, 0, 0)
    d_end = datetime(fmax_date.year, fmax_date.month, fmax_date.day, 23, 59, 59)
    
    pipeline = [
        {"$match": {"fecha_transaccion": {"$gte": d_start, "$lte": d_end}}},
        {"$group": {
            "_id": "$sucursal",
            "total_ventas": {"$sum": {"$toDouble": "$monto_total_bs"}},
            "count": {"$sum": 1}
        }}
    ]
    print(f"\nRegistros en fecha_max ({fmax_date}) en ventas_historicas_crudas:")
    for r in db.ventas_historicas_crudas.aggregate(pipeline):
        print(f"  {r['_id']}: Bs. {r['total_ventas']:.2f} ({r['count']} registros)")

# ---- sales collection: TODAY ----
print(f"\n{'='*60}")
print(f"Ventas HOY ({today_start.date()}) en coleccion 'sales':")
pipeline_sales = [
    {"$match": {"created_at": {"$gte": today_start, "$lte": today_end}}},
    {"$group": {
        "_id": "$sucursal_id",
        "total_ventas": {"$sum": {"$toDouble": "$total"}},
        "count": {"$sum": 1}
    }}
]
for r in db.sales.aggregate(pipeline_sales):
    # Resolve sucursal name
    suc = db.sucursales.find_one({"_id": r["_id"]}) if r["_id"] else None
    nombre = suc.get("nombre", str(r["_id"])) if suc else str(r["_id"])
    print(f"  {nombre}: Bs. {r['total_ventas']:.2f} ({r['count']} ventas)")

# ---- sales collection: YESTERDAY ----
print(f"\nVentas AYER ({yest_start.date()}) en coleccion 'sales':")
pipeline_sales_y = [
    {"$match": {"created_at": {"$gte": yest_start, "$lte": yest_end}}},
    {"$group": {
        "_id": "$sucursal_id",
        "total_ventas": {"$sum": {"$toDouble": "$total"}},
        "count": {"$sum": 1}
    }}
]
for r in db.sales.aggregate(pipeline_sales_y):
    suc = db.sucursales.find_one({"_id": r["_id"]}) if r["_id"] else None
    nombre = suc.get("nombre", str(r["_id"])) if suc else str(r["_id"])
    print(f"  {nombre}: Bs. {r['total_ventas']:.2f} ({r['count']} ventas)")

# ---- List all sucursales ----
print(f"\n{'='*60}")
print("Sucursales registradas:")
for s in db.sucursales.find():
    print(f"  ID: {s['_id']} | Nombre: {s.get('nombre')} | Codigo: {s.get('codigo')}")

# ---- Check what sucursal values exist in ventas_historicas_crudas ----
print(f"\n{'='*60}")
print("Valores unicos de 'sucursal' en ventas_historicas_crudas:")
distinct_suc = db.ventas_historicas_crudas.distinct("sucursal")
for s in distinct_suc:
    count = db.ventas_historicas_crudas.count_documents({"sucursal": s})
    print(f"  '{s}': {count} registros")

# ---- Show individual heroinas records from last day ----
print(f"\n{'='*60}")
print(f"Ultimas 15 transacciones de Heroinas en ventas_historicas_crudas:")
for r in db.ventas_historicas_crudas.find(
    {"sucursal": {"$regex": "hero", "$options": "i"}},
    {"_id": 0, "fecha_transaccion": 1, "monto_total_bs": 1, "nombre_producto": 1}
).sort("fecha_transaccion", -1).limit(15):
    monto = to_float(r.get("monto_total_bs", 0))
    print(f"  {r.get('fecha_transaccion')} | Bs. {monto:.2f} | {r.get('nombre_producto')}")

client.close()
print("\n=== FIN ===")
