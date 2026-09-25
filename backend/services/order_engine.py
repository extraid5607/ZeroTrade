"""
Simulated Order Matching, Portfolio Execution, and Zerodha-Style P&L Reporting Engine.
Handles:
- Up to 20x Leverage for Futures, Stocks, Crypto, and Forex trading.
- Full Cash Margin (1x, No Leverage) for Option Buying.
- 10x Option Premium Margin for Option Selling / Writing (e.g. $10 premium requires $100 margin).
- Day-long closed position tracking (US Eastern Time) and comprehensive 1-Year P&L statements.
Zero real money, 100% paper trading.
"""
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from backend.database import get_db
from backend.config import INITIAL_VIRTUAL_CASH
from backend.services.data_hub import data_hub

logger = logging.getLogger("zerotrade.order_engine")


def get_us_eastern_today_start_utc() -> str:
    """Return the UTC timestamp string corresponding to 00:00:00 US Eastern Time today."""
    try:
        import zoneinfo
        us_tz = zoneinfo.ZoneInfo("America/New_York")
    except Exception:
        # Fallback to UTC-4 (Eastern Daylight Time)
        us_tz = timezone(timedelta(hours=-4))

    now_et = datetime.now(us_tz)
    today_start_et = now_et.replace(hour=0, minute=0, second=0, microsecond=0)
    return today_start_et.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def is_option_asset(symbol: str, asset_class: str = None) -> bool:
    """Determine whether an asset is an Option contract based on symbol notation or asset class."""
    if asset_class and asset_class.lower() == "options":
        return True
    sym_upper = symbol.upper()
    if any(sym_upper.endswith(s) for s in [" CE", " PE", " CALL", " PUT"]):
        return True
    if " CE " in sym_upper or " PE " in sym_upper:
        return True
    return False


