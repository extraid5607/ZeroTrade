"""
Comprehensive Automated Test Suite for ZeroTrade Position Integrity & Safety.
Tests 1 to 12 as defined in the requirements specification.
"""
import sys
import os
import time
import threading
from pathlib import Path

# Ensure project root is in path
sys.path.insert(0, os.path.abspath("."))

from backend.database import init_db, get_db
from backend.services.order_engine import order_engine
from backend.services.data_hub import data_hub
from backend.services.option_settlement import settle_expired_options
import backend.services.firebase_sync as fb_sync

def setup_test_environment():
    print("Initializing test environment...")
    init_db()
    with get_db() as conn:
        c = conn.cursor()
        # Seed test user
        c.execute("SELECT id FROM users WHERE email = 'test_trader@gmail.com'")
        row = c.fetchone()
        if not row:
            c.execute("""
                INSERT INTO users (email, password_hash, display_name, virtual_cash, is_admin, plan_id, plan_name, max_leverage)
                VALUES ('test_trader@gmail.com', 'hash', 'Test Trader', 50000.0, 0, 'elite', 'Elite', 20.0)
            """)
            c.execute("SELECT id FROM users WHERE email = 'test_trader@gmail.com'")
            user_id = c.fetchone()["id"]
        else:
            user_id = row["id"]
            c.execute("UPDATE users SET virtual_cash = 50000.0 WHERE id = ?", (user_id,))
            c.execute("DELETE FROM positions WHERE user_id = ?", (user_id,))
            c.execute("DELETE FROM orders WHERE user_id = ?", (user_id,))
            c.execute("DELETE FROM transactions WHERE user_id = ?", (user_id,))

        # Set fake live prices in data_hub
        data_hub.tickers["BTCUSDT"] = {"symbol": "BTCUSDT", "price": 85000.0, "category": "crypto"}
        data_hub.tickers["ETHUSDT"] = {"symbol": "ETHUSDT", "price": 2800.0, "category": "crypto"}
        data_hub.tickers["SPY"] = {"symbol": "SPY", "price": 580.0, "category": "stock"}
        data_hub.tickers["SPX 6000 CE"] = {"symbol": "SPX 6000 CE", "price": 25.0, "category": "options"}

        return user_id

