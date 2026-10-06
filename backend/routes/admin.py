"""
Master Admin Controls & Management Routes for ZeroTrade.
Powers:
1. User Directory & Plan Management (Search, Expiry, 1-Click Plan Grants, Balance Override, Account Wipe).
2. User Ban / Freeze Trading (Suspend trading privileges with custom reason, 1-click unban).
3. Global Broadcast / Maintenance Announcements (Info, Warning, Danger, Success banners).
4. Custom Leverage & Margin Overrides (Per-symbol leverage limits, disable trading on volatile symbols).
5. 1-Click CSV / Excel Data Exports (Users, Orders, UPI Payments, Open Risk Positions).
6. Comprehensive Audit Log Tracker (Timestamped audit trail of all administrative actions).
7. Custom Coupons / Promo Discount Engine (Create/toggle discount codes, max uses, expiry).
8. Dynamic Monetization Plan Customizer (Edit pricing in ₹, duration days, capital amounts, leverage limits).
"""
import io
import csv
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Header, Query, Response
from pydantic import BaseModel

from backend.database import get_db
from backend.routes.auth import get_current_user, invalidate_user_cache, format_user_and_check_expiry
from backend.routes.billing import require_admin, get_db_plans
from backend.services.data_hub import data_hub

logger = logging.getLogger("zerotrade.admin")

router = APIRouter(prefix="/api/admin", tags=["admin"])
public_router = APIRouter(prefix="/api", tags=["public"])


# =========================================================================
# Request Models
# =========================================================================

class GrantPlanRequest(BaseModel):
    plan_id: str                      # 'reset_10k' | 'tier_20k' | 'tier_25k' | 'free' or custom
    custom_days: Optional[int] = None
    override_cash: Optional[float] = None


class AdjustCashRequest(BaseModel):
    virtual_cash: float


class ToggleBanRequest(BaseModel):
    is_banned: bool
    reason: Optional[str] = "Violated terms or excessive risk threshold"


class ForceClosePositionRequest(BaseModel):
    position_id: int
    reason: Optional[str] = "Admin Forced Risk Liquidation"


class AnnouncementRequest(BaseModel):
    message: str
    announcement_type: Optional[str] = "info" # 'info' | 'warning' | 'danger' | 'success'
    is_active: Optional[bool] = True


class LeverageOverrideRequest(BaseModel):
    symbol: str
    max_leverage: float
    margin_rate: Optional[float] = 1.0
    is_trading_disabled: Optional[bool] = False
    notes: Optional[str] = ""


class CouponCreateRequest(BaseModel):
    code: str
    discount_percent: Optional[float] = 0.0
    discount_amount_inr: Optional[float] = 0.0
    max_uses: Optional[int] = 100
    plan_id: Optional[str] = None
    expires_at: Optional[str] = None


class PlanEditRequest(BaseModel):
    id: str
    name: str
    price_inr: Optional[float] = None
    priceInr: Optional[float] = None
    virtual_cash: Optional[float] = None
    virtualCash: Optional[float] = None
    duration_days: Optional[int] = None
    durationDays: Optional[int] = None
    max_leverage: Optional[int] = None
    maxLeverage: Optional[int] = None
    badge: Optional[str] = None
    description: Optional[str] = None
    features: Optional[List[str]] = None
    is_active: Optional[bool] = None
    isActive: Optional[bool] = None
    display_order: Optional[int] = None
    displayOrder: Optional[int] = None


# =========================================================================
# Audit Logger Helper
# =========================================================================

