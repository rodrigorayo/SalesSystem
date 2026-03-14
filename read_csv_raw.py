import csv
with open("c:\\Users\\rodri\\Desktop\\SalesSystem\\Copy of segmentos de mercado - equipo de ventas La Paz.csv", "r", encoding="utf-8", errors="replace") as f:
    reader = csv.reader(f)
    for i, row in enumerate(reader):
        clean_row = [cell.strip() for cell in row if cell.strip()]
        if clean_row:
            print(f"Row {i:02d}: {clean_row}")
