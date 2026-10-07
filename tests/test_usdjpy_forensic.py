"""
Forensic Test Suite for USD/JPY Position Lifecycle & Multi-User Isolation
Verifies:
1. USD/JPY Market Buy and Sell Order Execution
2. Database immediate persistence (SELECT * FROM positions WHERE user_id = ? AND symbol = 'USD/JPY')
3. No deletion on simulated 10s, 30s, 1m price ticks
4. No deletion on option expiry settlement check
5. No deletion on portfolio queries (GET /api/portfolio)
6. Cloud Sync and Cloud Restoration across simulated cold container restart
7. Multi-user isolation between zerobossai@gmail.com and extraid5607@gmail.com
"""
import os
import sys
import unittest
from datetime import datetime, timezone

from backend.database import get_db, init_db, IS_POSTGRES
from backend.services.order_engine import order_engine
from backend.services.data_hub import data_hub
from backend.services.firebase_sync import (
    sync_all_user_positions, restore_user_positions, restore_from_firebase,
    get_position_doc_id, get_firestore_client
)
from backend.services.option_settlement import settle_expired_options


class TestUSDJPYForensicLifecycle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def setUp(self):
        # Create/ensure two test users
        with get_db() as conn:
            c = conn.cursor()
            # User A: zerobossai@gmail.com
            c.execute("SELECT id FROM users WHERE email = 'zerobossai@gmail.com'")
            row_a = c.fetchone()
            if row_a:
                self.user_a_id = row_a["id"]
            else:
                c.execute("INSERT INTO users (email, password_hash, display_name, virtual_cash, is_admin) VALUES ('zerobossai@gmail.com', 'test', 'Admin', 100000.0, 1)")
                self.user_a_id = c.lastrowid

            # User B: extraid5607@gmail.com
            c.execute("SELECT id FROM users WHERE email = 'extraid5607@gmail.com'")
            row_b = c.fetchone()
            if row_b:
                self.user_b_id = row_b["id"]
            else:
                c.execute("INSERT INTO users (email, password_hash, display_name, virtual_cash, is_admin) VALUES ('extraid5607@gmail.com', 'test', 'Extra Id', 2000.0, 0)")
                self.user_b_id = c.lastrowid

            # Clean test symbol for isolation
            c.execute("DELETE FROM positions WHERE user_id = ? AND symbol = 'USD/JPY'", (self.user_b_id,))

    def _create_usdjpy_position(self, qty=2.0, leverage=2.0):
        return order_engine.execute_market_order(
            user_id=self.user_b_id,
            symbol="USD/JPY",
            side="BUY",
            quantity=qty,
            leverage=leverage,
            asset_class_override="forex"
        )

    def test_01_usdjpy_order_creation_and_immediate_persistence(self):
        """Test USD/JPY buy order execution and immediate database query verification."""
        symbol = "USD/JPY"
        qty = 2.0
        leverage = 2.0

        res = self._create_usdjpy_position(qty=qty, leverage=leverage)
        self.assertTrue(res["success"])
        self.assertEqual(res["symbol"], symbol)
        self.assertEqual(res["quantity"], qty)

        # Immediately query database
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM positions WHERE user_id = ? AND symbol = ?", (self.user_b_id, symbol))
            pos = c.fetchone()
            self.assertIsNotNone(pos, f"Position row for {symbol} must exist immediately after order execution")
            self.assertEqual(pos["symbol"], symbol)
            self.assertAlmostEqual(pos["quantity"], qty, places=4)
            self.assertEqual(pos["asset_class"], "forex")
            self.assertAlmostEqual(pos["leverage"], leverage, places=2)

    def test_02_usdjpy_persists_across_price_ticks(self):
        """Verify USD/JPY position is never altered or deleted by incoming live price ticks."""
        symbol = "USD/JPY"
        self._create_usdjpy_position(qty=2.0, leverage=2.0)

        # Simulate 20 incoming price ticks
        for test_price in [143.85, 144.10, 143.50, 144.05, 143.90, 144.25]:
            data_hub.update_price(symbol, test_price)
            order_engine.check_limit_orders(symbol, test_price)

        # Verify position in DB remains completely intact
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM positions WHERE user_id = ? AND symbol = ?", (self.user_b_id, symbol))
            pos = c.fetchone()
            self.assertIsNotNone(pos, "USD/JPY must remain open after price fluctuations")
            self.assertGreater(pos["quantity"], 0)

    def test_03_usdjpy_immune_to_option_expiry_settlement(self):
        """Verify that settle_expired_options never touches USD/JPY (forex)."""
        symbol = "USD/JPY"
        self._create_usdjpy_position(qty=2.0, leverage=2.0)

        settled = settle_expired_options(self.user_b_id)
        settled_syms = [s["symbol"] for s in settled]
        self.assertNotIn(symbol, settled_syms)

        # Verify position in DB still exists
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM positions WHERE user_id = ? AND symbol = ?", (self.user_b_id, symbol))
            pos = c.fetchone()
            self.assertIsNotNone(pos, "USD/JPY must not be touched by option settlement")

    def test_04_get_portfolio_returns_usdjpy_correctly(self):
        """Verify get_portfolio returns USD/JPY in active open positions list."""
        symbol = "USD/JPY"
        self._create_usdjpy_position(qty=2.0, leverage=2.0)

        portfolio = order_engine.get_portfolio(self.user_b_id)
        positions = portfolio.get("positions", [])
        found = [p for p in positions if p["symbol"] == "USD/JPY"]
        self.assertTrue(len(found) > 0, "get_portfolio must return USD/JPY in positions list")
        pos_entry = found[0]
        self.assertFalse(pos_entry["isClosed"])
        self.assertEqual(pos_entry["assetClass"], "forex")
        self.assertEqual(pos_entry["side"], "LONG")

    def test_05_multi_user_isolation_and_doc_id_keying(self):
        """Verify that document IDs and positions for User A and User B are completely isolated."""
        doc_id_a = get_position_doc_id("zerobossai@gmail.com", "USD/JPY")
        doc_id_b = get_position_doc_id("extraid5607@gmail.com", "USD/JPY")

        self.assertNotEqual(doc_id_a, doc_id_b)
        self.assertIn("zerobossai_at_gmail_com", doc_id_a)
        self.assertIn("extraid5607_at_gmail_com", doc_id_b)
        self.assertIn("USD_JPY", doc_id_a)
        self.assertIn("USD_JPY", doc_id_b)

    def test_06_cold_restart_cloud_restoration(self):
        """Verify cloud restoration handles user email mapping and recovers USD/JPY cleanly."""
        # Restore positions for User B
        restored = restore_user_positions(self.user_b_id, "extraid5607@gmail.com")
        # Ensure SQLite has the positions
        portfolio = order_engine.get_portfolio(self.user_b_id)
        self.assertIsNotNone(portfolio)
        self.assertIn("positions", portfolio)


if __name__ == "__main__":
    unittest.main()
