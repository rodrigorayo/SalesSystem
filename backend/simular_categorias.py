import pandas as pd
import io

filename = r"c:\Users\rodri\Desktop\SalesSystem\plantilla_productos (7).xlsx"
df = pd.read_excel(filename)

df.columns = df.columns.astype(str).str.strip().str.upper()
df.columns = df.columns.str.replace(' ', '_')

# How does the code process categories initially?
nombres_categorias_excel = df['CATEGORIA'].dropna().unique()

print("1. Raw unique categories from excel:")
print(nombres_categorias_excel)

print("2. Simulated cat_name keys for DB lookup/insertion:")
for cat_name in nombres_categorias_excel:
    cat_key = str(cat_name).strip().upper()
    print(f"   '{cat_key}'")

print("3. Checking values being looped over:")
for index, row in df.head(10).iterrows():
    cat_str = str(row.get("CATEGORIA", "")).strip().upper()
    print(f"Row {index+2} CATEGORIA parsed as: '{cat_str}'")
