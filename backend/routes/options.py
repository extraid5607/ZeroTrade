"""
US Market Option Chain API Route for ZeroTrade.
Fetches real, official option chain data from CBOE for US stocks and indices (SPX, NDX, SPY, QQQ, AAPL, TSLA, NVDA, etc.)
with high-speed in-memory caching, live spot calibration, and Black-Scholes pricing & Greek fallbacks.
"""
import re
import math
import time
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
import httpx
from fastapi import APIRouter, Query, HTTPException

from backend.services.data_hub import data_hub

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

# In-memory cache for CBOE options (TTL: 15s for live reactivity)
_options_cache: Dict[str, Dict[str, Any]] = {}


def norm_cdf(x: float) -> float:
    """Standard normal cumulative distribution function."""
    return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0


def calculate_black_scholes(
    spot: float,
    strike: float,
    dte_days: float,
    iv: float = 0.20,
    r: float = 0.045,
    opt_type: str = "CALL"
) -> Dict[str, Any]:
    """Calculate theoretical Black-Scholes price and Greeks (Delta, Gamma, Theta, Vega)."""
    T = max(dte_days, 0.001) / 365.0
    sigma = max(iv, 0.05)

    try:
        d1 = (math.log(spot / strike) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)

        if opt_type.upper() in ["CALL", "CE", "C"]:
            price = spot * norm_cdf(d1) - strike * math.exp(-r * T) * norm_cdf(d2)
            delta = norm_cdf(d1)
        else:
            price = strike * math.exp(-r * T) * norm_cdf(-d2) - spot * norm_cdf(-d1)
            delta = norm_cdf(d1) - 1.0

        gamma = math.exp(-0.5 * d1 ** 2) / (spot * sigma * math.sqrt(2 * math.pi * T))
        theta = (
            -(spot * sigma * math.exp(-0.5 * d1 ** 2)) / (2 * math.sqrt(2 * math.pi * T))
            - r * strike * math.exp(-r * T) * (norm_cdf(d2) if opt_type.upper() in ["CALL", "CE", "C"] else norm_cdf(-d2))
        ) / 365.0
        vega = spot * math.sqrt(T) * math.exp(-0.5 * d1 ** 2) / (math.sqrt(2 * math.pi) * 100.0)

        return {
            "price": round(max(price, 0.01), 2),
            "delta": round(delta, 4),
            "gamma": round(gamma, 6),
            "theta": round(theta, 4),
            "vega": round(vega, 4),
            "iv": round(sigma * 100, 1)
        }
    except Exception:
        intrinsic = max(0.0, spot - strike) if opt_type.upper() in ["CALL", "CE", "C"] else max(0.0, strike - spot)
        return {
            "price": round(max(intrinsic, 0.05), 2),
            "delta": 0.50 if opt_type.upper() in ["CALL", "CE", "C"] else -0.50,
            "gamma": 0.01,
            "theta": -0.05,
            "vega": 0.10,
            "iv": round(iv * 100, 1)
        }


def get_live_underlying_price(sym: str) -> float:
    """Retrieve real-time underlying price from data_hub with appropriate fallbacks."""
    if sym in data_hub.tickers:
        return float(data_hub.tickers[sym].get("price", 0.0))
    if sym == "SPX":
        if "^GSPC" in data_hub.tickers:
            return float(data_hub.tickers["^GSPC"].get("price", 7743.0))
        if "SPY" in data_hub.tickers:
            return float(data_hub.tickers["SPY"].get("price", 774.3)) * 10.0
        return 7743.0
    if sym == "NDX":
        if "^IXIC" in data_hub.tickers:
            return float(data_hub.tickers["^IXIC"].get("price", 26500.0))
        if "QQQ" in data_hub.tickers:
            return float(data_hub.tickers["QQQ"].get("price", 720.0)) * 36.8
        return 26500.0
    return 100.0