def log_admin_action(
    admin_user: dict,
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    details: Optional[str] = None,
    conn=None
):
    """Record an audit trail event into admin_audit_logs."""
    admin_id = admin_user.get("id", 0)
    admin_email = admin_user.get("email", "admin@zeroboss.trade")
    
    def _execute_log(cursor):
        cursor.execute("""
            INSERT INTO admin_audit_logs (admin_id, admin_email, action, target_type, target_id, details)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (admin_id, admin_email, action, target_type, str(target_id or ""), details or ""))

    try:
        if conn:
            _execute_log(conn.cursor())
        else:
            with get_db() as local_conn:
                _execute_log(local_conn.cursor())
    except Exception as e:
        logger.warning(f"Failed to record admin audit log: {e}")


# =========================================================================
# 1. Platform Statistics & Overview
# =========================================================================

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

        # Total Banned Users
        cursor.execute("SELECT COUNT(*) as banned_cnt FROM users WHERE is_banned = 1")
        banned_row = cursor.fetchone()
        banned_users = banned_row["banned_cnt"] if banned_row else 0

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
            "bannedUsers": banned_users,
            "freeUsers": max(0, all_users - paid_users),
            "totalRevenueInr": total_revenue_inr,
            "pendingOrders": pending_orders,
            "openPositions": open_positions,
            "totalNotionalExposure": total_notional,
            "totalOrders": total_orders
        }


# =========================================================================
# 2. User Directory & Plan Operations
# =========================================================================

@router.get("/users")
def get_all_users(
    search: Optional[str] = Query(None),
    plan_filter: Optional[str] = Query(None), # 'all' | 'free' | 'paid' | 'admin' | 'banned'
    admin_user: dict = Depends(require_admin)
):
    """List all registered platform users with plan status, balance, trade volume, expiration, and ban state."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 
                u.id, u.email, u.display_name, u.virtual_cash, u.is_admin,
                u.plan_id, u.plan_name, u.plan_expires_at, u.max_leverage, u.is_banned, u.ban_reason, u.created_at,
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
                "isBanned": u_dict.get("isBanned", False),
                "banReason": u_dict.get("banReason", ""),
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
            if plan_filter == "banned" and not item["isBanned"]:
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
            log_admin_action(admin_user, "DOWNGRADE_PLAN", "USER", str(user_id), f"Reverted user {target_user['email']} to Free Basic", conn=conn)
            return {"success": True, "message": f"User #{user_id} reverted to Free Basic Plan (2x max leverage)."}

        plans = get_db_plans()
        matched_plan = next((p for p in plans if p["id"] == plan_id), None)
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
            cursor.execute("SELECT id, email, password_hash, display_name, virtual_cash, is_admin, plan_id, plan_name, plan_expires_at, max_leverage, is_banned, ban_reason FROM users WHERE id = ?", (user_id,))
            u_row = cursor.fetchone()
            if u_row:
                sync_user(dict(u_row))
        except Exception:
            pass

        log_admin_action(admin_user, "GRANT_PLAN", "USER", str(user_id), f"Granted {plan_name} ({duration_days}d, ${grant_cash:,.2f}) to {target_user['email']}", conn=conn)

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
        cursor.execute("SELECT id, email, virtual_cash FROM users WHERE id = ?", (user_id,))
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found.")

        new_cash = max(0.0, float(req.virtual_cash))
        cursor.execute("UPDATE users SET virtual_cash = ? WHERE id = ?", (new_cash, user_id))
        invalidate_user_cache(user_id)

        log_admin_action(admin_user, "ADJUST_CASH", "USER", str(user_id), f"Changed cash from ${target['virtual_cash']:,.2f} to ${new_cash:,.2f} for {target['email']}", conn=conn)

        return {
            "success": True,
            "message": f"User #{user_id} cash balance adjusted to ${new_cash:,.2f}."
        }


@router.post("/users/{user_id}/toggle-ban")
def toggle_user_ban(
    user_id: int,
    req: ToggleBanRequest,
    admin_user: dict = Depends(require_admin)
):
    """Suspend or restore trading privileges for a user."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, is_banned FROM users WHERE id = ?", (user_id,))
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found.")

        new_banned = 1 if req.is_banned else 0
        reason = req.reason.strip() if req.reason else ("Trading suspended by admin" if new_banned else "")

        cursor.execute("UPDATE users SET is_banned = ?, ban_reason = ? WHERE id = ?", (new_banned, reason, user_id))
        invalidate_user_cache(user_id)

        action_name = "BAN_USER" if new_banned else "UNBAN_USER"
        log_admin_action(admin_user, action_name, "USER", str(user_id), f"{'Banned' if new_banned else 'Unbanned'} {target['email']}. Reason: {reason}", conn=conn)

        return {
            "success": True,
            "isBanned": bool(new_banned == 1),
            "banReason": reason,
            "message": f"User #{user_id} ({target['email']}) has been {'frozen/banned from trading' if new_banned else 'restored and unbanned'}."
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

        log_admin_action(admin_user, "TOGGLE_ADMIN", "USER", str(user_id), f"Set isAdmin={bool(new_admin==1)} for {target['email']}", conn=conn)

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
        cursor.execute("SELECT id, email, plan_id FROM users WHERE id = ?", (user_id,))
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found.")

        reset_cash = 2000.0 if target["plan_id"] == "free" else 10000.0

        cursor.execute("UPDATE users SET virtual_cash = ? WHERE id = ?", (reset_cash, user_id))
        cursor.execute("DELETE FROM positions WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM orders WHERE user_id = ?", (user_id,))
        invalidate_user_cache(user_id)

        log_admin_action(admin_user, "RESET_PORTFOLIO", "USER", str(user_id), f"Wiped trades and reset balance to ${reset_cash:,.2f} for {target['email']}", conn=conn)

        return {
            "success": True,
            "message": f"User #{user_id} portfolio wiped clean & balance reset to ${reset_cash:,.2f}."
        }


@router.delete("/users/{user_id}")
def admin_delete_user(
    user_id: int,
    admin_user: dict = Depends(require_admin)
):
    """Permanently delete a user account and purge all their positions, orders, transactions, and cloud data."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email FROM users WHERE id = ?", (user_id,))
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found.")

        if target["email"] == "zerobossai@gmail.com":
            raise HTTPException(status_code=400, detail="Cannot delete Master Admin account.")

        cursor.execute("DELETE FROM positions WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM orders WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM transactions WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM payment_orders WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        invalidate_user_cache(user_id)

        try:
            from backend.services.firebase_sync import get_firestore_client
            f_db = get_firestore_client()
            if f_db:
                f_db.collection("users").document(str(user_id)).delete()
                for p_doc in f_db.collection("positions").where("user_id", "==", user_id).stream():
                    p_doc.reference.delete()
        except Exception as e:
            logger.debug(f"Firestore delete user cleanup error: {e}")

        log_admin_action(admin_user, "DELETE_USER", "USER", str(user_id), f"Permanently deleted user {target['email']}", conn=conn)

        return {
            "success": True,
            "message": f"User #{user_id} ({target['email']}) and all associated records permanently deleted."
        }


@router.post("/purge-legacy-users")
def admin_purge_legacy_users(admin_user: dict = Depends(require_admin)):
    """Wipe all old mock/demo accounts, keeping only Master Admin and genuine Google accounts."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM users 
            WHERE email != 'zerobossai@gmail.com' 
              AND (
                  email LIKE '%@zeroboss.trade' 
                  OR email LIKE '%@example.com' 
                  OR email LIKE '%@test.com' 
                  OR email LIKE '%@zerotrade.test' 
                  OR email IN ('demo@zeroboss.trade', 'pola@gmail.com', 'hazz@gmail.com', 'harrysaido66@gmail.com')
              )
        """)
        cursor.execute("DELETE FROM positions WHERE user_id NOT IN (SELECT id FROM users)")
        cursor.execute("DELETE FROM orders WHERE user_id NOT IN (SELECT id FROM users)")
        cursor.execute("DELETE FROM transactions WHERE user_id NOT IN (SELECT id FROM users)")
        cursor.execute("DELETE FROM payment_orders WHERE user_id NOT IN (SELECT id FROM users)")
        invalidate_user_cache()

        try:
            from backend.services.firebase_sync import get_firestore_client
            f_db = get_firestore_client()
            if f_db:
                for doc in f_db.collection("users").stream():
                    u_data = doc.to_dict()
                    u_email = (u_data.get("email") or "").lower().strip()
                    if u_email != "zerobossai@gmail.com" and any(m in u_email for m in ["demo@", "apex_", "crypto_whale", "quant_", "fx_", "steady_", "tester_", "trader_", "payer_", "hazz@", "test_", "pola@", "harrysaido66@"]):
                        doc.reference.delete()
        except Exception as e:
            logger.debug(f"Firestore purge legacy users error: {e}")

        log_admin_action(admin_user, "PURGE_LEGACY_USERS", "SYSTEM", "ALL", "Purged all mock/legacy accounts", conn=conn)

        return {
            "success": True,
            "message": "All old mock accounts have been completely purged."
        }


