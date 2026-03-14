import pandas as pd

try:
    df = pd.read_csv("c:\\Users\\rodri\\Desktop\\SalesSystem\\Copy of segmentos de mercado - equipo de ventas La Paz.csv", encoding="latin-1")
    # drop completely empty rows and columns
    df.dropna(how="all", axis=0, inplace=True)
    df.dropna(how="all", axis=1, inplace=True)

    with pd.option_context('display.max_rows', None, 'display.max_columns', None):
        print(df)
except Exception as e:
    print(f"Error reading CSV: {e}")
