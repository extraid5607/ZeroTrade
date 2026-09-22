"""
US Market Option Chain API Route for ZeroTrade.
Fetches real, official option chain data from CBOE for US stocks and indices (SPY, QQQ, AAPL, TSLA, etc.).
"""
import re
import time
import logging
from typing import Optional, Dict, Any, List
import httpx
from fastapi import APIRouter, Query, HTTPException

logger = logging.getLogger("zerotrade.options")

router = APIRouter(prefix="/api/options", tags=["options"])

SUPPORTED_OPTION_SYMBOLS = [
    {"symbol": "SPX", "name": "S&P 500 Index Options", "category": "index"},
    {"symbol": "NDX", "name": "Nasdaq 100 Index Options", "category": "index"},
    {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "category": "index"},
    {"symbol": "QQQ", "name": "Invesco QQQ Trust (Nasdaq 100)", "category": "index"},
    {"symbol": "AAPL", "name": "Apple Inc.", "category": "stock"},
    {"symbol": "TSLA", "name": "Tesla Inc.", "category": "stock"},
    {"symbol": "NVDA", "name": "NVIDIA Corp.", "category": "stock"},
    {"symbol": "MSFT", "name": "Microsoft Corp.", "category": "stock"},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "category": "stock"},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "category": "stock"},
    {"symbol": "META", "name": "Meta Platforms Inc.", "category": "stock"},
    {"symbol": "AMD", "name": "Advanced Micro Devices", "category": "stock"},
]

# In-memory cache for CBOE options (TTL: 60s)
_options_cache: Dict[str, Dict[str, Any]] = {}


@router.get("/symbols")
def get_supported_option_symbols():
    """Returns list of US instruments supporting full option chains."""
    return {"symbols": SUPPORTED_OPTION_SYMBOLS}


@router.get("/chain")
async def get_option_chain(
    symbol: str = Query("SPX", description="US Symbol e.g. SPX, NDX, SPY, QQQ, AAPL, TSLA, NVDA"),
    expiration: Optional[str] = Query(None, description="Expiration date in YYYY-MM-DD format"),
    strike_count: int = Query(24, ge=10, le=80, description="Total strikes around ATM to display")
):
    """
    Fetches real-world US option chain with expirations, strikes, greeks, IV, and open interest.
    """
    sym = symbol.strip().upper()
    valid_symbols = [s["symbol"] for s in SUPPORTED_OPTION_SYMBOLS]
    if sym not in valid_symbols:
        raise HTTPException(
            status_code=400,
            detail=f"Option chains are only available for US Market symbols: {', '.join(valid_symbols)}"
        )

    # Map index symbols to CBOE internal identifiers
    cboe_sym = "_SPX" if sym == "SPX" else ("_NDX" if sym == "NDX" else sym)

    now = time.time()
    cached = _options_cache.get(cboe_sym)

    # Check cache freshness (60s TTL)
    if not cached or (now - cached.get("timestamp", 0)) > 60:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        url = f"https://cdn.cboe.com/api/global/delayed_quotes/options/{cboe_sym}.json"
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code != 200:
                    raise HTTPException(status_code=502, detail="Failed to retrieve CBOE options data.")
                data = resp.json().get("data", {})
                _options_cache[cboe_sym] = {
                    "timestamp": now,
                    "data": data
                }
                cached = _options_cache[cboe_sym]
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching options for {sym}: {e}")
            raise HTTPException(status_code=500, detail=f"Options data error: {str(e)}")

    cboe_data = cached["data"]
    underlying_price = float(cboe_data.get("current_price", 0.0))
    raw_options = cboe_data.get("options", [])

    if not raw_options:
        raise HTTPException(status_code=404, detail=f"No options found for {sym}.")

    # Parse all options and group by expiration
    # Standard OCC symbol pattern: SYMBOL + YYMMDD + [C|P] + 8-digit strike
    pattern = re.compile(r'([A-Z]+)(\d{2})(\d{2})(\d{2})([CP])(\d{8})')
    options_by_exp: Dict[str, Dict[float, Dict[str, Any]]] = {}
    expirations_set = set()

    for opt in raw_options:
        opt_sym = opt.get("option", "")
        m = pattern.search(opt_sym)
        if not m:
            continue

        yy, mm, dd, cp, strike_raw = m.group(2), m.group(3), m.group(4), m.group(5), m.group(6)
        exp_date = f"20{yy}-{mm}-{dd}"
        expirations_set.add(exp_date)

        strike = float(strike_raw) / 1000.0

        if exp_date not in options_by_exp:
            options_by_exp[exp_date] = {}
        if strike not in options_by_exp[exp_date]:
            options_by_exp[exp_date][strike] = {"strike": strike}

        opt_info = {
            "symbol": opt_sym,
            "bid": opt.get("bid", 0.0),
            "ask": opt.get("ask", 0.0),
            "ltp": opt.get("last_trade_price", (opt.get("bid", 0.0) + opt.get("ask", 0.0)) / 2),
            "iv": round(opt.get("iv", 0.0) * 100, 1),
            "delta": opt.get("delta", 0.0),
            "gamma": opt.get("gamma", 0.0),
            "theta": opt.get("theta", 0.0),
            "vega": opt.get("vega", 0.0),
            "volume": int(opt.get("volume", 0)),
            "oi": int(opt.get("open_interest", 0)),
            "itm": (underlying_price >= strike) if cp == "C" else (underlying_price <= strike)
        }

        if cp == "C":
            options_by_exp[exp_date][strike]["call"] = opt_info
        else:
            options_by_exp[exp_date][strike]["put"] = opt_info

    from datetime import datetime
    from zoneinfo import ZoneInfo

    today_us = datetime.now(ZoneInfo("America/New_York")).date().isoformat()
    active_expirations = [e for e in expirations_set if e >= today_us]
    sorted_expirations = sorted(active_expirations) if active_expirations else sorted(list(expirations_set))
    if not sorted_expirations:
        raise HTTPException(status_code=404, detail="No valid expirations found.")

    selected_exp = expiration if (expiration and expiration in options_by_exp) else sorted_expirations[0]
    strikes_dict = options_by_exp.get(selected_exp, {})
    sorted_strikes = sorted(list(strikes_dict.keys()))

    # Find ATM strike
    atm_strike = min(sorted_strikes, key=lambda s: abs(s - underlying_price)) if sorted_strikes else 0.0
    atm_index = sorted_strikes.index(atm_strike) if atm_strike in sorted_strikes else 0

    # Slice strikes around ATM
    half = strike_count // 2
    start_idx = max(0, atm_index - half)
    end_idx = min(len(sorted_strikes), atm_index + half + 1)
    visible_strikes = sorted_strikes[start_idx:end_idx]

    chain_rows = []
    for s in visible_strikes:
        row = strikes_dict[s]
        chain_rows.append({
            "strike": s,
            "isATM": s == atm_strike,
            "call": row.get("call", {}),
            "put": row.get("put", {})
        })

    return {
        "underlyingSymbol": sym,
        "underlyingPrice": underlying_price,
        "atmStrike": atm_strike,
        "selectedExpiration": selected_exp,
        "expirations": sorted_expirations,
        "totalStrikes": len(sorted_strikes),
        "chain": chain_rows
    }