class OrderEngine:
    def __init__(self):
        # Link callback with data_hub so price changes check limit orders
        data_hub.set_order_check_callback(self.check_limit_orders)

    def _invalidate_cache(self, user_id: int):
        try:
            from backend.routes.auth import invalidate_user_cache
            invalidate_user_cache(user_id)
        except Exception:
            pass

        try:
            from backend.services.firebase_sync import sync_user, sync_all_user_positions
            with get_db() as conn:
                c = conn.cursor()
                c.execute("SELECT id, email, password_hash, display_name, virtual_cash, is_admin FROM users WHERE id = ?", (user_id,))
                u = c.fetchone()
                if u:
                    sync_user(dict(u))
                c.execute("SELECT * FROM positions WHERE user_id = ?", (user_id,))
                active_pos = [dict(p) for p in c.fetchall()]
                sync_all_user_positions(user_id, active_pos)
        except Exception:
            pass

    def execute_market_order(
        self,
        user_id: int,
        symbol: str,
        side: str,
        quantity: float,
        price_override: float = None,
        leverage: float = 1.0,
        asset_class_override: str = None,
        expiry_date: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Execute an immediate Market Buy or Sell order supporting:
        - Futures / Stocks / Crypto / Forex: Up to 20x Leverage (Margin = Nominal / Leverage).
        - Option Buying: 100% Full Cash Margin (No Leverage permitted).
        - Option Selling / Writing: 10x Option Premium Margin required (e.g. $10 premium requires $100 cash margin).
        """
        side = side.upper()
        if side not in ["BUY", "SELL"]:
            raise ValueError("Order side must be BUY or SELL.")
        if quantity <= 0:
            raise ValueError("Quantity must be greater than 0.")

        ticker = data_hub.tickers.get(symbol)
        if asset_class_override:
            asset_class = asset_class_override
            fill_price = price_override if price_override and price_override > 0 else (ticker["price"] if ticker else 10.0)
        elif ticker:
            fill_price = ticker["price"]
            asset_class = ticker["category"]
        elif price_override and price_override > 0:
            fill_price = price_override
            asset_class = "options"
        elif is_option_asset(symbol):
            fill_price = price_override if price_override and price_override > 0 else 10.0
            asset_class = "options"
        else:
            raise ValueError(f"Symbol {symbol} not recognized in market data.")

        is_option = is_option_asset(symbol, asset_class)
        nominal_value = fill_price * quantity

        if is_option and not expiry_date:
            try:
                from backend.services.option_settlement import parse_option_symbol
                parsed_opt = parse_option_symbol(symbol)
                if parsed_opt:
                    expiry_date = parsed_opt.get("expiry_date")
            except Exception:
                pass

        with get_db() as conn:
            cursor = conn.cursor()

            # Fetch user cash and existing position in a single combined query
            cursor.execute("""
                SELECT u.virtual_cash, p.id as pos_id, p.quantity as pos_qty, p.avg_entry_price, p.asset_class as pos_asset_class, p.leverage as pos_leverage
                FROM users u
                LEFT JOIN positions p ON p.user_id = u.id AND p.symbol = ?
                WHERE u.id = ?
            """, (symbol, user_id))
            raw_row = cursor.fetchone()
            if not raw_row:
                raise ValueError("User not found.")
            user_and_pos = dict(raw_row)
            cash = user_and_pos["virtual_cash"]
            pos = None
            if user_and_pos.get("pos_id") is not None:
                pos = {
                    "id": user_and_pos["pos_id"],
                    "quantity": user_and_pos["pos_qty"],
                    "avg_entry_price": user_and_pos["avg_entry_price"],
                    "asset_class": user_and_pos["pos_asset_class"],
                    "leverage": user_and_pos["pos_leverage"]
                }

            if side == "BUY":
                if not pos or pos["quantity"] >= 0:
                    # =========================================================================
                    # 1. OPEN LONG OR ADD TO LONG
                    # =========================================================================
                    if is_option:
                        # OPTION BUYING: Full Margin Required (1x, No Leverage allowed)
                        effective_leverage = 1.0
                        margin_required = nominal_value  # 100% cash margin
                        if cash < margin_required:
                            raise ValueError(
                                f"Insufficient virtual cash for Option Buy (Full Margin Required). "
                                f"Required: ${margin_required:,.2f}, Available: ${cash:,.2f}"
                            )
                    else:
                        # FUTURES / STOCKS / CRYPTO / FOREX: Up to 20x Leverage
                        effective_leverage = max(1.0, min(20.0, float(leverage or 1.0)))
                        margin_required = nominal_value / effective_leverage
                        if cash < margin_required:
                            raise ValueError(
                                f"Insufficient virtual cash for {effective_leverage:g}x leverage. "
                                f"Required Margin: ${margin_required:,.2f}, Available: ${cash:,.2f}"
                            )

                    new_cash = cash - margin_required
                    cursor.execute("UPDATE users SET virtual_cash = ? WHERE id = ?", (new_cash, user_id))

                    if pos:
                        old_qty = pos["quantity"]
                        old_avg = pos["avg_entry_price"]
                        old_lev = pos["leverage"] if "leverage" in pos.keys() and pos["leverage"] else 1.0
                        combined_qty = old_qty + quantity
                        combined_avg = ((old_qty * old_avg) + (quantity * fill_price)) / combined_qty

                        old_margin = (old_qty * old_avg) / old_lev
                        total_margin = old_margin + margin_required
                        combined_lev = ((combined_qty * combined_avg) / total_margin) if total_margin > 0 else 1.0

                        cursor.execute("""
                            UPDATE positions
                            SET quantity = ?, avg_entry_price = ?, leverage = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        """, (combined_qty, combined_avg, combined_lev, pos["id"]))
                    else:
                        cursor.execute("""
                            INSERT INTO positions (user_id, symbol, asset_class, quantity, avg_entry_price, leverage, expiry_date)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (user_id, symbol, asset_class, quantity, fill_price, effective_leverage, expiry_date))

                    # Record filled order & transaction
                    cursor.execute("""
                        INSERT INTO orders (user_id, symbol, asset_class, side, order_type, quantity, leverage, status, filled_price, filled_at)
                        VALUES (?, ?, ?, 'BUY', 'MARKET', ?, ?, 'FILLED', ?, CURRENT_TIMESTAMP)
                    """, (user_id, symbol, asset_class, quantity, effective_leverage, fill_price))
                    order_id = cursor.lastrowid

                    cursor.execute("""
                        INSERT INTO transactions (user_id, order_id, symbol, asset_class, side, quantity, price, entry_price, leverage, realized_pnl, pnl_percent)
                        VALUES (?, ?, ?, ?, 'BUY', ?, ?, ?, ?, 0.0, 0.0)
                    """, (user_id, order_id, symbol, asset_class, quantity, fill_price, fill_price, effective_leverage))

                    self._invalidate_cache(user_id)
                    return {
                        "success": True,
                        "orderId": order_id,
                        "symbol": symbol,
                        "side": "BUY",
                        "type": "MARKET",
                        "quantity": quantity,
                        "fillPrice": fill_price,
                        "nominalValue": round(nominal_value, 2),
                        "leverage": effective_leverage,
                        "marginInvested": round(margin_required, 2),
                        "remainingCash": round(new_cash, 2),
                        "action": "LONG_OPEN",
                        "isOption": is_option
                    }

                else:
                    # =========================================================================
                    # 2. SHORT COVER (Buy back short position or buy back written option)
                    # =========================================================================
                    short_qty = abs(pos["quantity"])
                    entry_price = pos["avg_entry_price"]
                    pos_lev = pos["leverage"] if "leverage" in pos.keys() and pos["leverage"] else (0.1 if is_option else 1.0)

                    if quantity <= short_qty:
                        # Partial or full cover
                        covered_qty = quantity
                        margin_refund = (entry_price * covered_qty) / pos_lev
                        realized_pnl = (entry_price - fill_price) * covered_qty
                        pnl_percent = (realized_pnl / margin_refund * 100) if margin_refund > 0 else 0.0

                        cash_refund = margin_refund + realized_pnl
                        new_cash = cash + cash_refund
                        cursor.execute("UPDATE users SET virtual_cash = ? WHERE id = ?", (new_cash, user_id))

                        remaining_short = short_qty - covered_qty
                        if remaining_short <= 1e-7:
                            cursor.execute("DELETE FROM positions WHERE id = ?", (pos["id"],))
                        else:
                            cursor.execute("""
                                UPDATE positions
                                SET quantity = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            """, (-remaining_short, pos["id"]))

                        cursor.execute("""
                            INSERT INTO orders (user_id, symbol, asset_class, side, order_type, quantity, leverage, status, filled_price, filled_at)
                            VALUES (?, ?, ?, 'BUY', 'MARKET', ?, ?, 'FILLED', ?, CURRENT_TIMESTAMP)
                        """, (user_id, symbol, asset_class, quantity, pos_lev, fill_price))
                        order_id = cursor.lastrowid

                        cursor.execute("""
                            INSERT INTO transactions (user_id, order_id, symbol, asset_class, side, quantity, price, entry_price, leverage, realized_pnl, pnl_percent)
                            VALUES (?, ?, ?, ?, 'BUY', ?, ?, ?, ?, ?, ?)
                        """, (user_id, order_id, symbol, asset_class, covered_qty, fill_price, entry_price, pos_lev, realized_pnl, pnl_percent))

                        self._invalidate_cache(user_id)
                        return {
                            "success": True,
                            "orderId": order_id,
                            "symbol": symbol,
                            "side": "BUY",
                            "type": "MARKET",
                            "quantity": quantity,
                            "fillPrice": fill_price,
                            "nominalValue": round(nominal_value, 2),
                            "leverage": pos_lev,
                            "marginRefund": round(margin_refund, 2),
                            "realizedPnl": round(realized_pnl, 2),
                            "realizedPnlPercent": round(pnl_percent, 2),
                            "remainingCash": round(new_cash, 2),
                            "action": "OPTION_COVER" if is_option else "SHORT_COVER",
                            "isOption": is_option
                        }
                    else:
                        # Cover all short AND flip to Long
                        covered_qty = short_qty
                        new_long_qty = quantity - short_qty

                        margin_refund = (entry_price * covered_qty) / pos_lev
                        realized_pnl = (entry_price - fill_price) * covered_qty
                        pnl_percent = (realized_pnl / margin_refund * 100) if margin_refund > 0 else 0.0
                        cover_cash_refund = margin_refund + realized_pnl

                        if is_option:
                            new_long_lev = 1.0
                            new_long_margin = fill_price * new_long_qty
                        else:
                            new_long_lev = max(1.0, min(20.0, float(leverage or 1.0)))
                            new_long_margin = (fill_price * new_long_qty) / new_long_lev

                        net_cash_delta = cover_cash_refund - new_long_margin

                        if cash + net_cash_delta < 0:
                            raise ValueError(
                                f"Insufficient virtual cash to flip to long. "
                                f"Required Long Margin: ${new_long_margin:,.2f}, Cover Refund: ${cover_cash_refund:,.2f}, Available: ${cash:,.2f}"
                            )

                        new_cash = cash + net_cash_delta
                        cursor.execute("UPDATE users SET virtual_cash = ? WHERE id = ?", (new_cash, user_id))

                        cursor.execute("""
                            UPDATE positions
                            SET quantity = ?, avg_entry_price = ?, leverage = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        """, (new_long_qty, fill_price, new_long_lev, pos["id"]))

                        cursor.execute("""
                            INSERT INTO orders (user_id, symbol, asset_class, side, order_type, quantity, leverage, status, filled_price, filled_at)
                            VALUES (?, ?, ?, 'BUY', 'MARKET', ?, ?, 'FILLED', ?, CURRENT_TIMESTAMP)
                        """, (user_id, symbol, asset_class, quantity, new_long_lev, fill_price))
                        order_id = cursor.lastrowid

                        cursor.execute("""
                            INSERT INTO transactions (user_id, order_id, symbol, asset_class, side, quantity, price, entry_price, leverage, realized_pnl, pnl_percent)
                            VALUES (?, ?, ?, ?, 'BUY', ?, ?, ?, ?, ?, ?)
                        """, (user_id, order_id, symbol, asset_class, covered_qty, fill_price, entry_price, pos_lev, realized_pnl, pnl_percent))

                        self._invalidate_cache(user_id)
                        return {
                            "success": True,
                            "orderId": order_id,
                            "symbol": symbol,
                            "side": "BUY",
                            "type": "MARKET",
                            "quantity": quantity,
                            "fillPrice": fill_price,
                            "nominalValue": round(nominal_value, 2),
                            "leverage": new_long_lev,
                            "realizedPnl": round(realized_pnl, 2),
                            "realizedPnlPercent": round(pnl_percent, 2),
                            "remainingCash": round(new_cash, 2),
                            "action": "FLIP_TO_LONG",
                            "isOption": is_option
                        }

            else:
                # =============================================================================
                # side == "SELL" (Long Exit, Short Sell, or Option Writing)
                # =============================================================================
                if pos and pos["quantity"] > 0:
                    # User is LONG -> Exiting Long Position (Selling existing holding)
                    long_qty = pos["quantity"]
                    entry_price = pos["avg_entry_price"]
                    pos_lev = pos["leverage"] if "leverage" in pos.keys() and pos["leverage"] else 1.0

                    if quantity <= long_qty:
                        # Partial or full long exit
                        closed_qty = quantity
                        margin_refund = (entry_price * closed_qty) / pos_lev
                        realized_pnl = (fill_price - entry_price) * closed_qty
                        pnl_percent = (realized_pnl / margin_refund * 100) if margin_refund > 0 else 0.0

                        cash_refund = margin_refund + realized_pnl
                        new_cash = cash + cash_refund
                        cursor.execute("UPDATE users SET virtual_cash = ? WHERE id = ?", (new_cash, user_id))

                        remaining_long = long_qty - closed_qty
                        if remaining_long <= 1e-7:
                            cursor.execute("DELETE FROM positions WHERE id = ?", (pos["id"],))
                        else:
                            cursor.execute("""
                                UPDATE positions
                                SET quantity = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            """, (remaining_long, pos["id"]))

                        cursor.execute("""
                            INSERT INTO orders (user_id, symbol, asset_class, side, order_type, quantity, leverage, status, filled_price, filled_at)
                            VALUES (?, ?, ?, 'SELL', 'MARKET', ?, ?, 'FILLED', ?, CURRENT_TIMESTAMP)
                        """, (user_id, symbol, asset_class, quantity, pos_lev, fill_price))
                        order_id = cursor.lastrowid

                        cursor.execute("""
                            INSERT INTO transactions (user_id, order_id, symbol, asset_class, side, quantity, price, entry_price, leverage, realized_pnl, pnl_percent)
                            VALUES (?, ?, ?, ?, 'SELL', ?, ?, ?, ?, ?, ?)
                        """, (user_id, order_id, symbol, asset_class, closed_qty, fill_price, entry_price, pos_lev, realized_pnl, pnl_percent))

                        self._invalidate_cache(user_id)
                        return {
                            "success": True,
                            "orderId": order_id,
                            "symbol": symbol,
                            "side": "SELL",
                            "type": "MARKET",
                            "quantity": quantity,
                            "fillPrice": fill_price,
                            "nominalValue": round(nominal_value, 2),
                            "leverage": pos_lev,
                            "marginRefund": round(margin_refund, 2),
                            "realizedPnl": round(realized_pnl, 2),
                            "realizedPnlPercent": round(pnl_percent, 2),
                            "remainingCash": round(new_cash, 2),
                            "action": "LONG_CLOSE",
                            "isOption": is_option
                        }
                    else:
                        # Close entire long AND flip to SHORT / OPTION WRITE
                        closed_qty = long_qty
                        new_short_qty = quantity - long_qty

                        margin_refund = (entry_price * closed_qty) / pos_lev
                        realized_pnl = (fill_price - entry_price) * closed_qty
                        pnl_percent = (realized_pnl / margin_refund * 100) if margin_refund > 0 else 0.0
                        exit_cash_refund = margin_refund + realized_pnl

                        if is_option:
                            new_short_lev = 0.1  # 10x Option Premium Margin Required
                            new_short_margin = fill_price * new_short_qty * 10.0
                        else:
                            new_short_lev = max(1.0, min(20.0, float(leverage or 1.0)))
                            new_short_margin = (fill_price * new_short_qty) / new_short_lev

                        net_cash_delta = exit_cash_refund - new_short_margin

                        if cash + net_cash_delta < 0:
                            raise ValueError(
                                f"Insufficient virtual cash to flip to short. "
                                f"Required Short Margin: ${new_short_margin:,.2f}, Exit Refund: ${exit_cash_refund:,.2f}, Available: ${cash:,.2f}"
                            )

                        new_cash = cash + net_cash_delta
                        cursor.execute("UPDATE users SET virtual_cash = ? WHERE id = ?", (new_cash, user_id))

                        cursor.execute("""
                            UPDATE positions
                            SET quantity = ?, avg_entry_price = ?, leverage = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        """, (-new_short_qty, fill_price, new_short_lev, pos["id"]))

                        cursor.execute("""
                            INSERT INTO orders (user_id, symbol, asset_class, side, order_type, quantity, leverage, status, filled_price, filled_at)
                            VALUES (?, ?, ?, 'SELL', 'MARKET', ?, ?, 'FILLED', ?, CURRENT_TIMESTAMP)
                        """, (user_id, symbol, asset_class, quantity, new_short_lev, fill_price))
                        order_id = cursor.lastrowid

                        cursor.execute("""
                            INSERT INTO transactions (user_id, order_id, symbol, asset_class, side, quantity, price, entry_price, leverage, realized_pnl, pnl_percent)
                            VALUES (?, ?, ?, ?, 'SELL', ?, ?, ?, ?, ?, ?)
                        """, (user_id, order_id, symbol, asset_class, closed_qty, fill_price, entry_price, pos_lev, realized_pnl, pnl_percent))

                        self._invalidate_cache(user_id)
                        return {
                            "success": True,
                            "orderId": order_id,
                            "symbol": symbol,
                            "side": "SELL",
                            "type": "MARKET",
                            "quantity": quantity,
                            "fillPrice": fill_price,
                            "nominalValue": round(nominal_value, 2),
                            "leverage": new_short_lev,
                            "realizedPnl": round(realized_pnl, 2),
                            "realizedPnlPercent": round(pnl_percent, 2),
                            "remainingCash": round(new_cash, 2),
                            "action": "FLIP_TO_SHORT",
                            "isOption": is_option
                        }

                else:
                    # User has NO position or is already SHORT -> SHORT SELL OR OPTION WRITING
                    if is_option:
                        # OPTION WRITING / SELLING: 10x More Margin Of Option Premium Required
                        effective_leverage = 0.1  # 0.1 leverage = 10x margin multiplier (Nominal / 0.1 = Nominal * 10)
                        margin_required = fill_price * quantity * 10.0
                        if cash < margin_required:
                            raise ValueError(
                                f"Insufficient virtual cash for Option Writing (10x Option Premium Margin Required). "
                                f"Premium: ${fill_price:,.2f} x {quantity} Qty -> Required Margin: ${margin_required:,.2f}, Available: ${cash:,.2f}"
                            )
                    else:
                        # FUTURES / STOCKS / CRYPTO / FOREX SHORT SELL: Up to 20x Leverage
                        effective_leverage = max(1.0, min(20.0, float(leverage or 1.0)))
                        margin_required = nominal_value / effective_leverage
                        if cash < margin_required:
                            raise ValueError(
                                f"Insufficient virtual cash for {effective_leverage:g}x short margin. "
                                f"Required Margin: ${margin_required:,.2f}, Available: ${cash:,.2f}"
                            )

                    new_cash = cash - margin_required
                    cursor.execute("UPDATE users SET virtual_cash = ? WHERE id = ?", (new_cash, user_id))

                    if not pos:
                        # New Short Position
                        cursor.execute("""
                            INSERT INTO positions (user_id, symbol, asset_class, quantity, avg_entry_price, leverage, expiry_date)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (user_id, symbol, asset_class, -quantity, fill_price, effective_leverage, expiry_date))
                    else:
                        # Adding to existing Short Position
                        old_short_qty = abs(pos["quantity"])
                        old_avg = pos["avg_entry_price"]
                        old_lev = pos["leverage"] if "leverage" in pos.keys() and pos["leverage"] else (0.1 if is_option else 1.0)
                        combined_short = old_short_qty + quantity
                        combined_avg = ((old_short_qty * old_avg) + (quantity * fill_price)) / combined_short

                        old_margin = (old_short_qty * old_avg) / old_lev
                        total_margin = old_margin + margin_required
                        combined_lev = ((combined_short * combined_avg) / total_margin) if total_margin > 0 else (0.1 if is_option else 1.0)

                        cursor.execute("""
                            UPDATE positions
                            SET quantity = ?, avg_entry_price = ?, leverage = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        """, (-combined_short, combined_avg, combined_lev, pos["id"]))

                    cursor.execute("""
                        INSERT INTO orders (user_id, symbol, asset_class, side, order_type, quantity, leverage, status, filled_price, filled_at)
                        VALUES (?, ?, ?, 'SELL', 'MARKET', ?, ?, 'FILLED', ?, CURRENT_TIMESTAMP)
                    """, (user_id, symbol, asset_class, quantity, effective_leverage, fill_price))
                    order_id = cursor.lastrowid

                    cursor.execute("""
                        INSERT INTO transactions (user_id, order_id, symbol, asset_class, side, quantity, price, entry_price, leverage, realized_pnl, pnl_percent)
                        VALUES (?, ?, ?, ?, 'SELL', ?, ?, ?, ?, 0.0, 0.0)
                    """, (user_id, order_id, symbol, asset_class, quantity, fill_price, fill_price, effective_leverage))

                    self._invalidate_cache(user_id)
                    return {
                        "success": True,
                        "orderId": order_id,
                        "symbol": symbol,
                        "side": "SELL",
                        "type": "MARKET",
                        "quantity": quantity,
                        "fillPrice": fill_price,
                        "nominalValue": round(nominal_value, 2),
                        "leverage": effective_leverage,
                        "marginInvested": round(margin_required, 2),
                        "realizedPnl": 0.0,
                        "realizedPnlPercent": 0.0,
                        "remainingCash": round(new_cash, 2),
                        "action": "OPTION_WRITE" if is_option else "SHORT_OPEN",
                        "isOption": is_option
                    }

    def place_limit_order(
        self,
        user_id: int,
        symbol: str,
        side: str,
        quantity: float,
        limit_price: float,
        leverage: float = 1.0,
        asset_class_override: str = None,
        expiry_date: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Place a Limit Buy or Limit Sell order into the simulated order book with exact margin reservation."""
        side = side.upper()
        if side not in ["BUY", "SELL"]:
            raise ValueError("Order side must be BUY or SELL.")
        if quantity <= 0:
            raise ValueError("Quantity must be greater than 0.")
        if limit_price <= 0:
            raise ValueError("Limit price must be greater than 0.")

        ticker = data_hub.tickers.get(symbol)
        asset_class = asset_class_override or (ticker["category"] if ticker else ("options" if is_option_asset(symbol) else "stock"))
        is_option = is_option_asset(symbol, asset_class)
        nominal_val = limit_price * quantity

        if is_option:
            if side == "BUY":
                effective_leverage = 1.0  # Full margin for option buy
                margin_reserved = nominal_val
            else:
                effective_leverage = 0.1  # 10x margin for option writing
                margin_reserved = nominal_val * 10.0
        else:
            effective_leverage = max(1.0, min(20.0, float(leverage or 1.0)))
            margin_reserved = nominal_val / effective_leverage

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT virtual_cash FROM users WHERE id = ?", (user_id,))
            user_row = cursor.fetchone()
            if not user_row:
                raise ValueError("User not found.")
            cash = user_row["virtual_cash"]

            if cash < margin_reserved:
                raise ValueError(
                    f"Insufficient cash for limit order reserve. "
                    f"Required Margin: ${margin_reserved:,.2f}, Available: ${cash:,.2f}"
                )

            cursor.execute("UPDATE users SET virtual_cash = virtual_cash - ? WHERE id = ?", (margin_reserved, user_id))

            cursor.execute("""
                INSERT INTO orders (user_id, symbol, asset_class, side, order_type, quantity, limit_price, leverage, status)
                VALUES (?, ?, ?, ?, 'LIMIT', ?, ?, ?, 'PENDING')
            """, (user_id, symbol, asset_class, side, quantity, limit_price, effective_leverage))
            order_id = cursor.lastrowid

            self._invalidate_cache(user_id)
            return {
                "success": True,
                "orderId": order_id,
                "symbol": symbol,
                "side": side,
                "type": "LIMIT",
                "quantity": quantity,
                "limitPrice": limit_price,
                "leverage": effective_leverage,
                "marginReserved": round(margin_reserved, 2),
                "status": "PENDING",
                "isOption": is_option
            }

    def cancel_order(self, user_id: int, order_id: int) -> Dict[str, Any]:
        """Cancel a pending limit order and refund reserved margin."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM orders WHERE id = ? AND user_id = ?", (order_id, user_id))
            order = cursor.fetchone()
            if not order:
                raise ValueError("Order not found.")
            if order["status"] != "PENDING":
                raise ValueError(f"Cannot cancel order with status '{order['status']}'.")

            lev = order["leverage"] if "leverage" in order.keys() and order["leverage"] else 1.0
            refund = (order["limit_price"] * order["quantity"]) / lev
            cursor.execute("UPDATE users SET virtual_cash = virtual_cash + ? WHERE id = ?", (refund, user_id))

            cursor.execute("UPDATE orders SET status = 'CANCELLED' WHERE id = ?", (order_id,))
            self._invalidate_cache(user_id)
            return {
                "success": True,
                "message": f"Order #{order_id} cancelled successfully. Refunded ${refund:,.2f} margin.",
                "orderId": order_id
            }

    def modify_limit_order(self, user_id: int, order_id: int, new_quantity: float, new_limit_price: float) -> Dict[str, Any]:
        """Modify quantity and/or limit price of a pending limit order, adjusting reserved funds accordingly."""
        if new_quantity <= 0 or new_limit_price <= 0:
            raise ValueError("Quantity and limit price must be greater than 0.")

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM orders WHERE id = ? AND user_id = ?", (order_id, user_id))
            order = cursor.fetchone()
            if not order:
                raise ValueError("Order not found.")
            if order["status"] != "PENDING":
                raise ValueError(f"Cannot modify order with status '{order['status']}'.")

            lev = order["leverage"] if "leverage" in order.keys() and order["leverage"] else 1.0
            old_reserved = (order["limit_price"] * order["quantity"]) / lev
            new_reserved = (new_limit_price * new_quantity) / lev
            diff = new_reserved - old_reserved

            cursor.execute("SELECT virtual_cash FROM users WHERE id = ?", (user_id,))
            user_row = cursor.fetchone()
            cash = user_row["virtual_cash"] if user_row else 0.0

            if diff > 0 and cash < diff:
                raise ValueError(f"Insufficient cash to increase order margin. Need additional ${diff:,.2f}, Have ${cash:,.2f}")

            cursor.execute("UPDATE users SET virtual_cash = virtual_cash - ? WHERE id = ?", (diff, user_id))

            cursor.execute("""
                UPDATE orders
                SET quantity = ?, limit_price = ?
                WHERE id = ?
            """, (new_quantity, new_limit_price, order_id))

            self._invalidate_cache(user_id)
            return {
                "success": True,
                "orderId": order_id,
                "quantity": new_quantity,
                "limitPrice": new_limit_price,
                "status": "PENDING"
            }

    def check_limit_orders(self, symbol: str, current_price: float):
        """
        Check all pending limit orders for a symbol against the new live price and fill matching orders.
        """
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM orders
                    WHERE symbol = ? AND status = 'PENDING' AND order_type = 'LIMIT'
                """, (symbol,))
                pending_orders = cursor.fetchall()

                for order in pending_orders:
                    order_id = order["id"]
                    user_id = order["user_id"]
                    side = order["side"]
                    qty = order["quantity"]
                    limit_p = order["limit_price"]
                    asset_class = order["asset_class"]
                    lev = order["leverage"] if "leverage" in order.keys() and order["leverage"] else 1.0

                    fill = False
                    if side == "BUY" and current_price <= limit_p:
                        fill = True
                    elif side == "SELL" and current_price >= limit_p:
                        fill = True

                    if fill:
                        fill_price = current_price
                        fill_margin = (fill_price * qty) / lev

                        # Fetch user & positions
                        cursor.execute("SELECT virtual_cash FROM users WHERE id = ?", (user_id,))
                        user_row = cursor.fetchone()
                        if not user_row:
                            continue

                        cursor.execute(
                            "SELECT id, quantity, avg_entry_price, leverage FROM positions WHERE user_id = ? AND symbol = ?",
                            (user_id, symbol)
                        )
                        pos = cursor.fetchone()

                        if side == "BUY":
                            reserved_margin = (limit_p * qty) / lev
                            refund = max(0.0, reserved_margin - fill_margin)
                            if refund > 0:
                                cursor.execute("UPDATE users SET virtual_cash = virtual_cash + ? WHERE id = ?", (refund, user_id))

                            if not pos or pos["quantity"] >= 0:
                                old_qty = pos["quantity"] if pos else 0.0
                                old_avg = pos["avg_entry_price"] if pos else fill_price
                                old_lev = (pos["leverage"] if "leverage" in pos.keys() and pos["leverage"] else 1.0) if pos else lev

                                combined_qty = old_qty + qty
                                combined_avg = ((old_qty * old_avg) + (qty * fill_price)) / combined_qty

                                old_m = (old_qty * old_avg) / old_lev
                                comb_m = old_m + fill_margin
                                comb_lev = ((combined_qty * combined_avg) / comb_m) if comb_m > 0 else 1.0

                                if pos:
                                    cursor.execute(
                                        "UPDATE positions SET quantity = ?, avg_entry_price = ?, leverage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                                        (combined_qty, combined_avg, comb_lev, pos["id"])
                                    )
                                else:
                                    cursor.execute(
                                        "INSERT INTO positions (user_id, symbol, asset_class, quantity, avg_entry_price, leverage) VALUES (?, ?, ?, ?, ?, ?)",
                                        (user_id, symbol, asset_class, qty, fill_price, lev)
                                    )

                                cursor.execute(
                                    "INSERT INTO transactions (user_id, order_id, symbol, asset_class, side, quantity, price, entry_price, leverage, realized_pnl, pnl_percent) VALUES (?, ?, ?, ?, 'BUY', ?, ?, ?, ?, 0.0, 0.0)",
                                    (user_id, order_id, symbol, asset_class, qty, fill_price, fill_price, lev)
                                )
                            else:
                                # Short cover
                                short_qty = abs(pos["quantity"])
                                entry_price = pos["avg_entry_price"]
                                pos_lev = pos["leverage"] if "leverage" in pos.keys() and pos["leverage"] else 1.0

                                if qty <= short_qty:
                                    margin_refund = (entry_price * qty) / pos_lev
                                    realized_pnl = (entry_price - fill_price) * qty
                                    pnl_pct = (realized_pnl / margin_refund * 100) if margin_refund > 0 else 0.0

                                    cursor.execute("UPDATE users SET virtual_cash = virtual_cash + ? WHERE id = ?", (reserved_margin + margin_refund + realized_pnl, user_id))

                                    rem = short_qty - qty
                                    if rem <= 1e-7:
                                        cursor.execute("DELETE FROM positions WHERE id = ?", (pos["id"],))
                                    else:
                                        cursor.execute("UPDATE positions SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (-rem, pos["id"]))

                                    cursor.execute(
                                        "INSERT INTO transactions (user_id, order_id, symbol, asset_class, side, quantity, price, entry_price, leverage, realized_pnl, pnl_percent) VALUES (?, ?, ?, ?, 'BUY', ?, ?, ?, ?, ?, ?)",
                                        (user_id, order_id, symbol, asset_class, qty, fill_price, entry_price, pos_lev, realized_pnl, pnl_pct)
                                    )
                                else:
                                    covered_qty = short_qty
                                    new_long = qty - short_qty
                                    margin_refund = (entry_price * covered_qty) / pos_lev
                                    realized_pnl = (entry_price - fill_price) * covered_qty
                                    pnl_pct = (realized_pnl / margin_refund * 100) if margin_refund > 0 else 0.0

                                    cursor.execute("UPDATE users SET virtual_cash = virtual_cash + ? WHERE id = ?", (margin_refund + realized_pnl, user_id))
                                    cursor.execute("UPDATE positions SET quantity = ?, avg_entry_price = ?, leverage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_long, fill_price, lev, pos["id"]))
                                    cursor.execute(
                                        "INSERT INTO transactions (user_id, order_id, symbol, asset_class, side, quantity, price, entry_price, leverage, realized_pnl, pnl_percent) VALUES (?, ?, ?, ?, 'BUY', ?, ?, ?, ?, ?, ?)",
                                        (user_id, order_id, symbol, asset_class, covered_qty, fill_price, entry_price, pos_lev, realized_pnl, pnl_pct)
                                    )

                        else:
                            # SELL Limit Fill
                            reserved_margin = (limit_p * qty) / lev
                            cursor.execute("UPDATE users SET virtual_cash = virtual_cash + ? WHERE id = ?", (reserved_margin, user_id))

                            if pos and pos["quantity"] > 0:
                                long_qty = pos["quantity"]
                                entry_price = pos["avg_entry_price"]
                                pos_lev = pos["leverage"] if "leverage" in pos.keys() and pos["leverage"] else 1.0

                                if qty <= long_qty:
                                    margin_refund = (entry_price * qty) / pos_lev
                                    realized_pnl = (fill_price - entry_price) * qty
                                    pnl_pct = (realized_pnl / margin_refund * 100) if margin_refund > 0 else 0.0
                                    cash_refund = margin_refund + realized_pnl
                                    cursor.execute("UPDATE users SET virtual_cash = virtual_cash + ? WHERE id = ?", (cash_refund, user_id))

                                    rem = long_qty - qty
                                    if rem <= 1e-7:
                                        cursor.execute("DELETE FROM positions WHERE id = ?", (pos["id"],))
                                    else:
                                        cursor.execute("UPDATE positions SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (rem, pos["id"]))
                                    cursor.execute("INSERT INTO transactions (user_id, order_id, symbol, asset_class, side, quantity, price, entry_price, leverage, realized_pnl, pnl_percent) VALUES (?, ?, ?, ?, 'SELL', ?, ?, ?, ?, ?, ?)", (user_id, order_id, symbol, asset_class, qty, fill_price, entry_price, pos_lev, realized_pnl, pnl_pct))
                                else:
                                    closed_qty = long_qty
                                    new_short = qty - long_qty
                                    margin_refund = (entry_price * closed_qty) / pos_lev
                                    realized_pnl = (fill_price - entry_price) * closed_qty
                                    pnl_pct = (realized_pnl / margin_refund * 100) if margin_refund > 0 else 0.0
                                    new_short_margin = (fill_price * new_short) / lev
                                    net_change = (margin_refund + realized_pnl) - new_short_margin
                                    cursor.execute("UPDATE users SET virtual_cash = virtual_cash + ? WHERE id = ?", (net_change, user_id))

                                    cursor.execute("UPDATE positions SET quantity = ?, avg_entry_price = ?, leverage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (-new_short, fill_price, lev, pos["id"]))
                                    cursor.execute("INSERT INTO transactions (user_id, order_id, symbol, asset_class, side, quantity, price, entry_price, leverage, realized_pnl, pnl_percent) VALUES (?, ?, ?, ?, 'SELL', ?, ?, ?, ?, ?, ?)", (user_id, order_id, symbol, asset_class, closed_qty, fill_price, entry_price, pos_lev, realized_pnl, pnl_pct))
                            else:
                                # Short sell limit fill
                                new_short_margin = (fill_price * qty) / lev
                                cursor.execute("UPDATE users SET virtual_cash = virtual_cash - ? WHERE id = ?", (new_short_margin, user_id))
                                if not pos:
                                    cursor.execute("INSERT INTO positions (user_id, symbol, asset_class, quantity, avg_entry_price, leverage) VALUES (?, ?, ?, ?, ?, ?)", (user_id, symbol, asset_class, -qty, fill_price, lev))
                                else:
                                    old_short = abs(pos["quantity"])
                                    old_avg = pos["avg_entry_price"]
                                    old_lev = pos["leverage"] if "leverage" in pos.keys() and pos["leverage"] else 1.0
                                    comb_short = old_short + qty
                                    comb_avg = ((old_short * old_avg) + (qty * fill_price)) / comb_short
                                    old_m = (old_short * old_avg) / old_lev
                                    comb_m = old_m + new_short_margin
                                    comb_lev = ((comb_short * comb_avg) / comb_m) if comb_m > 0 else 1.0
                                    cursor.execute("UPDATE positions SET quantity = ?, avg_entry_price = ?, leverage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (-comb_short, comb_avg, comb_lev, pos["id"]))
                                cursor.execute("INSERT INTO transactions (user_id, order_id, symbol, asset_class, side, quantity, price, entry_price, leverage, realized_pnl, pnl_percent) VALUES (?, ?, ?, ?, 'SELL', ?, ?, ?, ?, 0.0, 0.0)", (user_id, order_id, symbol, asset_class, qty, fill_price, fill_price, lev))

                        cursor.execute("""
                            UPDATE orders
                            SET status = 'FILLED', filled_price = ?, filled_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        """, (fill_price, order_id))
                        logger.info(f"Limit order #{order_id} FILLED for {symbol}: {side} {qty} @ ${fill_price}")
        except Exception as e:
            logger.error(f"Error checking limit orders for {symbol}: {e}")

    def get_portfolio(self, user_id: int) -> Dict[str, Any]:
        """
        Compute real-time portfolio metrics, active open positions (LONG & SHORT with proper margins),
        and Zerodha-style today's closed positions (retained until US Eastern Time day-end).
        Automatically settles expired option contracts, unlocking margin and crediting P&L.
        """
        try:
            from backend.services.option_settlement import settle_expired_options
            settle_expired_options(user_id)
        except Exception as settle_err:
            logger.debug(f"Option expiry settlement check: {settle_err}")

        with get_db() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT virtual_cash FROM users WHERE id = ?", (user_id,))
            u = cursor.fetchone()
            if not u:
                raise ValueError("User not found.")
            cash = u["virtual_cash"]

            # 1. Open active positions (both LONG and SHORT)
            cursor.execute("SELECT * FROM positions WHERE user_id = ? AND quantity != 0", (user_id,))
            pos_rows = cursor.fetchall()

            positions = []
            total_market_value = 0.0
            total_margin_invested = 0.0
            total_unrealized_pnl = 0.0

            for p in pos_rows:
                sym = p["symbol"]
                qty = p["quantity"]
                avg_entry = p["avg_entry_price"]
                p_cat = p["asset_class"]
                is_opt = is_option_asset(sym, p_cat)
                pos_lev = p["leverage"] if "leverage" in p.keys() and p["leverage"] else (0.1 if (is_opt and qty < 0) else 1.0)
                ticker = data_hub.tickers.get(sym, {})
                current_price = ticker.get("price", avg_entry)
                is_short = qty < 0
                abs_qty = abs(qty)

                nominal_val = abs_qty * current_price
                margin_inv = (abs_qty * avg_entry) / pos_lev

                if is_short:
                    mkt_val = -nominal_val  # liability
                    unrealized_pnl = (avg_entry - current_price) * abs_qty  # profit if price drops
                    unrealized_pct = (unrealized_pnl / margin_inv * 100) if margin_inv > 0 else 0.0
                    pos_side = "SHORT"
                else:
                    mkt_val = nominal_val
                    unrealized_pnl = (current_price - avg_entry) * abs_qty
                    unrealized_pct = (unrealized_pnl / margin_inv * 100) if margin_inv > 0 else 0.0
                    pos_side = "LONG"

                total_market_value += abs_qty * current_price
                total_margin_invested += margin_inv
                total_unrealized_pnl += unrealized_pnl

                positions.append({
                    "id": p["id"],
                    "symbol": sym,
                    "name": ticker.get("name", sym),
                    "assetClass": p["asset_class"],
                    "isOption": is_opt,
                    "isOptionWriting": is_opt and is_short,
                    "side": pos_side,
                    "quantity": qty,
                    "absQuantity": abs_qty,
                    "avgEntryPrice": round(avg_entry, 4 if avg_entry < 5 else 2),
                    "currentPrice": current_price,
                    "nominalValue": round(nominal_val, 2),
                    "marketValue": round(mkt_val, 2),
                    "leverage": pos_lev,
                    "marginInvested": round(margin_inv, 2),
                    "unrealizedPnl": round(unrealized_pnl, 2),
                    "unrealizedPnlPercent": round(unrealized_pct, 2),
                    "status": "OPEN",
                    "isClosed": False
                })

            # 2. Closed positions executed TODAY (US Eastern Time) - Zerodha Kite Signature
            today_start_utc = get_us_eastern_today_start_utc()
            cursor.execute("""
                SELECT symbol, asset_class, side,
                       SUM(quantity) as closed_qty,
                       AVG(entry_price) as avg_entry_price,
                       AVG(price) as exit_price,
                       AVG(leverage) as avg_leverage,
                       SUM(realized_pnl) as realized_pnl,
                       MAX(timestamp) as closed_at
                FROM transactions
                WHERE user_id = ? AND realized_pnl != 0.0 AND timestamp >= ?
                GROUP BY symbol, asset_class, side
                ORDER BY closed_at DESC
            """, (user_id, today_start_utc))
            closed_rows = cursor.fetchall()

            closed_positions_today = []
            realized_pnl_today = 0.0

            for cr in closed_rows:
                sym = cr["symbol"]
                c_qty = cr["closed_qty"]
                c_entry = cr["avg_entry_price"] or 0.0
                c_exit = cr["exit_price"] or 0.0
                c_pnl = cr["realized_pnl"] or 0.0
                c_side = cr["side"]
                c_cat = cr["asset_class"]
                c_is_opt = is_option_asset(sym, c_cat)
                c_lev = cr["avg_leverage"] or (0.1 if (c_is_opt and c_side == "SELL") else 1.0)
                realized_pnl_today += c_pnl

                c_margin = (c_entry * c_qty) / c_lev if c_lev > 0 else (c_entry * c_qty)
                c_pnl_pct = (c_pnl / c_margin * 100) if c_margin > 0 else 0.0
                ticker = data_hub.tickers.get(sym, {})

                closed_positions_today.append({
                    "id": f"closed-{sym}-{cr['closed_at']}",
                    "symbol": sym,
                    "name": ticker.get("name", sym),
                    "assetClass": c_cat,
                    "isOption": c_is_opt,
                    "isOptionWriting": c_is_opt and (c_lev == 0.1 or c_side == "BUY"),
                    "side": "SHORT_COVER" if c_side == "BUY" else "LONG_EXIT",
                    "quantity": 0,
                    "closedQuantity": c_qty,
                    "avgEntryPrice": round(c_entry, 4 if c_entry < 5 else 2),
                    "exitPrice": round(c_exit, 4 if c_exit < 5 else 2),
                    "currentPrice": ticker.get("price", c_exit),
                    "leverage": round(c_lev, 2),
                    "marketValue": 0.0,
                    "realizedPnl": round(c_pnl, 2),
                    "realizedPnlPercent": round(c_pnl_pct, 2),
                    "closedAt": cr["closed_at"],
                    "status": "CLOSED",
                    "isClosed": True
                })

            # 3. All-time total realized P&L
            cursor.execute("SELECT COALESCE(SUM(realized_pnl), 0.0) as total_realized FROM transactions WHERE user_id = ?", (user_id,))
            total_realized = cursor.fetchone()["total_realized"]

            # Exact Total Equity = Cash + Margin Invested + Unrealized P&L
            total_equity = cash + total_margin_invested + total_unrealized_pnl
            net_pnl = total_equity - INITIAL_VIRTUAL_CASH
            net_return_pct = (net_pnl / INITIAL_VIRTUAL_CASH) * 100
            day_pnl = total_unrealized_pnl + realized_pnl_today

            return {
                "cash": round(cash, 2),
                "marginInvested": round(total_margin_invested, 2),
                "marketValue": round(total_market_value, 2),
                "totalEquity": round(total_equity, 2),
                "unrealizedPnl": round(total_unrealized_pnl, 2),
                "realizedPnl": round(total_realized, 2),
                "realizedPnlToday": round(realized_pnl_today, 2),
                "dayPnl": round(day_pnl, 2),
                "netPnl": round(net_pnl, 2),
                "netReturnPercent": round(net_return_pct, 2),
                "positions": positions,
                "closedPositionsToday": closed_positions_today,
                "allPositionsToday": positions + closed_positions_today
            }

    def get_pnl_report(
        self,
        user_id: int,
        timeframe: str = "1y",
        asset_class: str = "all",
        start_date: str = None,
        end_date: str = None
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive Zerodha Console-style 1-Year P&L Statement and analytics report.
        """
        now = datetime.now(timezone.utc)

        # Calculate time cutoff
        if timeframe == "7d":
            cutoff = now - timedelta(days=7)
        elif timeframe == "30d":
            cutoff = now - timedelta(days=30)
        elif timeframe == "90d":
            cutoff = now - timedelta(days=90)
        elif timeframe == "1y":
            cutoff = now - timedelta(days=365)
        elif timeframe == "all":
            cutoff = datetime(2020, 1, 1, tzinfo=timezone.utc)
        else:
            cutoff = now - timedelta(days=365)

        cutoff_str = cutoff.strftime("%Y-%m-%d %H:%M:%S")

        with get_db() as conn:
            cursor = conn.cursor()

            query = """
                SELECT t.*, u.display_name
                FROM transactions t
                JOIN users u ON u.id = t.user_id
                WHERE t.user_id = ? AND t.realized_pnl != 0.0
            """
            params = [user_id]

            if start_date and end_date:
                query += " AND t.timestamp BETWEEN ? AND ?"
                params.extend([f"{start_date} 00:00:00", f"{end_date} 23:59:59"])
            else:
                query += " AND t.timestamp >= ?"
                params.append(cutoff_str)

            if asset_class and asset_class.lower() != "all":
                query += " AND LOWER(t.asset_class) = ?"
                params.append(asset_class.lower())

            query += " ORDER BY t.timestamp DESC"

            cursor.execute(query, params)
            rows = cursor.fetchall()

            trades = []
            total_realized_pnl = 0.0
            winning_trades = 0
            losing_trades = 0
            breakeven_trades = 0
            total_profit = 0.0
            total_loss = 0.0
            max_win = 0.0
            max_loss = 0.0

            daily_map = {}

            for r in rows:
                pnl = r["realized_pnl"] or 0.0
                pnl_pct = r["pnl_percent"] or 0.0
                entry_p = r["entry_price"] or 0.0
                exit_p = r["price"] or 0.0
                qty = r["quantity"] or 0.0
                sym = r["symbol"]
                cat = r["asset_class"]
                lev = r["leverage"] if "leverage" in r.keys() and r["leverage"] else 1.0
                ts = r["timestamp"]

                total_realized_pnl += pnl

                if pnl > 0:
                    winning_trades += 1
                    total_profit += pnl
                    if pnl > max_win:
                        max_win = pnl
                elif pnl < 0:
                    losing_trades += 1
                    abs_loss = abs(pnl)
                    total_loss += abs_loss
                    if pnl < max_loss:
                        max_loss = pnl
                else:
                    breakeven_trades += 1

                # Daily aggregation (YYYY-MM-DD)
                day_key = ts.split(" ")[0] if " " in ts else ts[:10]
                if day_key not in daily_map:
                    daily_map[day_key] = {
                        "date": day_key,
                        "realizedPnl": 0.0,
                        "tradeCount": 0,
                        "winCount": 0,
                        "lossCount": 0
                    }
                daily_map[day_key]["realizedPnl"] += pnl
                daily_map[day_key]["tradeCount"] += 1
                if pnl > 0:
                    daily_map[day_key]["winCount"] += 1
                elif pnl < 0:
                    daily_map[day_key]["lossCount"] += 1

                ticker = data_hub.tickers.get(sym, {})
                trades.append({
                    "id": r["id"],
                    "symbol": sym,
                    "name": ticker.get("name", sym),
                    "assetClass": cat,
                    "quantity": qty,
                    "leverage": lev,
                    "entryPrice": round(entry_p, 4 if entry_p < 5 else 2),
                    "exitPrice": round(exit_p, 4 if exit_p < 5 else 2),
                    "realizedPnl": round(pnl, 2),
                    "realizedPnlPercent": round(pnl_pct, 2),
                    "closedAt": ts
                })

            total_trades = len(trades)
            win_rate = round((winning_trades / total_trades * 100), 2) if total_trades > 0 else 0.0
            profit_factor = round(total_profit / total_loss, 2) if total_loss > 0 else (round(total_profit, 2) if total_profit > 0 else 1.0)
            avg_profit = round(total_profit / winning_trades, 2) if winning_trades > 0 else 0.0
            avg_loss = round(total_loss / losing_trades, 2) if losing_trades > 0 else 0.0

            # Sort daily timeline ascending by date
            daily_pnl = sorted(list(daily_map.values()), key=lambda x: x["date"])
            for d in daily_pnl:
                d["realizedPnl"] = round(d["realizedPnl"], 2)

            return {
                "timeframe": timeframe,
                "assetClass": asset_class,
                "summary": {
                    "realizedPnl": round(total_realized_pnl, 2),
                    "charges": 0.00,
                    "netRealizedPnl": round(total_realized_pnl, 2),
                    "totalTrades": total_trades,
                    "winningTrades": winning_trades,
                    "losingTrades": losing_trades,
                    "breakevenTrades": breakeven_trades,
                    "winRatePercent": win_rate,
                    "profitFactor": profit_factor,
                    "totalProfit": round(total_profit, 2),
                    "totalLoss": round(total_loss, 2),
                    "avgProfit": avg_profit,
                    "avgLoss": avg_loss,
                    "maxWin": round(max_win, 2),
                    "maxLoss": round(max_loss, 2),
                },
                "dailyPnl": daily_pnl,
                "trades": trades
            }

    def reset_portfolio(self, user_id: int) -> Dict[str, Any]:
        """Reset virtual balance to initial $100,000 and clear all positions and orders."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET virtual_cash = ? WHERE id = ?", (INITIAL_VIRTUAL_CASH, user_id))
            cursor.execute("DELETE FROM positions WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM orders WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM transactions WHERE user_id = ?", (user_id,))
            self._invalidate_cache(user_id)
            return {
                "success": True,
                "message": f"Portfolio successfully reset to ${INITIAL_VIRTUAL_CASH:,.2f}.",
                "cash": INITIAL_VIRTUAL_CASH
            }


order_engine = OrderEngine()
