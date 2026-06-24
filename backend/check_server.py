import requests

try:
    res = requests.get("http://localhost:8000/api/v1/analytics/dashboard")
    print("Status:", res.status_code)
    print("Headers:", res.headers)
    print("Text:", res.text[:200])
except Exception as e:
    print(e)
