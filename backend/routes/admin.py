"""
Master Admin Controls & User Management Routes for ZeroTrade.
Empowers Platform Admin with:
1. User Signup Analytics & Complete User Database Viewer (plans, expiration, cash, trades).
2. Direct Plan Granting / Upgrades / Extensions (no payment required).
3. Direct Capital Balance Adjustment & Account Wipes/Resets.
4. Admin Status Toggles.
5. Live Platform-Wide Positions Risk Monitor & Force-Close.
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from pydantic import BaseModel

from backend.database import get_db
from backend.routes.auth import get_current_user, invalidate_user_cache, format_user_and_check_expiry
from backend.routes.billing import require_admin, MONETIZATION_PLANS
from backend.services.data_hub import data_hub

logger = logging.getLogger("zerotrade.admin")

router = APIRouter(prefix="/api/admin", tags=["admin"])


class GrantPlanRequest(BaseModel):
    plan_id: str                      # 'reset_10k' | 'tier_20k' | 'tier_25k' | 'free'
    custom_days: Optional[int] = None
    override_cash: Optional[float] = None


class AdjustCashRequest(BaseModel):
    virtual_cash: float


class ForceClosePositionRequest(BaseModel):
    position_id: int
    reason: Optional[str] = "Admin Forced Risk Liquidation"


@router.get("/stats")
def get_admin_overview_stats(admin_user: dict = Depends(require_admin)):
    """Retrieve platform-wide high-level metrics and health statistics."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Total Users
        cursor.execute("SELECT COUNT(*) as total_users FROM users WHERE email NOT LIKE '%@zeroboss.trade'")
        total_users_row = cursor.fetchone()
        total_users = total_users_row["total_users"] if total_users_row else 0

        # Total Real & Demo Users Combined
        cursor.execute("SELECT COUNT(*) as all_users FROM users")
        all_users = cursor.fetchone()["all_users"]

        # Active Paid Users
        cursor.execute("""
            SELECT COUNT(*) as paid_users 
            FROM users 
            WHERE plan_id != 'free' AND plan_expires_at IS NOT NULL
        """)
        paid_users_row = cursor.fetchone()
        paid_users = paid_users_row["paid_users"] if paid_users_row else 0

        # Total Revenue (INR)
        cursor.execute("SELECT COALESCE(SUM(amount_inr), 0) as total_rev FROM payment_orders WHERE status = 'completed'")
        total_rev_row = cursor.fetchone()
        total_revenue_inr = float(total_rev_row["total_rev"]) if total_rev_row else 0.0

        # Pending Payment Orders
        cursor.execute("SELECT COUNT(*) as pending_count FROM payment_orders WHERE status = 'pending'")
        pending_count_row = cursor.fetchone()
        pending_orders = pending_count_row["pending_count"] if pending_count_row else 0

        # Total Open Positions Platform-Wide
        cursor.execute("SELECT COUNT(*) as open_pos, COALESCE(SUM(ABS(quantity) * avg_entry_price), 0) as total_notional FROM positions")
        pos_row = cursor.fetchone()
        open_positions = pos_row["open_pos"] if pos_row else 0
        total_notional = float(pos_row["total_notional"]) if pos_row else 0.0

        # Total Orders Executed
        cursor.execute("SELECT COUNT(*) as total_orders FROM orders")
        orders_row = cursor.fetchone()
        total_orders = orders_row["total_orders"] if orders_row else 0

        return {
            "totalUsers": all_users,
            "realUsers": total_users,
            "paidUsers": paid_users,
            "freeUsers": max(0, all_users - paid_users),
            "totalRevenueInr": total_revenue_inr,
            "pendingOrders": pending_orders,
            "openPositions": open_positions,
            "totalNotionalExposure": total_notional,
            "totalOrders": total_orders
        }


