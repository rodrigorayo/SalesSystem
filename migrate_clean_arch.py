import os
import shutil
import re

APP_DIR = r"c:\Users\rodri\Desktop\Taboada System\SalesSystem\backend\app"

# 1. Create target directories
os.makedirs(os.path.join(APP_DIR, "domain"), exist_ok=True)
os.makedirs(os.path.join(APP_DIR, "application"), exist_ok=True)
os.makedirs(os.path.join(APP_DIR, "infrastructure"), exist_ok=True)

# 2. Move existing directories
moves = [
    ("models", "domain/models"),
    ("schemas", "domain/schemas"),
    ("services", "application/services"),
    ("core", "infrastructure/core"),
]

for src, dst in moves:
    src_path = os.path.join(APP_DIR, src)
    dst_path = os.path.join(APP_DIR, dst)
    if os.path.exists(src_path):
        print(f"Moving {src_path} -> {dst_path}")
        shutil.move(src_path, dst_path)

# Move specific files
file_moves = [
    ("db.py", "infrastructure/db.py"),
    ("auth.py", "infrastructure/auth.py"),
]
for src, dst in file_moves:
    src_path = os.path.join(APP_DIR, src)
    dst_path = os.path.join(APP_DIR, dst)
    if os.path.exists(src_path):
        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
        print(f"Moving {src_path} -> {dst_path}")
        shutil.move(src_path, dst_path)

# 3. Update all imports in all files inside backend/app
replacements = [
    (r"from app\.models\b", r"from app.domain.models"),
    (r"import app\.models\b", r"import app.domain.models"),
    (r"from app\.schemas\b", r"from app.domain.schemas"),
    (r"import app\.schemas\b", r"import app.domain.schemas"),
    (r"from app\.services\b", r"from app.application.services"),
    (r"import app\.services\b", r"import app.application.services"),
    (r"from app\.core\b", r"from app.infrastructure.core"),
    (r"import app\.core\b", r"import app.infrastructure.core"),
    (r"from app\.db\b", r"from app.infrastructure.db"),
    (r"import app\.db\b", r"import app.infrastructure.db"),
    (r"from app\.auth\b", r"from app.infrastructure.auth"),
    (r"import app\.auth\b", r"import app.infrastructure.auth"),
]

print("Scanning and replacing imports...")
for root, dirs, files in os.walk(APP_DIR):
    for str_file in files:
        if str_file.endswith(".py"):
            file_path = os.path.join(root, str_file)
            with open(file_path, "r", encoding="utf-8", errors="surrogateescape") as f:
                content = f.read()
            original_content = content
            for pattern, repl in replacements:
                content = re.sub(pattern, repl, content)
            
            if content != original_content:
                print(f"Updated imports in {file_path}")
                with open(file_path, "w", encoding="utf-8", errors="surrogateescape") as f:
                    f.write(content)

print("Migration completed successfully!")