# =========================================================================
# 3. Live Positions & Force-Close Risk Engine
# =========================================================================

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

        log_admin_action(admin_user, "FORCE_CLOSE_POSITION", "POSITION", str(position_id), f"Force-closed {sym} for User #{user_id} at ${live_price:,.2f} (P&L: ${pnl:+,.2f}). Reason: {req.reason}", conn=conn)

        return {
            "success": True,
            "message": f"Position #{position_id} ({sym}) force-closed at ${live_price:,.2f}. Realized P&L: ${pnl:+,.2f}."
        }


# =========================================================================
# 4. Global Announcements & Maintenance Banners
# =========================================================================

@public_router.get("/announcements/active")
def get_active_announcement():
    """Public endpoint to fetch currently broadcasted platform announcement."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, message, announcement_type, is_active, updated_at FROM system_announcements WHERE is_active = 1 ORDER BY id DESC LIMIT 1")
            row = cursor.fetchone()
            if row:
                return {
                    "active": True,
                    "id": row["id"],
                    "message": row["message"],
                    "type": row["announcement_type"],
                    "updatedAt": str(row["updated_at"])
                }
    except Exception as e:
        logger.debug(f"Announcement fetch error: {e}")
    return {"active": False, "announcement": None}


@router.get("/announcements")
def get_all_announcements(admin_user: dict = Depends(require_admin)):
    """Admin view of all announcement banners."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM system_announcements ORDER BY id DESC")
        rows = cursor.fetchall()
        return {
            "announcements": [dict(r) for r in rows]
        }


