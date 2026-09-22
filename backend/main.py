"""
ZeroTrade - Paper Trading Platform Backend Service.
Single service that holds API keys, maintains upstream connections,
provides WebSocket price streaming, and executes simulated orders.
"""
import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.database import init_db
from backend.services.data_hub import data_hub
from backend.routes import auth, markets, trading, leaderboard, options, billing

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("zerotrade.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database...")
    init_db()
    logger.info("Starting MarketDataHub background price feeds...")
    data_hub.start()
    yield
    # Shutdown
    logger.info("Shutting down MarketDataHub...")
    await data_hub.stop()


app = FastAPI(
    title="ZeroTrade Paper Trading API",
    description="Simulated multi-asset trading platform (Stocks, Crypto, Forex, US Options) by ZeroBoss.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
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
            # Keep socket open and receive heartbeat/ping from client
            msg = await websocket.receive_text()
            # If client sends ping, respond pong
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        data_hub.unregister_client(websocket)
    except Exception as e:
        logger.debug(f"Client disconnected: {e}")
        data_hub.unregister_client(websocket)


# Mount built frontend static files if available
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")
