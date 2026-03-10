import pandas as pd
import sys

filename = r"c:\Users\rodri\Desktop\SalesSystem\plantilla_productos (7).xlsx"
try:
    df = pd.read_excel(filename)
    print("Columns:", df.columns.tolist())
    print("Number of rows:", len(df))
    print("First 5 rows:")
    print(df.head())
except Exception as e:
    print("Error reading excel:", e)