@router.post("/announcements")
def create_or_update_announcement(
    req: AnnouncementRequest,
    admin_user: dict = Depends(require_admin)
):
    """Post a new broadcast announcement banner across all logged-in trader terminals."""
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Announcement message cannot be empty.")

    with get_db() as conn:
        cursor = conn.cursor()
        is_act = 1 if req.is_active else 0
        
        # Deactivate others if this is active
        if is_act == 1:
            cursor.execute("UPDATE system_announcements SET is_active = 0")

        cursor.execute("""
            INSERT INTO system_announcements (message, announcement_type, is_active, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        """, (req.message.strip(), req.announcement_type or "info", is_act))
        ann_id = cursor.lastrowid

        log_admin_action(admin_user, "CREATE_ANNOUNCEMENT", "ANNOUNCEMENT", str(ann_id), f"Posted [{req.announcement_type}] banner: {req.message.strip()[:60]}...", conn=conn)

        return {
            "success": True,
            "id": ann_id,
            "message": "Broadcast announcement published successfully!"
        }


@router.post("/announcements/{ann_id}/toggle")
def toggle_announcement(
    ann_id: int,
    admin_user: dict = Depends(require_admin)
):
    """Toggle announcement active / inactive."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, is_active, message FROM system_announcements WHERE id = ?", (ann_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Announcement not found.")

        new_act = 0 if row["is_active"] == 1 else 1
        if new_act == 1:
            cursor.execute("UPDATE system_announcements SET is_active = 0")

        cursor.execute("UPDATE system_announcements SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_act, ann_id))

        log_admin_action(admin_user, "TOGGLE_ANNOUNCEMENT", "ANNOUNCEMENT", str(ann_id), f"Set is_active={bool(new_act==1)} for announcement #{ann_id}", conn=conn)

        return {
            "success": True,
            "isActive": bool(new_act == 1),
            "message": f"Announcement #{ann_id} is now {'Active & Visible' if new_act == 1 else 'Hidden'}."
        }


@router.delete("/announcements/{ann_id}")
def delete_announcement(
    ann_id: int,
    admin_user: dict = Depends(require_admin)
):
    """Delete an announcement banner."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM system_announcements WHERE id = ?", (ann_id,))
        log_admin_action(admin_user, "DELETE_ANNOUNCEMENT", "ANNOUNCEMENT", str(ann_id), f"Deleted announcement #{ann_id}", conn=conn)
        return {"success": True, "message": f"Announcement #{ann_id} deleted."}


