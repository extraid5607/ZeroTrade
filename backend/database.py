"""
Database layer for ZeroTrade.
Supports dual modes:
1. SQLite (Local development & Render Persistent Disks via SQLITE_DB_PATH)
2. PostgreSQL (Cloud Persistent Database via DATABASE_URL e.g., Render Postgres / Supabase / Neon)
"""
import os
import re
import logging
import sqlite3
from datetime import datetime, timezone
from contextlib import contextmanager
from typing import Generator, Any, Optional

from backend.config import SQLITE_DB_PATH, DATABASE_URL, INITIAL_VIRTUAL_CASH
from backend.security import hash_password

logger = logging.getLogger("zerotrade.database")

# Check if PostgreSQL is configured
IS_POSTGRES = bool(DATABASE_URL and ("postgres://" in DATABASE_URL or "postgresql://" in DATABASE_URL))

if IS_POSTGRES:
    try:
        import psycopg2
        import psycopg2.extras
        # Normalize postgres:// to postgresql:// if needed
        PG_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    except ImportError:
        logger.warning("psycopg2 not installed. Falling back to SQLite.")
        IS_POSTGRES = False


class PostgresCursorWrapper:
    """Wrapper around psycopg2 cursor to provide sqlite-like placeholder (?) and lastrowid support."""
    def __init__(self, cursor, conn):
        self._cursor = cursor
        self._conn = conn
        self.lastrowid = None

    def _convert_query(self, query: str) -> str:
        # Translate '?' placeholders to '%s' for Postgres
        return query.replace("?", "%s")

    def execute(self, query: str, params: Optional[Any] = None):
        converted_query = self._convert_query(query)
        
        # Check if INSERT without RETURNING to capture lastrowid
        is_insert = converted_query.strip().upper().startswith("INSERT INTO")
        has_returning = "RETURNING" in converted_query.upper()
        
        if is_insert and not has_returning:
            converted_query += " RETURNING id"
            if params is not None:
                self._cursor.execute(converted_query, params)
            else:
                self._cursor.execute(converted_query)
            try:
                row = self._cursor.fetchone()
                if row and "id" in row:
                    self.lastrowid = row["id"]
            except Exception:
                pass
            return self

        if params is not None:
            self._cursor.execute(converted_query, params)
        else:
            self._cursor.execute(converted_query)
        return self

    def executemany(self, query: str, params_seq):
        converted_query = self._convert_query(query)
        self._cursor.executemany(converted_query, params_seq)
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def __iter__(self):
        return iter(self._cursor)


class PostgresConnectionWrapper:
    """Wrapper around psycopg2 connection."""
    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        raw_cursor = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        return PostgresCursorWrapper(raw_cursor, self._conn)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


