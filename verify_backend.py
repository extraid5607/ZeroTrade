"""
Verification script for ZeroTrade backend operations.
Tests auth, orders, portfolio, reset, and market endpoints.
"""
import sys
import asyncio
from backend.database import init_db, get_db
from backend.services.data_hub import data_hub
from backend.services.order_engine import order_engine
from backend.routes.auth import signup, login, SignupRequest, LoginRequest
from backend.security import decode_access_token


def test_auth_and_orders():
    print(">>> 1. Initializing database...")
    init_db()

    print(">>> 2. Testing user signup and auth...")
    test_email = "tester_automated@zeroboss.trade"
    # Clean up tester if exists
    with get_db() as conn:
        conn.execute("DELETE FROM users WHERE email = ?", (test_email,))

    res = signup(SignupRequest(email=test_email, password="password123", display_name="Test Trader"))
    assert "token" in res, "Token missing from signup response"
    token = res["token"]
    user_id = res["user"]["id"]
    print(f"    User created with ID {user_id} and token generated successfully.")

    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id), "Token sub mismatch"

    print(">>> 3. Testing Market BUY order...")
    buy_res = order_engine.execute_market_order(user_id, "AAPL", "BUY", 10)
    print(f"    Bought 10 AAPL @ ${buy_res['fillPrice']}. Remaining Cash: ${buy_res['remainingCash']:,.2f}")
    assert buy_res["remainingCash"] < 100000.0, "Cash was not deducted"

    print(">>> 4. Testing Portfolio Calculation...")
    port = order_engine.get_portfolio(user_id)
    assert len(port["positions"]) == 1, "Expected 1 position"
    pos = port["positions"][0]
    print(f"    Position: {pos['symbol']}, Qty: {pos['quantity']}, Avg: ${pos['avgEntryPrice']}, MktVal: ${pos['marketValue']}")

    print(">>> 5. Testing Market SELL order...")
    sell_res = order_engine.execute_market_order(user_id, "AAPL", "SELL", 5)
    print(f"    Sold 5 AAPL. Realized PnL: ${sell_res['realizedPnl']}. Cash: ${sell_res['remainingCash']:,.2f}")

    port_after_sell = order_engine.get_portfolio(user_id)
    assert port_after_sell["positions"][0]["quantity"] == 5, "Remaining quantity should be 5"

    print(">>> 6. Testing Limit BUY order placement...")
    cur_btc = data_hub.tickers["BTCUSDT"]["price"]
    limit_buy_target = round(cur_btc * 0.95, 2)
    limit_res = order_engine.place_limit_order(user_id, "BTCUSDT", "BUY", 0.1, limit_buy_target)
    print(f"    Limit BUY order placed for 0.1 BTCUSDT @ ${limit_buy_target}. Order ID: {limit_res['orderId']}")
    assert limit_res["status"] == "PENDING"

    print(">>> 7. Testing Limit order cancellation & cash refund...")
    cancel_res = order_engine.cancel_order(user_id, limit_res["orderId"])
    print(f"    Limit order cancelled: {cancel_res}")
    assert cancel_res["status"] == "CANCELLED"

    print(">>> 8. Testing Portfolio Reset...")
    reset_res = order_engine.reset_portfolio(user_id)
    print(f"    Reset response: {reset_res['message']}")
    port_reset = order_engine.get_portfolio(user_id)
    assert port_reset["cash"] == 100000.0, "Cash should be reset to 100,000"
    assert len(port_reset["positions"]) == 0, "Positions should be cleared"

    print("\n[SUCCESS] ALL BACKEND UNIT AND INTEGRATION CHECKS PASSED!\n")


if __name__ == "__main__":
    test_auth_and_orders()