# =========================================================================
# 5. Symbol Leverage & Risk Overrides
# =========================================================================

@router.get("/leverage-overrides")
def get_leverage_overrides(admin_user: dict = Depends(require_admin)):
    """Retrieve all symbol-specific leverage limits and trading lock overrides."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM symbol_leverage_overrides ORDER BY symbol ASC")
        rows = cursor.fetchall()
        return {
            "overrides": [dict(r) for r in rows]
        }


@router.post("/leverage-overrides")
def set_leverage_override(
    req: LeverageOverrideRequest,
    admin_user: dict = Depends(require_admin)
):
    """Set custom maximum leverage or halt trading for a specific market symbol."""
    sym = req.symbol.strip().upper()
    if not sym:
        raise HTTPException(status_code=400, detail="Symbol is required.")

    max_lev = max(1.0, min(50.0, float(req.max_leverage)))
    is_disabled = 1 if req.is_trading_disabled else 0

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO symbol_leverage_overrides (symbol, max_leverage, margin_rate, is_trading_disabled, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(symbol) DO UPDATE SET
                max_leverage = excluded.max_leverage,
                margin_rate = excluded.margin_rate,
                is_trading_disabled = excluded.is_trading_disabled,
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP
        """, (sym, max_lev, req.margin_rate or 1.0, is_disabled, req.notes or ""))

        log_admin_action(admin_user, "SET_LEVERAGE_OVERRIDE", "SYMBOL", sym, f"Set max leverage={int(max_lev)}x, disabled={bool(is_disabled==1)} for {sym}", conn=conn)

        return {
            "success": True,
            "symbol": sym,
            "maxLeverage": max_lev,
            "isTradingDisabled": bool(is_disabled == 1),
            "message": f"Risk limits for {sym} updated: Max {int(max_lev)}x leverage, Trading {'Disabled' if is_disabled else 'Active'}."
        }


@router.delete("/leverage-overrides/{symbol}")
def delete_leverage_override(
    symbol: str,
    admin_user: dict = Depends(require_admin)
):
    """Remove custom leverage limit for a symbol to restore default platform limits."""
    sym = symbol.strip().upper()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM symbol_leverage_overrides WHERE symbol = ?", (sym,))
        log_admin_action(admin_user, "DELETE_LEVERAGE_OVERRIDE", "SYMBOL", sym, f"Removed leverage override for {sym}", conn=conn)
        return {"success": True, "message": f"Custom leverage cap for {sym} removed. Default limits restored."}


# =========================================================================
# 6. Coupons & Referral Promo Engine
# =========================================================================

