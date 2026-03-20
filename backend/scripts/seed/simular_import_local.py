import pandas as pd
import io
import math

filename = r"c:\Users\rodri\Desktop\SalesSystem\plantilla_productos (7).xlsx"
df = pd.read_excel(filename)

df.columns = df.columns.astype(str).str.strip().str.upper()
df.columns = df.columns.str.replace(' ', '_')

if "CATEGORIA" not in df.columns:
    print("Error: falta columna CATEGORIA")

errores = []
procesados = 0

for index, row in df.iterrows():
    procesados += 1
    fila_num = index + 2
    
    codigo_corto = str(row.get("CODIGO_CORTO", row.get("CODIGOCORTO", ""))).strip()
    if codigo_corto == "nan" or not codigo_corto:
         codigo_corto = str(row.get("CODIGO", "")).strip()
         
    if not codigo_corto or codigo_corto == "nan":
        errores.append({"fila": fila_num, "motivo": "Falta CODIGO o CODIGO CORTO"})
        continue

print("Procesados:", procesados)
print("Cat procesados:", procesados - len(errores))
print("Number of errors:", len(errores))
if len(errores) > 0:
    print("First 5 errors:", errores[:5])
