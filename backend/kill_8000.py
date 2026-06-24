import psutil
import os
import signal

for conn in psutil.net_connections():
    if conn.laddr.port == 8000 and conn.status == 'LISTEN':
        print(f"Found process {conn.pid} holding port 8000")
        try:
            os.kill(conn.pid, signal.SIGTERM)
            print("Process killed.")
        except Exception as e:
            print(f"Could not kill: {e}")
