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


@router.post("/orders")
def place_order(req: PlaceOrderRequest, user: dict = Depends(get_current_user)):
    """Place a simulated Market or Limit order with optional leverage for Futures and 10x margin for Option Selling."""
    user_id = user["id"]
    sym = req.symbol.strip().upper()
    side = req.side.strip().upper()
    otype = req.order_type.strip().upper()
    leverage = max(1.0, min(20.0, float(req.leverage or 1.0)))

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
    """Reset virtual cash balance to $100,000 and wipe all positions/order logs."""
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
    """Retrieve Zerodha Console-style P&L report, daily timeline chart, and analytics."""
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
    """Export trading statement as a CSV file."""
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
