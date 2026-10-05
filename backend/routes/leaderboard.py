"""
Leaderboard route for ZeroTrade.
Ranks paper traders by virtual ROI (return on investment), win rate, and total trades.
"""
from fastapi import APIRouter
from backend.database import get_db
from backend.config import INITIAL_VIRTUAL_CASH
from backend.services.data_hub import data_hub

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


@router.get("")
def get_leaderboard():
    """Retrieve top simulated traders ranking."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, display_name, virtual_cash FROM users")
        users = cursor.fetchall()

        rankings = []
        for u in users:
            uid = u["id"]
            cash = u["virtual_cash"]

            # Calculate realized P&L
            cursor.execute("SELECT COALESCE(SUM(realized_pnl), 0.0) as total_realized FROM transactions WHERE user_id = ?", (uid,))
            total_realized = cursor.fetchone()["total_realized"]

            # Calculate open positions value & unrealized PnL
            cursor.execute("SELECT symbol, quantity, avg_entry_price, leverage FROM positions WHERE user_id = ?", (uid,))
            positions = cursor.fetchall()
            mkt_val = 0.0
            unrealized_pnl = 0.0
            margin_inv = 0.0
            for p in positions:
                cur_price = data_hub.tickers.get(p["symbol"], {}).get("price", p["avg_entry_price"])
                qty = p["quantity"]
                abs_qty = abs(qty)
                mkt_val += abs_qty * cur_price
                lev = p["leverage"] or 1.0
                margin_inv += (abs_qty * p["avg_entry_price"]) / lev
                if qty < 0:
                    unrealized_pnl += (p["avg_entry_price"] - cur_price) * abs_qty
                else:
                    unrealized_pnl += (cur_price - p["avg_entry_price"]) * abs_qty

            total_equity = cash + margin_inv + unrealized_pnl
            net_pnl = total_realized + unrealized_pnl
            starting_basis = total_equity - net_pnl
            net_return_pct = (net_pnl / starting_basis * 100) if starting_basis > 0 else 0.0

            # Compute win rate & completed closed trades
            cursor.execute("""
                SELECT COUNT(*) as total_closed,
                       SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) as win_count
                FROM transactions
                WHERE user_id = ? AND side = 'SELL' AND realized_pnl != 0.0
            """, (uid,))
            stats = cursor.fetchone()
            total_closed_trades = stats["total_closed"] or 0
            win_count = stats["win_count"] or 0
            win_rate = round((win_count / total_closed_trades) * 100, 1) if total_closed_trades > 0 else 0.0

            rankings.append({
                "userId": uid,
                "displayName": u["display_name"],
                "totalEquity": round(total_equity, 2),
                "returnPercent": round(net_return_pct, 2),
                "winRate": win_rate,
                "totalTrades": total_closed_trades
            })

        # Sort by ROI descending
        rankings.sort(key=lambda x: x["returnPercent"], reverse=True)

        for i, r in enumerate(rankings):
            r["rank"] = i + 1

        return {"leaderboard": rankings[:25]}
