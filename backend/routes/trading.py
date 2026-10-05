"""
Trading and Portfolio routes for ZeroTrade.
Supports placing market/limit orders, cancelling limit orders, portfolio views,
resetting balance, and Zerodha-style 1-Year P&L statements with CSV export.
"""
import csv
import io
from fastapi import APIRouter, HTTPException, Depends, Query, Response
from pydantic import BaseModel
from typing import Optional

from backend.routes.auth import get_current_user
from backend.services.order_engine import order_engine
from backend.database import get_db

router = APIRouter(prefix="/api", tags=["trading"])


class PlaceOrderRequest(BaseModel):
    symbol: str
    side: str                        # BUY or SELL
    order_type: str = "MARKET"       # MARKET or LIMIT
    quantity: float
    limit_price: Optional[float] = None
    price: Optional[float] = None    # Override fill price (used for options from chain)
    leverage: Optional[float] = 1.0  # 1x up to 20x leverage (Futures/Stocks only; Options use 1x Buy / 10x Sell margin)
    asset_class: Optional[str] = None
    expiry_date: Optional[str] = None


def check_user_trading_status(user: dict):
    """Ensure user is not banned or frozen from trading."""
    if user.get("isBanned") or user.get("is_banned") == 1:
        reason = user.get("banReason") or user.get("ban_reason") or "Account under risk/compliance review"
        raise HTTPException(
            status_code=403,
            detail=f"Trading Suspended: Your account has been frozen by Administrator. Reason: {reason}. For appeals or to restore trading access, please contact support at zerobossai@gmail.com"
        )


def check_symbol_trading_overrides(symbol: str, requested_leverage: float):
    """Check if symbol is disabled or leverage is capped by Admin."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT max_leverage, is_trading_disabled, notes FROM symbol_leverage_overrides WHERE symbol = ?", (symbol,))
        row = cursor.fetchone()
        if row:
            if row["is_trading_disabled"] == 1:
                note = row["notes"] or "Market risk controls active."
                raise HTTPException(
                    status_code=400,
                    detail=f"Trading for {symbol} is currently disabled by Admin. ({note})"
                )
            sym_max_lev = float(row["max_leverage"])
            if requested_leverage > sym_max_lev:
                raise HTTPException(
                    status_code=400,
                    detail=f"Maximum leverage for {symbol} is currently capped at {int(sym_max_lev)}x by Risk Engine."
                )


@router.post("/orders")
def place_order(req: PlaceOrderRequest, user: dict = Depends(get_current_user)):
    """Place a simulated Market or Limit order with optional leverage for Futures and 10x margin for Option Selling."""
    check_user_trading_status(user)

    user_id = user["id"]
    sym = req.symbol.strip().upper()
    side = req.side.strip().upper()
    otype = req.order_type.strip().upper()
    leverage = max(1.0, min(20.0, float(req.leverage or 1.0)))

    # Check per-symbol leverage & disable overrides
    check_symbol_trading_overrides(sym, leverage)

    # Enforce maximum leverage based on user's active plan
    max_allowed = float(user.get("maxLeverage") or user.get("max_leverage") or 2.0)
    is_admin = bool(user.get("isAdmin") or user.get("is_admin", 0) == 1)
    if leverage > max_allowed and not is_admin:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {int(max_allowed)}x leverage allowed on Free plan. Upgrade to a paid plan to unlock up to 20x leverage."
        )

    try:
        if otype == "MARKET":
            res = order_engine.execute_market_order(
                user_id, sym, side, req.quantity,
                price_override=req.price,
                leverage=leverage,
                asset_class_override=req.asset_class,
                expiry_date=req.expiry_date
            )
            return res
        elif otype == "LIMIT":
            if not req.limit_price or req.limit_price <= 0:
                raise HTTPException(status_code=400, detail="Valid limit price required for LIMIT order.")
            res = order_engine.place_limit_order(
                user_id, sym, side, req.quantity,
                req.limit_price,
                leverage=leverage,
                asset_class_override=req.asset_class,
                expiry_date=req.expiry_date
            )
            return res
        else:
            raise HTTPException(status_code=400, detail="Invalid order type. Supported: MARKET, LIMIT.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Order execution error: {str(e)}")


@router.delete("/orders/{order_id}")
def cancel_order(order_id: int, user: dict = Depends(get_current_user)):
    """Cancel a pending limit order and unlock reserved funds."""
    check_user_trading_status(user)
    try:
        res = order_engine.cancel_order(user["id"], order_id)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class ModifyOrderRequest(BaseModel):
    quantity: float
    limit_price: float


@router.put("/orders/{order_id}")
def modify_order(order_id: int, req: ModifyOrderRequest, user: dict = Depends(get_current_user)):
    """Modify a pending limit order's quantity or limit price."""
    check_user_trading_status(user)
    try:
        res = order_engine.modify_limit_order(user["id"], order_id, req.quantity, req.limit_price)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Order modification error: {str(e)}")