@contextmanager
def get_db() -> Generator[Any, None, None]:
    """Provide a transactional scope around database operations with automatic SQLite fallback."""
    global IS_POSTGRES
    if IS_POSTGRES:
        try:
            conn = psycopg2.connect(PG_URL, connect_timeout=6)
            wrapped_conn = PostgresConnectionWrapper(conn)
            try:
                yield wrapped_conn
                wrapped_conn.commit()
            except Exception:
                wrapped_conn.rollback()
                raise
            finally:
                wrapped_conn.close()
            return
        except Exception as pg_err:
            logger.warning(f"PostgreSQL connection failed ({pg_err}). Falling back to SQLite.")

    # SQLite connection (always reliable)
    conn = sqlite3.connect(SQLITE_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
    except Exception:
        pass
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

        if IS_POSTGRES:
            # PostgreSQL Schema
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name VARCHAR(255) NOT NULL,
                virtual_cash DOUBLE PRECISION NOT NULL DEFAULT 10000.00,
                is_admin INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS positions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                symbol VARCHAR(64) NOT NULL,
                asset_class VARCHAR(32) NOT NULL,
                quantity DOUBLE PRECISION NOT NULL,
                avg_entry_price DOUBLE PRECISION NOT NULL,
                leverage DOUBLE PRECISION NOT NULL DEFAULT 1.0,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, symbol)
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                symbol VARCHAR(64) NOT NULL,
                asset_class VARCHAR(32) NOT NULL,
                side VARCHAR(16) NOT NULL,
                order_type VARCHAR(16) NOT NULL,
                quantity DOUBLE PRECISION NOT NULL,
                limit_price DOUBLE PRECISION,
                leverage DOUBLE PRECISION NOT NULL DEFAULT 1.0,
                status VARCHAR(32) NOT NULL,
                filled_price DOUBLE PRECISION,
                filled_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                order_id INTEGER,
                symbol VARCHAR(64) NOT NULL,
                asset_class VARCHAR(32) NOT NULL,
                side VARCHAR(16) NOT NULL,
                quantity DOUBLE PRECISION NOT NULL,
                price DOUBLE PRECISION NOT NULL,
                entry_price DOUBLE PRECISION DEFAULT 0.0,
                leverage DOUBLE PRECISION NOT NULL DEFAULT 1.0,
                realized_pnl DOUBLE PRECISION DEFAULT 0.0,
                pnl_percent DOUBLE PRECISION DEFAULT 0.0,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS price_alerts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                symbol VARCHAR(64) NOT NULL,
                target_price DOUBLE PRECISION NOT NULL,
                condition VARCHAR(16) NOT NULL,
                triggered INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS payment_orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                plan_id VARCHAR(64) NOT NULL,
                plan_name VARCHAR(128) NOT NULL,
                amount_inr DOUBLE PRECISION NOT NULL,
                virtual_cash_granted DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                upi_id VARCHAR(128) NOT NULL,
                utr_ref VARCHAR(64) UNIQUE,
                status VARCHAR(32) NOT NULL DEFAULT 'pending',
                admin_notes TEXT,
                approved_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS watchlists (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                symbol VARCHAR(64) NOT NULL,
                asset_class VARCHAR(32) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, symbol)
            );
            """)

        else:
            # SQLite Schema
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                virtual_cash REAL NOT NULL DEFAULT 10000.00,
                is_admin INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

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

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                asset_class TEXT NOT NULL,
                side TEXT NOT NULL,
                order_type TEXT NOT NULL,
                quantity REAL NOT NULL,
                limit_price REAL,
                leverage REAL NOT NULL DEFAULT 1.0,
                status TEXT NOT NULL,
                filled_price REAL,
                filled_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)

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
                ("users", "is_admin", "INTEGER DEFAULT 0"),
                ("positions", "leverage", "REAL DEFAULT 1.0"),
                ("orders", "leverage", "REAL DEFAULT 1.0"),
                ("transactions", "leverage", "REAL DEFAULT 1.0"),
                ("transactions", "entry_price", "REAL DEFAULT 0.0"),
                ("transactions", "pnl_percent", "REAL DEFAULT 0.0"),
                ("payment_orders", "admin_notes", "TEXT"),
                ("payment_orders", "approved_at", "TIMESTAMP"),
            ]:
                try:
                    cursor.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} {col_def}")
                except Exception:
                    pass

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS price_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                target_price REAL NOT NULL,
                condition TEXT NOT NULL,
                triggered INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS payment_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                plan_id TEXT NOT NULL,
                plan_name TEXT NOT NULL,
                amount_inr REAL NOT NULL,
                virtual_cash_granted REAL NOT NULL DEFAULT 0.0,
                upi_id TEXT NOT NULL,
                utr_ref TEXT UNIQUE,
                status TEXT NOT NULL DEFAULT 'pending',
                admin_notes TEXT,
                approved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)

            try:
                cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_utr ON payment_orders(utr_ref);")
            except Exception:
                pass

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

        # Seed initial demo trader user if none exists (marked as admin)
        cursor.execute("SELECT id FROM users WHERE email = ?", ("demo@zeroboss.trade",))
        demo_user = cursor.fetchone()
        if not demo_user:
            default_pw_hash = hash_password("zerotrade123")
            cursor.execute("""
            INSERT INTO users (email, password_hash, display_name, virtual_cash, is_admin)
            VALUES (?, ?, ?, ?, 1)
            """, ("demo@zeroboss.trade", default_pw_hash, "ZeroBoss Trader", INITIAL_VIRTUAL_CASH))
        else:
            cursor.execute("UPDATE users SET is_admin = 1 WHERE email = ?", ("demo@zeroboss.trade",))

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


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