@router.get("/coupons")
def get_coupons(admin_user: dict = Depends(require_admin)):
    """List all created promo discount coupons."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM coupons ORDER BY id DESC")
        rows = cursor.fetchall()
        return {
            "coupons": [dict(r) for r in rows]
        }


@router.post("/coupons")
def create_coupon(
    req: CouponCreateRequest,
    admin_user: dict = Depends(require_admin)
):
    """Create a new promotional discount code for subscription upgrades."""
    code = req.code.strip().upper()
    if not code or len(code) < 3:
        raise HTTPException(status_code=400, detail="Coupon code must be at least 3 characters.")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM coupons WHERE UPPER(code) = ?", (code,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Coupon '{code}' already exists.")

        cursor.execute("""
            INSERT INTO coupons (code, discount_percent, discount_amount_inr, max_uses, used_count, plan_id, is_active, expires_at)
            VALUES (?, ?, ?, ?, 0, ?, 1, ?)
        """, (code, req.discount_percent or 0.0, req.discount_amount_inr or 0.0, req.max_uses or 100, req.plan_id or None, req.expires_at or None))
        c_id = cursor.lastrowid

        log_admin_action(admin_user, "CREATE_COUPON", "COUPON", code, f"Created coupon {code} ({req.discount_percent}% off, max {req.max_uses} uses)", conn=conn)

        return {
            "success": True,
            "id": c_id,
            "code": code,
            "message": f"Coupon code '{code}' created successfully!"
        }


@router.post("/coupons/{coupon_id}/toggle")
def toggle_coupon(
    coupon_id: int,
    admin_user: dict = Depends(require_admin)
):
    """Activate or deactivate a discount coupon."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, code, is_active FROM coupons WHERE id = ?", (coupon_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Coupon not found.")

        new_act = 0 if row["is_active"] == 1 else 1
        cursor.execute("UPDATE coupons SET is_active = ? WHERE id = ?", (new_act, coupon_id))

        log_admin_action(admin_user, "TOGGLE_COUPON", "COUPON", row["code"], f"Set is_active={bool(new_act==1)} for {row['code']}", conn=conn)

        return {
            "success": True,
            "isActive": bool(new_act == 1),
            "message": f"Coupon '{row['code']}' is now {'Active' if new_act == 1 else 'Deactivated'}."
        }


@router.delete("/coupons/{coupon_id}")
def delete_coupon(
    coupon_id: int,
    admin_user: dict = Depends(require_admin)
):
    """Delete a coupon code."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT code FROM coupons WHERE id = ?", (coupon_id,))
        row = cursor.fetchone()
        cursor.execute("DELETE FROM coupons WHERE id = ?", (coupon_id,))
        log_admin_action(admin_user, "DELETE_COUPON", "COUPON", row["code"] if row else str(coupon_id), f"Deleted coupon #{coupon_id}", conn=conn)
        return {"success": True, "message": f"Coupon deleted."}


# =========================================================================
# 7. Dynamic Monetization Plans Editor
# =========================================================================

@router.get("/plans")
def get_admin_plans(admin_user: dict = Depends(require_admin)):
    """Retrieve all monetization plans including inactive ones for editing."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM monetization_plans ORDER BY display_order ASC, price_inr ASC")
        rows = cursor.fetchall()
        plans = []
        for r in rows:
            feats = [f.strip() for f in (r["features"] or "").split("\n") if f.strip()]
            plans.append({
                "id": r["id"],
                "name": r["name"],
                "priceInr": float(r["price_inr"]),
                "virtualCash": float(r["virtual_cash"]),
                "durationDays": int(r["duration_days"]),
                "maxLeverage": int(r["max_leverage"] or 20),
                "badge": r["badge"] or "",
                "description": r["description"] or "",
                "features": feats,
                "isActive": bool(r["is_active"] == 1),
                "displayOrder": int(r["display_order"] or 0)
            })
        return {"plans": plans}