@router.get("/orders")
def list_orders(
    status: Optional[str] = Query(None, description="PENDING | FILLED | CANCELLED"),
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user)
):
    """List orders for current user."""
    with get_db() as conn:
        cursor = conn.cursor()
        if status:
            cursor.execute("""
                SELECT * FROM orders
                WHERE user_id = ? AND status = ?
                ORDER BY created_at DESC LIMIT ?
            """, (user["id"], status.upper(), limit))
        else:
            cursor.execute("""
                SELECT * FROM orders
                WHERE user_id = ?
                ORDER BY created_at DESC LIMIT ?
            """, (user["id"], limit))

        rows = cursor.fetchall()
        return {"orders": [dict(r) for r in rows]}


@router.get("/portfolio")
def get_portfolio(user: dict = Depends(get_current_user)):
    """Retrieve full portfolio status, open positions, today's closed positions, and P&L metrics."""
    try:
        return order_engine.get_portfolio(user["id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch portfolio: {str(e)}")


@router.post("/portfolio/reset")
def reset_portfolio(user: dict = Depends(get_current_user)):
    """Reset virtual cash balance to starting plan amount and wipe all positions/order logs."""
    check_user_trading_status(user)
    try:
        res = order_engine.reset_portfolio(user["id"])
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset portfolio: {str(e)}")


@router.get("/transactions")
def get_transactions(
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user)
):
    """Retrieve executed trade fills and audit log."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM transactions
            WHERE user_id = ?
            ORDER BY timestamp DESC LIMIT ?
        """, (user["id"], limit))
        rows = cursor.fetchall()
        return {"transactions": [dict(r) for r in rows]}


# =========================================================================
# ZERODHA CONSOLE STYLE 1-YEAR P&L REPORT & STATEMENT EXPORT
# =========================================================================

@router.get("/reports/pnl")
def get_pnl_report(
    timeframe: str = Query("1y", description="7d, 30d, 90d, 1y, all"),
    asset_class: str = Query("all", description="all, stock, crypto, forex, options, index"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    user: dict = Depends(get_current_user)
):
    """Retrieve Zerodha Console-style P&L report, daily timeline chart, and analytics (Premium Only)."""
    is_paid = bool(user.get("isPaidPlan") or user.get("isAdmin") or (user.get("planId") and user.get("planId") not in ("basic", "free")))
    if not is_paid:
        raise HTTPException(
            status_code=403, 
            detail="P&L statements and analytics are reserved for paid plan subscribers. Please upgrade your plan."
        )

    try:
        report = order_engine.get_pnl_report(
            user_id=user["id"],
            timeframe=timeframe,
            asset_class=asset_class,
            start_date=start_date,
            end_date=end_date
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate P&L report: {str(e)}")


@router.get("/reports/export")
def export_pnl_csv(
    timeframe: str = Query("1y"),
    asset_class: str = Query("all"),
    user: dict = Depends(get_current_user)
):
    """Export trading statement as a CSV file (Premium Only)."""
    is_paid = bool(user.get("isPaidPlan") or user.get("isAdmin") or (user.get("planId") and user.get("planId") not in ("basic", "free")))
    if not is_paid:
        raise HTTPException(
            status_code=403, 
            detail="CSV trade ledger exports are reserved for paid plan subscribers. Please upgrade your plan."
        )

    try:
        report = order_engine.get_pnl_report(
            user_id=user["id"],
            timeframe=timeframe,
            asset_class=asset_class
        )
        trades = report.get("trades", [])

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Trade ID", "Symbol", "Instrument Name", "Asset Class",
            "Quantity", "Buy Avg Price ($)", "Sell Avg Price ($)",
            "Realized P&L ($)", "Return (%)", "Closed At (UTC)"
        ])

        for t in trades:
            writer.writerow([
                t["id"],
                t["symbol"],
                t["name"],
                t["assetClass"],
                t["quantity"],
                t["entryPrice"],
                t["exitPrice"],
                t["realizedPnl"],
                t["realizedPnlPercent"],
                t["closedAt"]
            ])

        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=ZeroVega_PnL_Statement_{timeframe}.csv"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export CSV: {str(e)}")
