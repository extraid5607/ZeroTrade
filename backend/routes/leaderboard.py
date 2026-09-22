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

            # Calculate open positions value
            cursor.execute("SELECT symbol, quantity FROM positions WHERE user_id = ?", (uid,))
            positions = cursor.fetchall()
            mkt_val = 0.0
            for p in positions:
                cur_price = data_hub.tickers.get(p["symbol"], {}).get("price", 0.0)
                mkt_val += p["quantity"] * cur_price

            total_equity = cash + mkt_val
            net_return_pct = ((total_equity - INITIAL_VIRTUAL_CASH) / INITIAL_VIRTUAL_CASH) * 100

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