@router.post("/plans")
def create_or_update_plan(
    req: PlanEditRequest,
    admin_user: dict = Depends(require_admin)
):
    """Create or update monetization subscription plans dynamically."""
    pid = req.id.strip().lower().replace(" ", "_")
    if not pid:
        raise HTTPException(status_code=400, detail="Plan ID is required.")

    price_inr = req.price_inr if req.price_inr is not None else (req.priceInr if req.priceInr is not None else 0.0)
    virtual_cash = req.virtual_cash if req.virtual_cash is not None else (req.virtualCash if req.virtualCash is not None else 2000.0)
    duration_days = req.duration_days if req.duration_days is not None else (req.durationDays if req.durationDays is not None else 30)
    max_leverage = req.max_leverage if req.max_leverage is not None else (req.maxLeverage if req.maxLeverage is not None else 20)
    is_active_val = req.is_active if req.is_active is not None else (req.isActive if req.isActive is not None else True)
    display_order_val = req.display_order if req.display_order is not None else (req.displayOrder if req.displayOrder is not None else 0)

    features_str = "\n".join(req.features) if req.features else ""
    is_act = 1 if is_active_val else 0

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO monetization_plans (id, name, price_inr, virtual_cash, duration_days, max_leverage, badge, description, features, is_active, display_order, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                price_inr = excluded.price_inr,
                virtual_cash = excluded.virtual_cash,
                duration_days = excluded.duration_days,
                max_leverage = excluded.max_leverage,
                badge = excluded.badge,
                description = excluded.description,
                features = excluded.features,
                is_active = excluded.is_active,
                display_order = excluded.display_order,
                updated_at = CURRENT_TIMESTAMP
        """, (pid, req.name, price_inr, virtual_cash, duration_days, max_leverage, req.badge or "", req.description or "", features_str, is_act, display_order_val))

        log_admin_action(admin_user, "UPDATE_PLAN", "PLAN", pid, f"Configured plan {req.name} (₹{price_inr}, {duration_days}d, ${virtual_cash:,.2f})", conn=conn)

        # Sync to Firestore
        try:
            from backend.services.firebase_sync import sync_monetization_plan
            sync_monetization_plan({
                "id": pid,
                "name": req.name,
                "price_inr": price_inr,
                "virtual_cash": virtual_cash,
                "duration_days": duration_days,
                "max_leverage": max_leverage,
                "badge": req.badge or "",
                "description": req.description or "",
                "features": req.features or [],
                "is_active": bool(is_act == 1),
                "display_order": display_order_val
            })
        except Exception:
            pass

        return {
            "success": True,
            "planId": pid,
            "message": f"Plan '{req.name}' successfully saved! Changes are live across all client pricing tiers."
        }


@router.delete("/plans/{plan_id}")
def delete_plan(
    plan_id: str,
    admin_user: dict = Depends(require_admin)
):
    """Deactivate or remove a monetization plan."""
    pid = plan_id.strip()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM monetization_plans WHERE id = ?", (pid,))
        log_admin_action(admin_user, "DELETE_PLAN", "PLAN", pid, f"Deleted plan {pid}", conn=conn)
        try:
            from backend.services.firebase_sync import delete_monetization_plan
            delete_monetization_plan(pid)
        except Exception:
            pass
        return {"success": True, "message": f"Plan '{pid}' removed."}



# =========================================================================
# 8. Admin Audit Log Viewer
# =========================================================================

@router.get("/audit-logs")
def get_audit_logs(
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    admin_user: dict = Depends(require_admin)
):
    """Retrieve timestamped administrative audit trail events."""
    with get_db() as conn:
        cursor = conn.cursor()
        if search:
            s = f"%{search.strip().lower()}%"
            cursor.execute("""
                SELECT * FROM admin_audit_logs
                WHERE LOWER(admin_email) LIKE ? OR LOWER(action) LIKE ? OR LOWER(target_id) LIKE ? OR LOWER(details) LIKE ?
                ORDER BY id DESC LIMIT ?
            """, (s, s, s, s, limit))
        else:
            cursor.execute("SELECT * FROM admin_audit_logs ORDER BY id DESC LIMIT ?", (limit,))

        rows = cursor.fetchall()
        return {
            "logs": [dict(r) for r in rows],
            "count": len(rows)
        }


# =========================================================================
# 9. 1-Click CSV / Excel Data Exports
# =========================================================================

@router.get("/export/{report_type}")
def export_csv_report(
    report_type: str, # 'users' | 'orders' | 'payments' | 'positions'
    admin_user: dict = Depends(require_admin)
):
    """Generate and stream full CSV reports for accounting and record keeping."""
    rtype = report_type.strip().lower()
    output = io.StringIO()
    writer = csv.writer(output)

    with get_db() as conn:
        cursor = conn.cursor()

        if rtype == "users":
            writer.writerow(["User ID", "Email", "Display Name", "Plan ID", "Plan Name", "Plan Expiry (UTC)", "Virtual Cash ($)", "Max Leverage", "Is Admin", "Is Banned", "Ban Reason", "Created At"])
            cursor.execute("SELECT id, email, display_name, plan_id, plan_name, plan_expires_at, virtual_cash, max_leverage, is_admin, is_banned, ban_reason, created_at FROM users ORDER BY id ASC")
            for r in cursor.fetchall():
                writer.writerow([
                    r["id"], r["email"], r["display_name"], r["plan_id"], r["plan_name"],
                    r["plan_expires_at"] or "N/A", f"{r['virtual_cash']:.2f}", f"{r['max_leverage']}x",
                    "YES" if r["is_admin"] == 1 else "NO", "YES" if r["is_banned"] == 1 else "NO",
                    r["ban_reason"] or "", str(r["created_at"])
                ])
            filename = f"zerotrade_users_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        elif rtype == "orders":
            writer.writerow(["Order ID", "User ID", "User Email", "Symbol", "Asset Class", "Side", "Order Type", "Quantity", "Limit Price", "Filled Price", "Leverage", "Status", "Created At", "Filled At"])
            cursor.execute("""
                SELECT o.id, o.user_id, u.email as user_email, o.symbol, o.asset_class, o.side, o.order_type, o.quantity, o.limit_price, o.filled_price, o.leverage, o.status, o.created_at, o.filled_at
                FROM orders o
                JOIN users u ON o.user_id = u.id
                ORDER BY o.id DESC
            """)
            for r in cursor.fetchall():
                writer.writerow([
                    r["id"], r["user_id"], r["user_email"], r["symbol"], r["asset_class"],
                    r["side"], r["order_type"], r["quantity"], r["limit_price"] or "",
                    r["filled_price"] or "", f"{r['leverage']}x", r["status"],
                    str(r["created_at"]), str(r["filled_at"]) or ""
                ])
            filename = f"zerotrade_orders_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        elif rtype == "payments":
            writer.writerow(["Deposit ID", "User ID", "User Email", "Plan ID", "Plan Name", "Amount (INR)", "Virtual Cash Granted ($)", "UPI ID", "Bank UTR Ref", "Status", "Admin Notes", "Created At", "Approved At"])
            cursor.execute("""
                SELECT p.id, p.user_id, u.email as user_email, p.plan_id, p.plan_name, p.amount_inr, p.virtual_cash_granted, p.upi_id, p.utr_ref, p.status, p.admin_notes, p.created_at, p.approved_at
                FROM payment_orders p
                JOIN users u ON p.user_id = u.id
                ORDER BY p.id DESC
            """)
            for r in cursor.fetchall():
                writer.writerow([
                    r["id"], r["user_id"], r["user_email"], r["plan_id"], r["plan_name"],
                    r["amount_inr"], r["virtual_cash_granted"], r["upi_id"], r["utr_ref"],
                    r["status"].upper(), r["admin_notes"] or "", str(r["created_at"]), str(r["approved_at"]) or ""
                ])
            filename = f"zerotrade_upi_payments_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        elif rtype == "positions":
            writer.writerow(["Position ID", "User ID", "User Email", "Symbol", "Asset Class", "Side", "Quantity", "Entry Price ($)", "Current Price ($)", "Leverage", "Margin Used ($)", "Unrealized P&L ($)", "Updated At"])
            cursor.execute("""
                SELECT p.id, p.user_id, u.email as user_email, p.symbol, p.asset_class, p.quantity, p.avg_entry_price, p.leverage, p.updated_at
                FROM positions p
                JOIN users u ON p.user_id = u.id
                ORDER BY p.id DESC
            """)
            for r in cursor.fetchall():
                sym = r["symbol"]
                t = data_hub.get_ticker(sym)
                live_p = float(t.get("price", r["avg_entry_price"])) if t else float(r["avg_entry_price"])
                qty = float(r["quantity"])
                entry = float(r["avg_entry_price"])
                lev = float(r["leverage"] or 1.0)
                diff = (live_p - entry) if qty > 0 else (entry - live_p)
                pnl = diff * abs(qty)
                margin = (abs(qty) * entry) / lev if lev > 0 else (abs(qty) * entry)

                writer.writerow([
                    r["id"], r["user_id"], r["user_email"], sym, r["asset_class"],
                    "LONG" if qty > 0 else "SHORT", abs(qty), f"{entry:.2f}", f"{live_p:.2f}",
                    f"{lev}x", f"{margin:.2f}", f"{pnl:+.2f}", str(r["updated_at"])
                ])
            filename = f"zerotrade_open_positions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        else:
            raise HTTPException(status_code=400, detail="Invalid report type. Supported: users, orders, payments, positions.")

    log_admin_action(admin_user, "EXPORT_CSV", "REPORT", rtype, f"Exported {rtype} CSV report")

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