def run_all_tests():
    user_id = setup_test_environment()
    results = {}

    print(f"\nRunning tests with test user ID: {user_id}\n")

    # ----------------------------------------------------
    # TEST 1: Open BTC long position. Wait / refresh portfolio multiple times. Position must remain.
    # ----------------------------------------------------
    try:
        res = order_engine.execute_market_order(user_id, "BTCUSDT", "BUY", 1.0, leverage=5.0)
        assert res["success"] is True
        for _ in range(5):
            port = order_engine.get_portfolio(user_id)
            btc_pos = next((p for p in port["positions"] if p["symbol"] == "BTCUSDT"), None)
            assert btc_pos is not None, "BTC position disappeared during portfolio refresh!"
            assert btc_pos["quantity"] == 1.0
        results["TEST 1: Long BTC survives multiple refreshes"] = "PASS"
    except Exception as e:
        results["TEST 1: Long BTC survives multiple refreshes"] = f"FAIL ({e})"

    # ----------------------------------------------------
    # TEST 2: Open ETH short position. Refresh repeatedly. Position must remain.
    # ----------------------------------------------------
    try:
        res = order_engine.execute_market_order(user_id, "ETHUSDT", "SELL", 5.0, leverage=5.0)
        assert res["success"] is True
        for _ in range(5):
            port = order_engine.get_portfolio(user_id)
            eth_pos = next((p for p in port["positions"] if p["symbol"] == "ETHUSDT"), None)
            assert eth_pos is not None, "ETH short position disappeared during portfolio refresh!"
            assert eth_pos["quantity"] == -5.0
            assert eth_pos["side"] == "SHORT"
        results["TEST 2: Short ETH survives multiple refreshes"] = "PASS"
    except Exception as e:
        results["TEST 2: Short ETH survives multiple refreshes"] = f"FAIL ({e})"

    # ----------------------------------------------------
    # TEST 3: Open an option position with a future expiry. Refresh. Position must remain.
    # ----------------------------------------------------
    try:
        res = order_engine.execute_market_order(
            user_id, "SPX 6000 CE", "BUY", 2.0, price_override=25.0, expiry_date="2028-12-31"
        )
        assert res["success"] is True
        for _ in range(5):
            port = order_engine.get_portfolio(user_id)
            opt_pos = next((p for p in port["positions"] if p["symbol"] == "SPX 6000 CE"), None)
            assert opt_pos is not None, "Future option contract disappeared during portfolio refresh!"
            assert opt_pos["quantity"] == 2.0
        results["TEST 3: Future Option position survives refresh"] = "PASS"
    except Exception as e:
        results["TEST 3: Future Option position survives refresh"] = f"FAIL ({e})"

    # ----------------------------------------------------
    # TEST 4: Close part of BTC position. Only the closed quantity should reduce. Remaining must remain.
    # ----------------------------------------------------
    try:
        # Currently 1.0 BTC. Close 0.4 BTC
        res = order_engine.execute_market_order(user_id, "BTCUSDT", "SELL", 0.4, leverage=5.0)
        assert res["success"] is True
        port = order_engine.get_portfolio(user_id)
        btc_pos = next((p for p in port["positions"] if p["symbol"] == "BTCUSDT"), None)
        assert btc_pos is not None, "BTC completely disappeared on partial close!"
        assert abs(btc_pos["quantity"] - 0.6) < 1e-5, f"Expected 0.6 BTC, got {btc_pos['quantity']}"
        results["TEST 4: Partial close retains remaining quantity"] = "PASS"
    except Exception as e:
        results["TEST 4: Partial close retains remaining quantity"] = f"FAIL ({e})"

    # ----------------------------------------------------
    # TEST 5: Completely close BTC. Position should disappear.
    # ----------------------------------------------------
    try:
        # Close remaining 0.6 BTC
        res = order_engine.execute_market_order(user_id, "BTCUSDT", "SELL", 0.6, leverage=5.0)
        assert res["success"] is True
        port = order_engine.get_portfolio(user_id)
        btc_pos = next((p for p in port["positions"] if p["symbol"] == "BTCUSDT"), None)
        assert btc_pos is None, "BTC position still open after full close!"
        # Check closedPositionsToday
        closed_btc = next((p for p in port["closedPositionsToday"] if p["symbol"] == "BTCUSDT"), None)
        assert closed_btc is not None, "BTC missing from closedPositionsToday"
        results["TEST 5: Full close cleanly removes open position & records today's closed"] = "PASS"
    except Exception as e:
        results["TEST 5: Full close cleanly removes open position & records today's closed"] = f"FAIL ({e})"

    # ----------------------------------------------------
    # TEST 6: Restart backend / simulate server boot (init_db + restore). Position must still exist.
    # ----------------------------------------------------
    try:
        init_db()  # Simulates server startup init_db()
        port = order_engine.get_portfolio(user_id)
        eth_pos = next((p for p in port["positions"] if p["symbol"] == "ETHUSDT"), None)
        opt_pos = next((p for p in port["positions"] if p["symbol"] == "SPX 6000 CE"), None)
        assert eth_pos is not None, "ETH position deleted by init_db()!"
        assert opt_pos is not None, "SPX Option position deleted by init_db()!"
        results["TEST 6: Server boot & init_db does not delete positions"] = "PASS"
    except Exception as e:
        results["TEST 6: Server boot & init_db does not delete positions"] = f"FAIL ({e})"

    # ----------------------------------------------------
    # TEST 7: Simulate frontend load / portfolio endpoint serialization
    # ----------------------------------------------------
    try:
        port = order_engine.get_portfolio(user_id)
        assert "positions" in port and len(port["positions"]) >= 2
        assert "totalEquity" in port and port["totalEquity"] > 0
        assert "cash" in port
        results["TEST 7: Portfolio payload valid and complete"] = "PASS"
    except Exception as e:
        results["TEST 7: Portfolio payload valid and complete"] = f"FAIL ({e})"

    # ----------------------------------------------------
    # TEST 8: Temporarily make Firebase unavailable. Existing database positions must remain.
    # ----------------------------------------------------
    try:
        orig_client_fn = fb_sync.get_firestore_client
        fb_sync.get_firestore_client = lambda: None  # Simulate Firebase offline
        
        # Open a new position with Firebase offline
        res = order_engine.execute_market_order(user_id, "SPY", "BUY", 10.0, leverage=2.0)
        assert res["success"] is True
        
        port = order_engine.get_portfolio(user_id)
        spy_pos = next((p for p in port["positions"] if p["symbol"] == "SPY"), None)
        assert spy_pos is not None, "SPY position failed when Firebase offline!"
        assert spy_pos["quantity"] == 10.0

        # Restore original function
        fb_sync.get_firestore_client = orig_client_fn
        results["TEST 8: Firebase offline resilience (DB remains source of truth)"] = "PASS"
    except Exception as e:
        fb_sync.get_firestore_client = orig_client_fn
        results["TEST 8: Firebase offline resilience (DB remains source of truth)"] = f"FAIL ({e})"

    # ----------------------------------------------------
    # TEST 9: Firebase contains stale / empty data. Backend positions must remain.
    # ----------------------------------------------------
    try:
        # sync_all_user_positions with empty list must not wipe SQLite positions
        fb_sync.sync_all_user_positions(user_id, [])
        port = order_engine.get_portfolio(user_id)
        assert len(port["positions"]) >= 3, "Backend positions wiped by empty Firebase sync!"
        results["TEST 9: Empty Firebase sync cannot wipe SQLite positions"] = "PASS"
    except Exception as e:
        results["TEST 9: Empty Firebase sync cannot wipe SQLite positions"] = f"FAIL ({e})"

    # ----------------------------------------------------
    # TEST 10: Live ticker temporarily stops sending price. Position must remain.
    # ----------------------------------------------------
    try:
        del data_hub.tickers["SPY"]  # Temporarily remove SPY price feed
        port = order_engine.get_portfolio(user_id)
        spy_pos = next((p for p in port["positions"] if p["symbol"] == "SPY"), None)
        assert spy_pos is not None, "Position disappeared when ticker price was missing!"
        assert spy_pos["currentPrice"] == spy_pos["avgEntryPrice"], "Fallback price was not used!"
        
        # Restore SPY ticker
        data_hub.tickers["SPY"] = {"symbol": "SPY", "price": 580.0, "category": "stock"}
        results["TEST 10: Missing ticker uses fallback and retains position"] = "PASS"
    except Exception as e:
        data_hub.tickers["SPY"] = {"symbol": "SPY", "price": 580.0, "category": "stock"}
        results["TEST 10: Missing ticker uses fallback and retains position"] = f"FAIL ({e})"

    # ----------------------------------------------------
    # TEST 11: Run cleanup_old_accounts.py safety check. Verify genuine users/positions are protected.
    # ----------------------------------------------------
    try:
        import subprocess
        # Run without --confirm-purge
        proc = subprocess.run([sys.executable, "backend/cleanup_old_accounts.py"], capture_output=True, text=True)
        assert "[SAFETY]" in proc.stdout, "Safety guard did not trigger on cleanup_old_accounts.py!"
        
        # Run with --confirm-purge
        proc2 = subprocess.run([sys.executable, "backend/cleanup_old_accounts.py", "--confirm-purge"], capture_output=True, text=True)
        
        # Check that test_trader@gmail.com and its positions still exist!
        port = order_engine.get_portfolio(user_id)
        assert len(port["positions"]) >= 3, "cleanup_old_accounts wiped genuine user positions!"
        results["TEST 11: cleanup_old_accounts safety guard & protection of real users"] = "PASS"
    except Exception as e:
        results["TEST 11: cleanup_old_accounts safety guard & protection of real users"] = f"FAIL ({e})"

    # ----------------------------------------------------
    # TEST 12: Run multiple portfolio refreshes simultaneously (concurrency test).
    # ----------------------------------------------------
    try:
        threads = []
        errors = []
        def worker():
            try:
                for _ in range(10):
                    p = order_engine.get_portfolio(user_id)
                    if len(p["positions"]) < 3:
                        errors.append("Positions count dropped during concurrent read!")
            except Exception as ex:
                errors.append(str(ex))

        for _ in range(10):
            t = threading.Thread(target=worker)
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        assert len(errors) == 0, f"Concurrency errors encountered: {errors}"
        results["TEST 12: High concurrency portfolio reads retain all positions"] = "PASS"
    except Exception as e:
        results["TEST 12: High concurrency portfolio reads retain all positions"] = f"FAIL ({e})"

    print("\n================ TEST EXECUTION SUMMARY ================")
    all_passed = True
    for test_name, status in results.items():
        print(f"  {status} : {test_name}")
        if status != "PASS":
            all_passed = False
    print("========================================================\n")
    return all_passed

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
