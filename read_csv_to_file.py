import csv

with open("c:\\Users\\rodri\\Desktop\\SalesSystem\\Copy of segmentos de mercado - equipo de ventas La Paz.csv", "r", encoding="utf-8", errors="replace") as f:
    with open("c:\\Users\\rodri\\Desktop\\SalesSystem\\csv_dump.txt", "w", encoding="utf-8") as out:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            clean_row = [cell.strip().replace('\n', ' ') for cell in row if cell.strip()]
            if clean_row:
                out.write(f"Row {i:02d}: {clean_row}\n")
