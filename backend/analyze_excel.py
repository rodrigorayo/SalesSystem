import pandas as pd
import sys
import json

def parse_excel(filepath):
    try:
        df = pd.read_excel(filepath)
        out = {
            "columns": list(df.columns),
            "rows": df.head(3).fillna("").to_dict('records')
        }
        with open("excel_info.json", "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
        print("Success")
    except Exception as e:
        print(f"Error al leer el archivo: {e}")

if __name__ == "__main__":
    parse_excel(sys.argv[1])
