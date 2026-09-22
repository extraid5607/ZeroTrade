"""
Markets and Candlestick Data API routes for ZeroTrade.
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from backend.services.data_hub import data_hub

router = APIRouter(prefix="/api/markets", tags=["markets"])


@router.get("/tickers")
def get_tickers(category: Optional[str] = None):
    """Retrieve all latest market tickers, optionally filtered by asset class."""
    tickers = list(data_hub.tickers.values())
    if category:
        category = category.lower()
        tickers = [t for t in tickers if t.get("category", "").lower() == category]
    return {"tickers": tickers}


@router.get("/ticker/{symbol}")
def get_single_ticker(symbol: str):
    """Retrieve current snapshot for a single symbol."""
    ticker = data_hub.tickers.get(symbol)
    if not ticker:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found.")
    return {"ticker": ticker}


@router.get("/history")
async def get_history(
    symbol: str = Query(..., description="Symbol e.g. AAPL, BTCUSDT, EUR/USD"),
    interval: str = Query("15m", description="Timeframe: 1m, 5m, 15m, 1h, 1D"),
    limit: int = Query(150, ge=10, le=500)
):
    """Fetch historical OHLCV candlestick data for charting."""
    if symbol not in data_hub.tickers:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not tracked.")

    candles = await data_hub.get_candles(symbol, interval, limit)
    return {
        "symbol": symbol,
        "interval": interval,
        "candles": candles
    }


@router.get("/search")
def search_instruments(q: str = Query("", min_length=0)):
    """Search tracked symbols across Stocks, Crypto, and Forex."""
    query = q.strip().upper()
    results = []
    for sym, meta in data_hub.symbol_metadata.items():
        name = meta.get("name", "").upper()
        disp = meta.get("display", sym).upper()
        if not query or query in sym or query in name or query in disp:
            ticker = data_hub.tickers.get(sym, {})
            results.append({
                "symbol": sym,
                "display": meta.get("display", sym),
                "name": meta.get("name", sym),
                "category": meta.get("category", "stock"),
                "currency": meta.get("currency", "USD"),
                "price": ticker.get("price", meta.get("basePrice", 0.0)),
                "changePercent24h": ticker.get("changePercent24h", 0.0)
            })
    return {"results": results}
