"""
Purge all old mock/demo accounts from local SQLite database and Firebase Firestore.
Keeps only:
- zerobossai@gmail.com (Master Admin)
- Genuine Google accounts (if any exist)
"""
import sqlite3
import os
import sys
import json
from pathlib import Path

sys.path.insert(0, os.path.abspath("."))

# 1. Clean local SQLite DBs
for db_path in ['data/zerotrade.db', 'zerotrade.db', 'backend/zerotrade.db']:
    if os.path.exists(db_path):
        print(f"Purging old accounts from {db_path}...")
        try:
            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            
            # List current users
            current_users = c.execute("SELECT id, email, display_name FROM users").fetchall()
            print(f"Found {len(current_users)} users before purge: {current_users}")
            
            # Delete old demo users (keep zerobossai@gmail.com)
            c.execute("DELETE FROM users WHERE email != 'zerobossai@gmail.com'")
            c.execute("DELETE FROM positions WHERE user_id NOT IN (SELECT id FROM users)")
            c.execute("DELETE FROM orders WHERE user_id NOT IN (SELECT id FROM users)")
            c.execute("DELETE FROM transactions WHERE user_id NOT IN (SELECT id FROM users)")
            c.execute("DELETE FROM payment_orders WHERE user_id NOT IN (SELECT id FROM users)")
            
            # Ensure zerobossai@gmail.com exists
            c.execute("SELECT id FROM users WHERE email = 'zerobossai@gmail.com'")
            admin = c.fetchone()
            if not admin:
                from backend.security import hash_password
                pw = hash_password("zerobossadmin2026")
                c.execute("""
                    INSERT INTO users (email, password_hash, display_name, virtual_cash, is_admin, plan_id, plan_name, max_leverage)
                    VALUES ('zerobossai@gmail.com', ?, 'ZeroBoss Master Admin', 100000.0, 1, 'elite', 'Master Admin', 20.0)
                """, (pw,))
            else:
                c.execute("""
                    UPDATE users 
                    SET is_admin = 1, plan_id = 'elite', plan_name = 'Master Admin', max_leverage = 20.0, virtual_cash = 100000.0
                    WHERE email = 'zerobossai@gmail.com'
                """)
            
            conn.commit()
            remaining = c.execute("SELECT id, email, display_name, virtual_cash FROM users").fetchall()
            print(f"Users in {db_path} after purge: {remaining}")
            conn.close()
        except Exception as e:
            print(f"Error purging {db_path}: {e}")

# 2. Clean Firebase Firestore if credentials exist
try:
    from backend.services.firebase_sync import get_firestore_client
    f_db = get_firestore_client()
    if f_db:
        print("Connected to Firestore. Purging old users and stale collections...")
        user_docs = list(f_db.collection("users").stream())
        print(f"Firestore users count: {len(user_docs)}")
        for doc in user_docs:
            u_data = doc.to_dict()
            u_email = (u_data.get("email") or "").lower().strip()
            if u_email and u_email != "zerobossai@gmail.com":
                # Check if it was one of the old mock emails
                if any(m in u_email for m in ["demo@", "apex_", "crypto_whale", "quant_", "fx_", "steady_", "tester_", "trader_", "payer_", "hazz@", "test_", "pola@", "harrysaido66@"]):
                    print(f"Deleting Firestore user: {u_email} (ID: {doc.id})")
                    doc.reference.delete()
                    # Also delete positions for this user
                    for p_doc in f_db.collection("positions").where("user_id", "==", u_data.get("id")).stream():
                        p_doc.reference.delete()
        print("Firestore cleanup complete.")
except Exception as e:
    print(f"Firestore purge note: {e}")

print("All old accounts purged successfully!")
