import requests

def test_api():
    try:
        url = "http://localhost:8000/api/v1/analytics/dashboard"
        params = {
            "start_date": "2024-01-01T00:00:00.000Z",
            "end_date": "2026-12-31T23:59:59.000Z",
            "time_range": "today",
            "sucursal_id": ""
        }
        headers = {
            "Authorization": "Bearer fake_token"
        }
        res = requests.get(url, params=params, headers=headers)
        print("Status Code:", res.status_code)
        print("Response Text:", res.text[:500])
    except Exception as e:
        print("Exception:", e)

if __name__ == "__main__":
    test_api()
