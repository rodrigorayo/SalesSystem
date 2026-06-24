import asyncio
import httpx
import json

async def run():
    async with httpx.AsyncClient() as client:
        # Login
        data = {"username": "admin", "password": "admin_password"}
        r = await client.post("http://localhost:8000/api/v1/token", data=data)
        if r.status_code != 200:
            print("Login failed:", r.text)
            return
        token = r.json()["access_token"]
        
        # Get dashboard
        headers = {"Authorization": f"Bearer {token}"}
        r = await client.get("http://localhost:8000/api/v1/analytics/dashboard?time_range=today", headers=headers)
        if r.status_code == 200:
            res = r.json()
            print(f"Ventas Brutas: {res['overview']['ventas_brutas']}")
            print("Distribución Horaria:")
            for h in res['distribucion_horaria']:
                if h['real'] > 0:
                    print(h)
        else:
            print("Dashboard failed:", r.text)

if __name__ == '__main__':
    asyncio.run(run())
