import io
path = 'backend/app/api/v1/endpoints/sales.py'
with open(path, 'rb') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if b'from app.services.sales_service import SalesService' in line:
        new_lines.append(b'from app.services.sales_service import SalesService\n')
    else:
        new_lines.append(line)

with open(path, 'wb') as f:
    f.writelines(new_lines)
print('Fixed sales.py')