@router.get("/users")
def get_all_users(
    search: Optional[str] = Query(None),
    plan_filter: Optional[str] = Query(None), # 'all' | 'free' | 'paid' | 'admin'
    admin_user: dict = Depends(require_admin)
):
    """List all registered platform users with plan status, balance, trade volume, and expiration."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 
                u.id, u.email, u.display_name, u.virtual_cash, u.is_admin,
                u.plan_id, u.plan_name, u.plan_expires_at, u.max_leverage, u.created_at,
                (SELECT COUNT(*) FROM positions p WHERE p.user_id = u.id) as positions_count,
                (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as orders_count,
                (SELECT COALESCE(SUM(realized_pnl), 0) FROM transactions t WHERE t.user_id = u.id) as total_pnl
            FROM users u
            ORDER BY u.id DESC
        """)
        rows = cursor.fetchall()
        users_list = []

        now_utc = datetime.now(timezone.utc)

        for r in rows:
            u_dict = format_user_and_check_expiry(dict(r), conn=conn)
            
            # Compute days remaining
            days_left = None
            if u_dict.get("planExpiresAt"):
                try:
                    exp_ts = u_dict["planExpiresAt"].replace("Z", "+00:00")
                    if "+" not in exp_ts and "-" not in exp_ts[10:]:
                        exp_dt = datetime.fromisoformat(exp_ts).replace(tzinfo=timezone.utc)
                    else:
                        exp_dt = datetime.fromisoformat(exp_ts)
                    diff = (exp_dt - now_utc).total_seconds()
                    days_left = max(0, int(diff / 86400))
                except Exception:
                    pass

            item = {
                "id": u_dict["id"],
                "email": u_dict["email"],
                "displayName": u_dict["displayName"],
                "virtualCash": u_dict["virtualCash"],
                "isAdmin": u_dict["isAdmin"],
                "planId": u_dict["planId"],
                "planName": u_dict["planName"],
                "planExpiresAt": u_dict["planExpiresAt"],
                "daysLeft": days_left,
                "isPaidPlan": u_dict["isPaidPlan"],
                "maxLeverage": u_dict["maxLeverage"],
                "positionsCount": r["positions_count"],
                "ordersCount": r["orders_count"],
                "totalPnl": round(float(r["total_pnl"]), 2),
                "createdAt": str(r["created_at"]) if r["created_at"] else None
            }

            # Filter search
            if search:
                s = search.lower().strip()
                if s not in item["email"].lower() and s not in item["displayName"].lower() and s not in str(item["id"]):
                    continue

            # Filter plan type
            if plan_filter == "paid" and not item["isPaidPlan"]:
                continue
            if plan_filter == "free" and item["isPaidPlan"]:
                continue
            if plan_filter == "admin" and not item["isAdmin"]:
                continue

            users_list.append(item)

        return {
            "total": len(users_list),
            "users": users_list
        }


@router.post("/users/{user_id}/grant-plan")
def grant_plan_to_user(
    user_id: int,
    req: GrantPlanRequest,
    admin_user: dict = Depends(require_admin)
):
    """Admin grants or upgrades a user's subscription plan directly without payment."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, display_name, virtual_cash FROM users WHERE id = ?", (user_id,))
        target_user = cursor.fetchone()
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found.")

        plan_id = req.plan_id.strip()

        if plan_id == "free":
            # Downgrade to free
            cursor.execute("""
                UPDATE users 
                SET plan_id = 'free', plan_name = 'Free Basic', plan_expires_at = NULL, max_leverage = 2
                WHERE id = ?
            """, (user_id,))
            invalidate_user_cache(user_id)
            return {"success": True, "message": f"User #{user_id} reverted to Free Basic Plan (2x max leverage)."}

        matched_plan = next((p for p in MONETIZATION_PLANS if p["id"] == plan_id), None)
        plan_name = matched_plan["name"] if matched_plan else f"Custom Plan ({plan_id})"
        duration_days = req.custom_days or (matched_plan.get("durationDays", 30) if matched_plan else 30)
        grant_cash = req.override_cash or (matched_plan.get("virtualCash", 10000.0) if matched_plan else 10000.0)

        expires_at = datetime.now(timezone.utc) + timedelta(days=duration_days)
        expires_at_str = expires_at.strftime("%Y-%m-%d %H:%M:%S%z")

        cursor.execute("""
            UPDATE users 
            SET plan_id = ?, plan_name = ?, plan_expires_at = ?, max_leverage = 20, virtual_cash = ?
            WHERE id = ?
        """, (plan_id, plan_name, expires_at_str, grant_cash, user_id))

        invalidate_user_cache(user_id)

        try:
            from backend.services.firebase_sync import sync_user
            cursor.execute("SELECT id, email, password_hash, display_name, virtual_cash, is_admin, plan_id, plan_name, plan_expires_at, max_leverage FROM users WHERE id = ?", (user_id,))
            u_row = cursor.fetchone()
            if u_row:
                sync_user(dict(u_row))
        except Exception:
            pass

        return {
            "success": True,
            "message": f"Successfully granted {plan_name} to User #{user_id} ({duration_days} Days validity, ${grant_cash:,.2f} virtual cash, 20x leverage)."
        }


@router.post("/users/{user_id}/adjust-cash")
def adjust_user_cash(
    user_id: int,
    req: AdjustCashRequest,
    admin_user: dict = Depends(require_admin)
):
    """Admin manually sets or tops up virtual cash for any trader."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found.")

        new_cash = max(0.0, float(req.virtual_cash))
        cursor.execute("UPDATE users SET virtual_cash = ? WHERE id = ?", (new_cash, user_id))
        invalidate_user_cache(user_id)

        return {
            "success": True,
            "message": f"User #{user_id} cash balance adjusted to ${new_cash:,.2f}."
        }


