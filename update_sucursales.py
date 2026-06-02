import os

replacements = {
    "frontend/src/components/BcgMatrix.tsx": [
        (
            "{ value: 'Centro', label: 'Centro' },\n    { value: 'Norte', label: 'Norte' },\n    { value: 'Sur', label: 'Sur' },\n    { value: 'Quillacollo', label: 'Quillacollo' }",
            "{ value: 'Recoleta', label: 'Recoleta' },\n    { value: 'La Paz', label: 'La Paz' }"
        )
    ],
    "frontend/src/components/HourlyMultiyearChart.tsx": [
        (
            "{ value: 'Centro', label: 'Centro' },\n        { value: 'Norte', label: 'Norte' },\n        { value: 'Sur', label: 'Sur' },\n        { value: 'Quillacollo', label: 'Quillacollo' }",
            "{ value: 'Recoleta', label: 'Recoleta' },\n        { value: 'La Paz', label: 'La Paz' }"
        ),
        (
            "{ value: 'Heroinas', label: 'Heroinas' }",
            "{ value: 'Heroinas', label: 'Heroínas' }"
        )
    ],
    "frontend/src/components/SpecialDatesChart.tsx": [
        (
            "{ value: 'Centro', label: 'Centro' },\n        { value: 'Norte', label: 'Norte' },\n        { value: 'Sur', label: 'Sur' },\n        { value: 'Quillacollo', label: 'Quillacollo' }",
            "{ value: 'Recoleta', label: 'Recoleta' },\n        { value: 'La Paz', label: 'La Paz' }"
        ),
        (
            "{ value: 'Heroinas', label: 'Heroinas' }",
            "{ value: 'Heroinas', label: 'Heroínas' }"
        )
    ],
    "frontend/src/components/SalesPercentileTracker.tsx": [
        (
            "{value:\"Centro\",label:\"Centro\"},{value:\"Norte\",label:\"Norte\"},\n  {value:\"Sur\",label:\"Sur\"},{value:\"Quillacollo\",label:\"Quillacollo\"}",
            "{value:\"Recoleta\",label:\"Recoleta\"},\n  {value:\"La Paz\",label:\"La Paz\"}"
        ),
        (
            "{value:\"Heroinas\",label:\"Heroinas\"}",
            "{value:\"Heroinas\",label:\"Heroínas\"}"
        )
    ],
    "frontend/src/components/DataImporterWizard.tsx": [
        (
            "<option value=\"Quillacollo\">Quillacollo</option>\n                        <option value=\"Sacaba\">Sacaba</option>",
            "<option value=\"Recoleta\">Recoleta</option>\n                        <option value=\"La Paz\">La Paz</option>"
        ),
        (
            "<option value=\"Heroínas\">Heroínas</option>",
            "<option value=\"Heroinas\">Heroínas</option>"
        )
    ],
    "backend/app/services/analytics_service.py": [
        (
            "if 'recoleta' in s_str: return 'Recoleta'\n                return str(s).capitalize()",
            "if 'recoleta' in s_str: return 'Recoleta'\n                if 'paz' in s_str: return 'La Paz'\n                return str(s).capitalize()"
        ),
        (
            "if 'recoleta' in s_str: return 'Recoleta'\n        return str(s).capitalize()",
            "if 'recoleta' in s_str: return 'Recoleta'\n        if 'paz' in s_str: return 'La Paz'\n        return str(s).capitalize()"
        )
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
