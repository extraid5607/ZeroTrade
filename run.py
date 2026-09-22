"""
ZeroTrade Local Development & Production Launcher.
"""
import os
import sys
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def main():
    os.chdir(BASE_DIR)
    print("=" * 65)
    print("  ZeroVega — Volatility & Multi-Asset Trading Terminal (ZeroBoss Family)")
    print("  Simulated Trading Only — No Real Money Involved.")
    print("=" * 65)

    dist_dir = BASE_DIR / "frontend" / "dist"
    if not dist_dir.exists():
        print("\n[!] Frontend build not found. Building React app...")
        subprocess.run(["npm", "--prefix", "frontend", "run", "build"], check=True, shell=True)

    port = int(os.getenv("PORT", 8000))
    print(f"\n[*] Starting ZeroVega Single-Service Server on port {port} ...")
    print(f"    - REST API:        http://0.0.0.0:{port}/api")
    print(f"    - WebSocket Feed:  ws://0.0.0.0:{port}/ws/stream")
    print(f"    - Health Check:    http://0.0.0.0:{port}/api/health")
    print("=" * 65)

    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)

if __name__ == "__main__":
    main()