def generate_synthetic_chain(sym: str, spot_price: float, strike_count: int = 24) -> Dict[str, Any]:
    """Generate high-precision synthetic option chain using Black-Scholes when upstream CDN is unavailable."""
    now = datetime.now(timezone.utc)
    
    # Generate next 4 Fridays
    expirations = []
    curr = now
    while len(expirations) < 4:
        curr += timedelta(days=1)
        if curr.weekday() == 4:  # Friday
            expirations.append(curr.strftime("%Y-%m-%d"))

    selected_exp = expirations[0]
    exp_dt = datetime.strptime(selected_exp, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    dte_days = max(1, (exp_dt - now).days)

    step = 5.0 if spot_price > 500 else (2.5 if spot_price > 100 else 1.0)
    if spot_price > 2000:
        step = 25.0

    atm_strike = round(spot_price / step) * step
    half = strike_count // 2
    strikes = [round(atm_strike + (i - half) * step, 2) for i in range(strike_count)]

    chain_rows = []
    for s in strikes:
        call_bs = calculate_black_scholes(spot_price, s, dte_days, iv=0.20, opt_type="CALL")
        put_bs = calculate_black_scholes(spot_price, s, dte_days, iv=0.20, opt_type="PUT")

        call_spread = max(0.05, round(call_bs["price"] * 0.02, 2))
        put_spread = max(0.05, round(put_bs["price"] * 0.02, 2))

        chain_rows.append({
            "strike": s,
            "isATM": s == atm_strike,
            "call": {
                "symbol": f"{sym} {s:g} CE",
                "bid": round(max(0.01, call_bs["price"] - call_spread), 2),
                "ask": round(call_bs["price"] + call_spread, 2),
                "ltp": call_bs["price"],
                "iv": call_bs["iv"],
                "delta": call_bs["delta"],
                "gamma": call_bs["gamma"],
                "theta": call_bs["theta"],
                "vega": call_bs["vega"],
                "volume": int(100 + abs(s - atm_strike) * 10),
                "oi": int(1000 + abs(s - atm_strike) * 50),
                "itm": spot_price >= s
            },
            "put": {
                "symbol": f"{sym} {s:g} PE",
                "bid": round(max(0.01, put_bs["price"] - put_spread), 2),
                "ask": round(put_bs["price"] + put_spread, 2),
                "ltp": put_bs["price"],
                "iv": put_bs["iv"],
                "delta": put_bs["delta"],
                "gamma": put_bs["gamma"],
                "theta": put_bs["theta"],
                "vega": put_bs["vega"],
                "volume": int(100 + abs(s - atm_strike) * 10),
                "oi": int(1000 + abs(s - atm_strike) * 50),
                "itm": spot_price <= s
            }
        })

    return {
        "underlyingSymbol": sym,
        "underlyingPrice": spot_price,
        "atmStrike": atm_strike,
        "selectedExpiration": selected_exp,
        "expirations": expirations,
        "totalStrikes": len(strikes),
        "chain": chain_rows
    }


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
    Fetches real-world US option chain with live spot tracking, expirations, strikes, greeks, and orderbook quotes.
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
    cboe_data = None

    # Fetch from CBOE (TTL: 15s for live reactivity)
    if not cached or (now - cached.get("timestamp", 0)) > 15:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://www.cboe.com/"
        }
        urls = [
            f"https://cdn-api.cboe.com/api/global/delayed_quotes/options/{cboe_sym}.json",
            f"https://cdn.cboe.com/api/global/delayed_quotes/options/{cboe_sym}.json"
        ]

        for url in urls:
            try:
                async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200:
                        cboe_data = resp.json().get("data", {})
                        if cboe_data and cboe_data.get("options"):
                            _options_cache[cboe_sym] = {
                                "timestamp": now,
                                "data": cboe_data
                            }
                            break
            except Exception as e:
                logger.debug(f"CBOE fetch attempt for {sym} on {url} failed: {e}")

        if not cboe_data and cached:
            cboe_data = cached["data"]
    else:
        cboe_data = cached["data"]

    # If CBOE data is unavailable, return Black-Scholes synthetic chain
    live_spot = get_live_underlying_price(sym)
    if not cboe_data or not cboe_data.get("options"):
        logger.info(f"Using synthetic Black-Scholes option chain for {sym} at spot {live_spot}")
        return generate_synthetic_chain(sym, live_spot, strike_count)

    underlying_price = float(cboe_data.get("current_price", 0.0)) or live_spot
    raw_options = cboe_data.get("options", [])

    # Parse all options and group by expiration
    # Standard OCC symbol pattern: SYMBOL + YYMMDD + [C|P] + 8-digit strike
    pattern = re.compile(r'([A-Z0-9]+?)(\d{2})(\d{2})(\d{2})([CP])(\d{8})')
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

        bid = float(opt.get("bid", 0.0))
        ask = float(opt.get("ask", 0.0))
        last_trade = float(opt.get("last_trade_price", 0.0))
        ltp = last_trade if last_trade > 0 else ((bid + ask) / 2.0 if (bid + ask) > 0 else float(opt.get("theo", 1.0)))

        opt_info = {
            "symbol": opt_sym,
            "bid": round(bid, 2),
            "ask": round(ask, 2),
            "ltp": round(ltp, 2),
            "iv": round(float(opt.get("iv", 0.20)) * 100, 1),
            "delta": round(float(opt.get("delta", 0.5 if cp == 'C' else -0.5)), 4),
            "gamma": round(float(opt.get("gamma", 0.0)), 6),
            "theta": round(float(opt.get("theta", 0.0)), 4),
            "vega": round(float(opt.get("vega", 0.0)), 4),
            "volume": int(opt.get("volume", 0)),
            "oi": int(opt.get("open_interest", 0)),
            "itm": (underlying_price >= strike) if cp == "C" else (underlying_price <= strike)
        }

        if cp == "C":
            options_by_exp[exp_date][strike]["call"] = opt_info
        else:
            options_by_exp[exp_date][strike]["put"] = opt_info

    today_us = datetime.now(timezone.utc).date().isoformat()
    active_expirations = [e for e in expirations_set if e >= today_us]
    sorted_expirations = sorted(active_expirations) if active_expirations else sorted(list(expirations_set))
    if not sorted_expirations:
        return generate_synthetic_chain(sym, underlying_price, strike_count)

    selected_exp = expiration if (expiration and expiration in options_by_exp) else sorted_expirations[0]
    strikes_dict = options_by_exp.get(selected_exp, {})
    sorted_strikes = sorted(list(strikes_dict.keys()))

    if not sorted_strikes:
        return generate_synthetic_chain(sym, underlying_price, strike_count)

    # Find ATM strike
    atm_strike = min(sorted_strikes, key=lambda s: abs(s - underlying_price))
    atm_index = sorted_strikes.index(atm_strike)

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
