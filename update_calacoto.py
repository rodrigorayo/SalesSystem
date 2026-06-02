import os

replacements = {
    "frontend/src/components/BcgMatrix.tsx": [
        ("La Paz", "Calacoto")
    ],
    "frontend/src/components/HourlyMultiyearChart.tsx": [
        ("La Paz", "Calacoto")
    ],
    "frontend/src/components/SpecialDatesChart.tsx": [
        ("La Paz", "Calacoto")
    ],
    "frontend/src/components/SalesPercentileTracker.tsx": [
        ("La Paz", "Calacoto")
    ],
    "frontend/src/components/DataImporterWizard.tsx": [
        ("La Paz", "Calacoto")
    ],
    "backend/app/services/analytics_service.py": [
        ("if 'paz' in s_str: return 'La Paz'", "if 'calacoto' in s_str: return 'Calacoto'")
    ]
}

for filepath, reps in replacements.items():
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        for old, new in reps:
            content = content.replace(old, new)
            
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"File not found: {filepath}")
