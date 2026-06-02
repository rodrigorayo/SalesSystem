"""
Serialization utilities for converting MongoDB/BSON types to JSON-safe Python types.

Follows the DRY + Single Responsibility principles:
- One place to define all BSON → Python type conversions.
- Used by any endpoint returning raw aggregation pipeline results.
"""

from typing import Any


def normalize_bson(obj: Any) -> Any:
    """
    Recursively convert BSON-native types that FastAPI's jsonable_encoder
    cannot handle (e.g. Decimal128, ObjectId) into JSON-safe Python types.

    Called only at the serialization boundary (the API layer).
    Inner domain layers (services, models) never need this.
    """
    type_name = type(obj).__name__

    # Decimal128 → float (BSON monetary type from MongoDB aggregations)
    if type_name == "Decimal128":
        return float(obj.to_decimal())

    # ObjectId → str
    if type_name == "ObjectId":
        return str(obj)

    # Recurse into dicts
    if isinstance(obj, dict):
        return {k: normalize_bson(v) for k, v in obj.items()}

    # Recurse into lists
    if isinstance(obj, list):
        return [normalize_bson(item) for item in obj]

    return obj
