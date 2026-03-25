import os
import re

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Replace list auths
    content = content.replace("[UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL, UserRole.SUPERADMIN]", 
                              "[UserRole.ADMIN_MATRIZ, UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.SUPERADMIN]")
    
    content = content.replace("[UserRole.ADMIN_SUCURSAL, UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]", 
                              "[UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]")
    
    content = content.replace("[UserRole.ADMIN_SUCURSAL, UserRole.CAJERO]", 
                              "[UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.CAJERO]")
    
    content = content.replace("[UserRole.ADMIN_SUCURSAL, UserRole.CAJERO, UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]", 
                              "[UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR, UserRole.CAJERO, UserRole.ADMIN_MATRIZ, UserRole.SUPERADMIN]")
    
    content = content.replace("current_user.role == UserRole.ADMIN_SUCURSAL:", 
                              "current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR]:")
    
    content = content.replace("current_user.role == UserRole.ADMIN_SUCURSAL and", 
                              "current_user.role in [UserRole.ADMIN_SUCURSAL, UserRole.SUPERVISOR, UserRole.VENDEDOR] and")

    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched {filepath}")

def main():
    endpoints_dir = r"c:\Users\rodri\Desktop\Taboada System\SalesSystem\backend\app\api\v1\endpoints"
    for file in os.listdir(endpoints_dir):
        if file.endswith(".py"):
            patch_file(os.path.join(endpoints_dir, file))

if __name__ == "__main__":
    main()