@router.post("/users/{user_id}/toggle-admin")
def toggle_user_admin_status(
    user_id: int,
    admin_user: dict = Depends(require_admin)
):
    """Toggle administrator permissions for a user."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, is_admin FROM users WHERE id = ?", (user_id,))
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found.")

        new_admin = 0 if target["is_admin"] == 1 else 1
        cursor.execute("UPDATE users SET is_admin = ? WHERE id = ?", (new_admin, user_id))
        invalidate_user_cache(user_id)

        return {
            "success": True,
            "isAdmin": bool(new_admin == 1),
            "message": f"User #{user_id} ({target['email']}) admin status set to {bool(new_admin == 1)}."
        }


@router.post("/users/{user_id}/reset-portfolio")
def admin_reset_user_portfolio(
    user_id: int,
    admin_user: dict = Depends(require_admin)
):
    """Clear all active positions, orders, and reset user balance to $2,000 (or plan starting cash)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, plan_id FROM users WHERE id = ?", (user_id,))
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found.")

        reset_cash = 2000.0 if target["plan_id"] == "free" else 10000.0

        cursor.execute("UPDATE users SET virtual_cash = ? WHERE id = ?", (reset_cash, user_id))
        cursor.execute("DELETE FROM positions WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM orders WHERE user_id = ?", (user_id,))
        invalidate_user_cache(user_id)

        return {
            "success": True,
            "message": f"User #{user_id} portfolio wiped clean & balance reset to ${reset_cash:,.2f}."
        }


@router.get("/positions")
def get_all_platform_positions(admin_user: dict = Depends(require_admin)):
    """Real-time platform risk monitor: View all open positions across all active traders."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                p.id, p.user_id, p.symbol, p.asset_class, p.quantity, 
                p.avg_entry_price, p.leverage, p.updated_at,
                u.email as user_email, u.display_name as user_name, u.plan_name
            FROM positions p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.updated_at DESC
        """)
        rows = cursor.fetchall()
        positions_list = []

        for r in rows:
            sym = r["symbol"]
            ticker = data_hub.get_ticker(sym)
            live_price = float(ticker.get("price", r["avg_entry_price"])) if ticker else float(r["avg_entry_price"])
            qty = float(r["quantity"])
            entry = float(r["avg_entry_price"])
            lev = float(r["leverage"] or 1.0)
            
            # Calculate unrealized P&L
            diff = (live_price - entry) if qty > 0 else (entry - live_price)
            unrealized_pnl = diff * abs(qty)
            margin_used = (abs(qty) * entry) / lev if lev > 0 else (abs(qty) * entry)

            positions_list.append({
                "id": r["id"],
                "userId": r["user_id"],
                "userEmail": r["user_email"],
                "userName": r["user_name"],
                "planName": r["plan_name"],
                "symbol": sym,
                "assetClass": r["asset_class"],
                "side": "LONG" if qty > 0 else "SHORT",
                "quantity": abs(qty),
                "avgEntryPrice": entry,
                "currentPrice": live_price,
                "leverage": lev,
                "marginUsed": round(margin_used, 2),
                "unrealizedPnl": round(unrealized_pnl, 2),
                "updatedAt": str(r["updated_at"])
            })

        return {
            "totalPositions": len(positions_list),
            "positions": positions_list
        }


@router.post("/positions/{position_id}/force-close")
def force_close_position(
    position_id: int,
    req: ForceClosePositionRequest = ForceClosePositionRequest(position_id=0),
    admin_user: dict = Depends(require_admin)
):
    """Admin emergency risk management: Force-close any open position at market price."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM positions WHERE id = ?", (position_id,))
        pos = cursor.fetchone()
        if not pos:
            raise HTTPException(status_code=404, detail="Position not found.")

        user_id = pos["user_id"]
        sym = pos["symbol"]
        qty = float(pos["quantity"])
        entry = float(pos["avg_entry_price"])
        lev = float(pos["leverage"] or 1.0)

        ticker = data_hub.get_ticker(sym)
        live_price = float(ticker.get("price", entry)) if ticker else entry

        # Compute P&L and return margin + P&L
        diff = (live_price - entry) if qty > 0 else (entry - live_price)
        pnl = diff * abs(qty)
        margin = (abs(qty) * entry) / lev if lev > 0 else (abs(qty) * entry)
        cash_return = max(0.0, margin + pnl)

        # Credit user cash and delete position
        cursor.execute("UPDATE users SET virtual_cash = virtual_cash + ? WHERE id = ?", (cash_return, user_id))
        cursor.execute("DELETE FROM positions WHERE id = ?", (position_id,))
        
        # Log closing transaction
        cursor.execute("""
            INSERT INTO transactions (user_id, symbol, asset_class, side, quantity, price, entry_price, leverage, realized_pnl, is_close)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (user_id, sym, pos["asset_class"], "SELL" if qty > 0 else "BUY", abs(qty), live_price, entry, lev, pnl))

        invalidate_user_cache(user_id)

        return {
            "success": True,
            "message": f"Position #{position_id} ({sym}) force-closed at ${live_price:,.2f}. Realized P&L: ${pnl:+,.2f}."
        }
