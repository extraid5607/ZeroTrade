"""
ZeroTrade - Paper Trading Platform Backend Service.
Single service that holds API keys, maintains upstream connections,
provides WebSocket price streaming, and executes simulated orders.
Optimized with GZip compression, immutable asset caching, and ultra-fast response times.
"""
import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

import asyncio
from backend.database import init_db, get_db
from backend.services.data_hub import data_hub
from backend.routes import auth, markets, trading, leaderboard, options, billing

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("zerotrade.main")


async def _db_keep_alive_loop():
    """Keep remote PostgreSQL connection pool warm to prevent Neon cold starts and sleep."""
    while True:
        await asyncio.sleep(180)  # Ping every 3 minutes
        try:
            with get_db() as conn:
                c = conn.cursor()
                c.execute("SELECT 1")
                c.fetchone()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database...")
    try:
        init_db()
        from backend.services.firebase_sync import restore_from_firebase
        restore_from_firebase()
    except Exception as e:
        logger.error(f"Database init / Firebase restore exception: {e}")

    logger.info("Starting MarketDataHub background price feeds...")
    try:
        data_hub.start()
    except Exception as e:
        logger.error(f"MarketDataHub start error: {e}")

    keep_alive_task = asyncio.create_task(_db_keep_alive_loop())

    yield
    # Shutdown
    keep_alive_task.cancel()
    logger.info("Shutting down MarketDataHub...")
    await data_hub.stop()


app = FastAPI(
    title="ZeroTrade Paper Trading API",
    description="Simulated multi-asset trading platform (Stocks, Crypto, Forex, US Options) by ZeroBoss.",
    version="1.0.0",
    lifespan=lifespan
)

# 1. High-Performance GZip Compression (Reduces network payload by ~75%)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 2. CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router)
app.include_router(markets.router)
app.include_router(trading.router)
app.include_router(leaderboard.router)
app.include_router(options.router)
app.include_router(billing.router)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ZeroTrade",
        "activeSubscribers": len(data_hub.connected_clients),
        "trackedSymbols": len(data_hub.tickers),
        "disclaimer": "Simulated trading only — no real money involved."
    }


@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    """Client WebSocket endpoint for real-time live price ticker fan-out."""
    await data_hub.register_client(websocket)
    try:
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        data_hub.unregister_client(websocket)
    except Exception as e:
        logger.debug(f"Client disconnected: {e}")
        data_hub.unregister_client(websocket)


# Mount built frontend static files with browser cache headers
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            resp = FileResponse(file_path)
            # Cache static assets forever (Vite generates unique hashes)
            if "/assets/" in str(file_path) or file_path.suffix in [".js", ".css", ".png", ".svg", ".woff2"]:
                resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return resp

        # HTML entry point: do not cache HTML so updates load instantly
        resp = FileResponse(FRONTEND_DIST / "index.html")
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return resp
