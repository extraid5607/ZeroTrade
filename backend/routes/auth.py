"""
Authentication routes for ZeroTrade.
Supports signup, login, and user profile verification.
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
from typing import Optional

from backend.database import get_db
from backend.security import hash_password, verify_password, create_access_token, decode_access_token
from backend.config import INITIAL_VIRTUAL_CASH

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


import time

_user_cache: dict = {}
_USER_CACHE_TTL = 30  # seconds

def invalidate_user_cache(user_id: Optional[int] = None):
    """Invalidate cached user profile on order/cash/admin state changes."""
    if user_id is None:
        _user_cache.clear()
    else:
        _user_cache.pop(user_id, None)


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency to extract and validate the JWT token from Bearer header with fast memory caching."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token required.")

    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")

    user_id = int(payload["sub"])
    now = time.time()
    cached = _user_cache.get(user_id)
    if cached and cached[1] > now:
        return cached[0]

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, display_name, virtual_cash, is_admin, created_at FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            # Check Firebase Firestore in case local DB restarted
            try:
                from backend.services.firebase_sync import get_firestore_client
                f_db = get_firestore_client()
                if f_db:
                    doc = f_db.collection("users").document(str(user_id)).get()
                    if doc.exists:
                        data = doc.to_dict()
                        cursor.execute("""
                            INSERT INTO users (id, email, password_hash, display_name, virtual_cash, is_admin)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ON CONFLICT(email) DO UPDATE SET
                                virtual_cash = excluded.virtual_cash,
                                display_name = excluded.display_name,
                                is_admin = excluded.is_admin
                        """, (
                            data["id"], data["email"], data.get("password_hash", ""),
                            data["display_name"], data["virtual_cash"], data.get("is_admin", 0)
                        ))
                        cursor.execute("SELECT id, email, display_name, virtual_cash, is_admin, created_at FROM users WHERE id = ?", (user_id,))
                        user = cursor.fetchone()
            except Exception:
                pass

        if not user:
            raise HTTPException(status_code=401, detail="User account not found.")

        user_dict = dict(user)
        _user_cache[user_id] = (user_dict, now + _USER_CACHE_TTL)
        return user_dict


@router.post("/signup")
def signup(req: SignupRequest):
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    name = req.display_name.strip() if req.display_name else email.split("@")[0].capitalize()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="An account with this email already exists.")

        pw_hash = hash_password(req.password)
        cursor.execute("""
            INSERT INTO users (email, password_hash, display_name, virtual_cash, is_admin)
            VALUES (?, ?, ?, ?, 0)
        """, (email, pw_hash, name, INITIAL_VIRTUAL_CASH))
        user_id = cursor.lastrowid

        token = create_access_token(user_id, email, name)

        try:
            from backend.services.firebase_sync import sync_user
            sync_user({
                "id": user_id,
                "email": email,
                "password_hash": pw_hash,
                "display_name": name,
                "virtual_cash": INITIAL_VIRTUAL_CASH,
                "is_admin": 0
            })
        except Exception:
            pass

        return {
            "token": token,
            "user": {
                "id": user_id,
                "email": email,
                "displayName": name,
                "virtualCash": INITIAL_VIRTUAL_CASH,
                "isAdmin": False
            }
        }


@router.post("/login")
def login(req: LoginRequest):
    email = req.email.strip().lower()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, password_hash, display_name, virtual_cash, is_admin FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        if not user:
            # Check Firebase Firestore
            try:
                from backend.services.firebase_sync import get_firestore_client
                f_db = get_firestore_client()
                if f_db:
                    docs = list(f_db.collection("users").where("email", "==", email).limit(1).stream())
                    if docs:
                        data = docs[0].to_dict()
                        cursor.execute("""
                            INSERT INTO users (id, email, password_hash, display_name, virtual_cash, is_admin)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ON CONFLICT(email) DO UPDATE SET
                                virtual_cash = excluded.virtual_cash,
                                display_name = excluded.display_name,
                                is_admin = excluded.is_admin
                        """, (
                            data["id"], data["email"], data.get("password_hash", ""),
                            data["display_name"], data["virtual_cash"], data.get("is_admin", 0)
                        ))
                        cursor.execute("SELECT id, email, password_hash, display_name, virtual_cash, is_admin FROM users WHERE email = ?", (email,))
                        user = cursor.fetchone()
            except Exception:
                pass

        if not user or not verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password.")

        is_admin = bool(user["is_admin"] == 1 or user["email"] == "demo@zeroboss.trade")
        token = create_access_token(user["id"], user["email"], user["display_name"])
        return {
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "displayName": user["display_name"],
                "virtualCash": user["virtual_cash"],
                "isAdmin": is_admin
            }
        }


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    is_admin = bool(user.get("is_admin", 0) == 1 or user.get("email") == "demo@zeroboss.trade")
    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "displayName": user["display_name"],
            "virtualCash": user["virtual_cash"],
            "isAdmin": is_admin
        }
    }
