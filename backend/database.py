"""
Database layer for ZeroTrade.
Manages connection and schema initialization using SQLite (and supports Postgres via standard drivers).
"""
import sqlite3
import os
import random
import time
from datetime import datetime, timedelta, timezone
from contextlib import contextmanager
from typing import Generator
from backend.config import SQLITE_DB_PATH, INITIAL_VIRTUAL_CASH
from backend.security import hash_password


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Provide a transactional scope around a series of operations."""
    conn = sqlite3.connect(SQLITE_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for concurrent reads & writes
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create all required database tables, migrations, and seed data."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Users table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            virtual_cash REAL NOT NULL DEFAULT 10000.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Positions table (supports leverage up to 20x)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS positions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            asset_class TEXT NOT NULL,
            quantity REAL NOT NULL,
            avg_entry_price REAL NOT NULL,
            leverage REAL NOT NULL DEFAULT 1.0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, symbol)
        );
        """)

        # Orders table (Supports Market & Limit with Leverage)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            asset_class TEXT NOT NULL,
            side TEXT NOT NULL,            -- BUY | SELL
            order_type TEXT NOT NULL,      -- MARKET | LIMIT
            quantity REAL NOT NULL,
            limit_price REAL,
            leverage REAL NOT NULL DEFAULT 1.0,
            status TEXT NOT NULL,          -- PENDING | FILLED | CANCELLED | REJECTED
            filled_price REAL,
            filled_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)

        # Trade transactions / audit log with entry price, exit price, leverage and PnL metrics
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            order_id INTEGER,
            symbol TEXT NOT NULL,
            asset_class TEXT NOT NULL,
            side TEXT NOT NULL,
            quantity REAL NOT NULL,
            price REAL NOT NULL,
            entry_price REAL DEFAULT 0.0,
            leverage REAL NOT NULL DEFAULT 1.0,
            realized_pnl REAL DEFAULT 0.0,
            pnl_percent REAL DEFAULT 0.0,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)

        # Safe column migrations for existing SQLite databases
        for tbl, col, col_def in [
            ("positions", "leverage", "REAL DEFAULT 1.0"),
            ("orders", "leverage", "REAL DEFAULT 1.0"),
            ("transactions", "leverage", "REAL DEFAULT 1.0"),
            ("transactions", "entry_price", "REAL DEFAULT 0.0"),
            ("transactions", "pnl_percent", "REAL DEFAULT 0.0"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} {col_def}")
            except Exception:
                pass

        # Price alerts
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS price_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            target_price REAL NOT NULL,
            condition TEXT NOT NULL,       -- ABOVE | BELOW
            triggered INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)

        # UPI Payment & Plan Orders
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS payment_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            plan_id TEXT NOT NULL,
            plan_name TEXT NOT NULL,
            amount_inr REAL NOT NULL,
            virtual_cash_granted REAL NOT NULL DEFAULT 0.0,
            upi_id TEXT NOT NULL,
            utr_ref TEXT,
            status TEXT NOT NULL DEFAULT 'completed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)

        # Custom user watchlists
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS watchlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            asset_class TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, symbol)
        );
        """)

        # Seed initial demo trader user if none exists
        cursor.execute("SELECT id FROM users WHERE email = 'demo@zeroboss.trade'")
        demo_user = cursor.fetchone()
        if not demo_user:
            default_pw_hash = hash_password("zerotrade123")
            cursor.execute("""
            INSERT INTO users (email, password_hash, display_name, virtual_cash)
            VALUES (?, ?, ?, ?)
            """, ("demo@zeroboss.trade", default_pw_hash, "ZeroBoss Trader", INITIAL_VIRTUAL_CASH))
            demo_user_id = cursor.lastrowid
        else:
            demo_user_id = demo_user["id"]

        # Seed initial leaderboard profiles to make ranking vibrant
        mock_traders = [
            ("apex_scalper@zeroboss.trade", "ApexScalper", 142850.00),
            ("crypto_whale@zeroboss.trade", "CryptoWhale99", 128400.00),
            ("quant_fund@zeroboss.trade", "QuantNova", 115200.00),
            ("fx_swing@zeroboss.trade", "FX_Maverick", 109800.00),
            ("steady_bull@zeroboss.trade", "SteadyBull", 98400.00),
        ]
        for email, name, cash in mock_traders:
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            if not cursor.fetchone():
                cursor.execute("""
                INSERT INTO users (email, password_hash, display_name, virtual_cash)
                VALUES (?, ?, ?, ?)
                """, (email, hash_password("traderdemo"), name, cash))

        # Note: No fake mock trades are seeded. Users start with 100% genuine transaction history.
        pass


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
