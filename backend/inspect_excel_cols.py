import pandas as pd
filename = r"c:\Users\rodri\Desktop\SalesSystem\plantilla_productos (7).xlsx"
df = pd.read_excel(filename)
print(", ".join(df.columns.tolist()))
