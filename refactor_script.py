import sys

def main():
    path = "backend/app/api/v1/endpoints/sales.py"
    with open(path, "r", encoding="utf-8", errors="surrogateescape") as f:
        lines = f.readlines()

    new_lines = []
    
    in_create = False
    in_anular = False
    created_new_create = False
    created_new_anular = False
    
    for i, line in enumerate(lines):
        if line.startswith("@router.post(\"/ventas\", response_model=Sale)"):
            in_create = True
            if not created_new_create:
                new_lines.append("from app.services.sales_service import SalesService\n\n")
                new_lines.append("@router.post(\"/ventas\", response_model=Sale)\n")
                new_lines.append("@router.post(\"/sales\", response_model=Sale)\n")
                new_lines.append("async def create_sale_endpoint(\n")
                new_lines.append("    sale_in: SaleCreate,\n")
                new_lines.append("    current_user: User = Depends(get_current_active_user)\n")
                new_lines.append("):\n")
                new_lines.append("    return await SalesService.create_sale(sale_in, current_user)\n\n")
                created_new_create = True
            continue
            
        if in_create:
            if "GET /sales/stats/today" in line:
                in_create = False
                new_lines.append(line)
            continue
            
        if line.startswith("@router.patch(\"/sales/{sale_id}/anular\", response_model=Sale)"):
            in_anular = True
            if not created_new_anular:
                new_lines.append("@router.patch(\"/sales/{sale_id}/anular\", response_model=Sale)\n")
                new_lines.append("async def anular_sale(\n")
                new_lines.append("    sale_id: str,\n")
                new_lines.append("    current_user: User = Depends(get_current_active_user)\n")
                new_lines.append("):\n")
                new_lines.append("    return await SalesService.anular_sale(sale_id, current_user)\n\n")
                created_new_anular = True
            continue
            
        if in_anular:
            if "PATCH /sales/{sale_id}/factura" in line:
                in_anular = False
                new_lines.append(line)
            continue
            
        new_lines.append(line)

    with open(path, "w", encoding="utf-8", errors="surrogateescape") as f:
        f.writelines(new_lines)
    print("Done refactoring sales.py")

if __name__ == "__main__":
    main()
