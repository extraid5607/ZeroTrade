"""
Authentication routes for ZeroTrade.
Supports signup, login, and user profile verification with automatic plan expiration checks.
"""
import time
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel

from backend.database import get_db
from backend.security import hash_password, verify_password, create_access_token, decode_access_token
from backend.config import INITIAL_VIRTUAL_CASH

logger = logging.getLogger("zerotrade.auth")

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: Optional[str] = None
    email: Optional[str] = None
    display_name: Optional[str] = None
    photo_url: Optional[str] = None


_user_cache: dict = {}
_USER_CACHE_TTL = 15  # seconds cache


def invalidate_user_cache(user_id: Optional[int] = None):
    """Invalidate cached user profile on order/cash/admin state changes."""
    if user_id is None:
        _user_cache.clear()
    else:
        _user_cache.pop(user_id, None)


def format_user_and_check_expiry(user_row: dict, conn=None) -> dict:
    """Check if user's paid plan has expired; if so, automatically downgrade to Free Basic ($2000 / 2x max leverage)."""
    user_id = user_row["id"]
    plan_id = user_row.get("plan_id") or "free"
    plan_name = user_row.get("plan_name") or "Free Basic"
    plan_expires_at = user_row.get("plan_expires_at")
    max_leverage = int(user_row.get("max_leverage") or 2)
    is_admin = bool(user_row.get("is_admin", 0) == 1 or user_row.get("email") == "zerobossai@gmail.com")

    # Check expiration if user has a paid plan
    if plan_expires_at and plan_id != "free" and not is_admin:
        is_expired = False
        try:
            if isinstance(plan_expires_at, str):
                ts_str = plan_expires_at.replace("Z", "+00:00")
                if "+" not in ts_str and "-" not in ts_str[10:]:
                    dt = datetime.fromisoformat(ts_str).replace(tzinfo=timezone.utc)
                else:
                    dt = datetime.fromisoformat(ts_str)
                if datetime.now(timezone.utc) > dt:
                    is_expired = True
            elif hasattr(plan_expires_at, "tzinfo"):
                now_utc = datetime.now(timezone.utc)
                dt = plan_expires_at if plan_expires_at.tzinfo else plan_expires_at.replace(tzinfo=timezone.utc)
                if now_utc > dt:
                    is_expired = True
        except Exception as e:
            logger.debug(f"Plan expiry parse check: {e}")

        if is_expired:
            plan_id = "free"
            plan_name = "Free Basic"
            plan_expires_at = None
            max_leverage = 2
            if conn:
                try:
                    c = conn.cursor()
                    c.execute("""
                        UPDATE users 
                        SET plan_id = 'free', plan_name = 'Free Basic', plan_expires_at = NULL, max_leverage = 2
                        WHERE id = ?
                    """, (user_id,))
                except Exception:
                    pass

    is_paid = bool(is_admin or (plan_id != "free" and plan_expires_at is not None))
    if is_admin:
        max_leverage = 20

    is_banned = bool(user_row.get("is_banned", 0) == 1)
    ban_reason = user_row.get("ban_reason") or ""

    res = dict(user_row)
    res.update({
        "id": user_row["id"],
        "email": user_row["email"],
        "displayName": user_row.get("display_name") or user_row.get("displayName") or "Trader",
        "virtualCash": float(user_row.get("virtual_cash", INITIAL_VIRTUAL_CASH)),
        "isAdmin": is_admin,
        "is_admin": 1 if is_admin else 0,
        "planId": plan_id,
        "plan_id": plan_id,
        "planName": plan_name,
        "plan_name": plan_name,
        "planExpiresAt": plan_expires_at,
        "plan_expires_at": plan_expires_at,
        "isPaidPlan": is_paid,
        "maxLeverage": max_leverage,
        "max_leverage": max_leverage,
        "isBanned": is_banned,
        "is_banned": 1 if is_banned else 0,
        "banReason": ban_reason,
        "ban_reason": ban_reason
    })
    return res


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency to extract and validate the JWT token from Bearer header with fast memory caching."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token required.")

    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")

    user_id = int(payload["sub"])
    email = payload.get("email")
    now = time.time()
    cached = _user_cache.get(user_id)
    if cached and cached[1] > now:
        return cached[0]

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, password_hash, display_name, virtual_cash, is_admin, plan_id, plan_name, plan_expires_at, max_leverage, is_banned, ban_reason, created_at FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()

        if not user and email:
            cursor.execute("SELECT id, email, password_hash, display_name, virtual_cash, is_admin, plan_id, plan_name, plan_expires_at, max_leverage, is_banned, ban_reason, created_at FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()

        if not user:
            # Check Firebase Firestore in case local DB restarted
            try:
                from backend.services.firebase_sync import get_firestore_client, restore_user_positions
                f_db = get_firestore_client()
                if f_db:
                    data = None
                    doc = f_db.collection("users").document(str(user_id)).get()
                    if doc.exists:
                        data = doc.to_dict()
                    elif email:
                        docs = list(f_db.collection("users").where("email", "==", email).limit(1).stream())
                        if docs:
                            data = docs[0].to_dict()

                    if data:
                        cursor.execute("""
                            INSERT INTO users (id, email, password_hash, display_name, virtual_cash, is_admin, plan_id, plan_name, plan_expires_at, max_leverage)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(email) DO UPDATE SET
                                virtual_cash = excluded.virtual_cash,
                                display_name = excluded.display_name,
                                is_admin = excluded.is_admin,
                                plan_id = excluded.plan_id,
                                plan_name = excluded.plan_name,
                                plan_expires_at = excluded.plan_expires_at,
                                max_leverage = excluded.max_leverage
                        """, (
                            data["id"], data["email"], data.get("password_hash", ""),
                            data["display_name"], float(data.get("virtual_cash", 2000.0)), int(data.get("is_admin", 0)),
                            data.get("plan_id", "free"), data.get("plan_name", "Free Basic"),
                            data.get("plan_expires_at"), float(data.get("max_leverage", 2))
                        ))
                        cursor.execute("SELECT id, email, password_hash, display_name, virtual_cash, is_admin, plan_id, plan_name, plan_expires_at, max_leverage, created_at FROM users WHERE email = ?", (data["email"],))
                        user = cursor.fetchone()
                        
                        # Recover positions from Firestore immediately
                        restore_user_positions(data["id"], data["email"])
            except Exception as e:
                logger.debug(f"Firebase fetch in get_current_user error: {e}")

        if not user:
            raise HTTPException(status_code=401, detail="User account not found.")

        user_dict = format_user_and_check_expiry(dict(user), conn=conn)
        _user_cache[user_id] = (user_dict, now + _USER_CACHE_TTL)
        if user_dict.get("id") and user_dict["id"] != user_id:
            _user_cache[user_dict["id"]] = (user_dict, now + _USER_CACHE_TTL)
        return user_dict


@router.post("/signup")
def signup(req: SignupRequest):
    raise HTTPException(status_code=400, detail="Standard email registration is disabled. Please use 1-Click Continue with Google.")


@router.post("/login")
def login(req: LoginRequest):
    raise HTTPException(status_code=400, detail="Standard email login is disabled. Please use 1-Click Continue with Google.")


@router.post("/google")
def google_login(req: GoogleAuthRequest):
    email = None
    name = req.display_name

    if req.id_token:
        try:
            import firebase_admin.auth
            decoded = firebase_admin.auth.verify_id_token(req.id_token)
            email = decoded.get("email", "").lower().strip()
            if not name:
                name = decoded.get("name") or decoded.get("display_name")
        except Exception as e:
            logger.warning(f"Firebase token verification error: {e}")

    if not email and req.email:
        email = req.email.lower().strip()

    if not email:
        raise HTTPException(status_code=400, detail="A valid Google email is required.")

    if not name:
        name = email.split("@")[0].capitalize()

    is_admin = bool(email == "zerobossai@gmail.com")
    plan_id = "elite" if is_admin else "free"
    plan_name = "Master Admin" if is_admin else "Free Basic"
    max_leverage = 20 if is_admin else 2
    starting_cash = 100000.0 if is_admin else 2000.0

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, password_hash, display_name, virtual_cash, is_admin, plan_id, plan_name, plan_expires_at, max_leverage, is_banned, ban_reason FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

        if not user:
            # Check Firebase Firestore first before creating a fresh user
            firestore_user = None
            try:
                from backend.services.firebase_sync import get_firestore_client
                f_db = get_firestore_client()
                if f_db:
                    f_docs = list(f_db.collection("users").where("email", "==", email).limit(1).stream())
                    if f_docs:
                        firestore_user = f_docs[0].to_dict()
            except Exception as fe:
                logger.debug(f"Firestore check in google_login: {fe}")

            if firestore_user:
                cursor.execute("""
                    INSERT INTO users (id, email, password_hash, display_name, virtual_cash, is_admin, plan_id, plan_name, plan_expires_at, max_leverage, is_banned, ban_reason)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(email) DO UPDATE SET
                        virtual_cash = excluded.virtual_cash,
                        display_name = excluded.display_name,
                        is_admin = excluded.is_admin,
                        plan_id = excluded.plan_id,
                        plan_name = excluded.plan_name,
                        plan_expires_at = excluded.plan_expires_at,
                        max_leverage = excluded.max_leverage
                """, (
                    firestore_user.get("id"), firestore_user["email"], firestore_user.get("password_hash", ""),
                    firestore_user.get("display_name", name), float(firestore_user.get("virtual_cash", starting_cash)),
                    int(firestore_user.get("is_admin", 1 if is_admin else 0)),
                    firestore_user.get("plan_id", plan_id), firestore_user.get("plan_name", plan_name),
                    firestore_user.get("plan_expires_at"), float(firestore_user.get("max_leverage", max_leverage)),
                    int(firestore_user.get("is_banned", 0)), firestore_user.get("ban_reason", "")
                ))
            else:
                dummy_pw_hash = hash_password(f"google_{email}_{time.time()}")
                cursor.execute("""
                    INSERT INTO users (email, password_hash, display_name, virtual_cash, is_admin, plan_id, plan_name, max_leverage)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (email, dummy_pw_hash, name, starting_cash, 1 if is_admin else 0, plan_id, plan_name, max_leverage))

            cursor.execute("SELECT id, email, password_hash, display_name, virtual_cash, is_admin, plan_id, plan_name, plan_expires_at, max_leverage, is_banned, ban_reason FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()

            # Restore positions for this user from Firestore
            if user:
                try:
                    from backend.services.firebase_sync import restore_user_positions
                    restore_user_positions(user["id"], email)
                except Exception:
                    pass
        else:
            if is_admin and user["is_admin"] != 1:
                cursor.execute("UPDATE users SET is_admin = 1, plan_id = 'elite', plan_name = 'Master Admin', max_leverage = 20 WHERE id = ?", (user["id"],))
                cursor.execute("SELECT id, email, password_hash, display_name, virtual_cash, is_admin, plan_id, plan_name, plan_expires_at, max_leverage, is_banned, ban_reason FROM users WHERE id = ?", (user["id"],))
                user = cursor.fetchone()

        formatted_user = format_user_and_check_expiry(dict(user), conn=conn)

        # Sync to Firebase
        try:
            from backend.services.firebase_sync import sync_user
            sync_user(formatted_user)
        except Exception:
            pass

        token = create_access_token(formatted_user["id"], formatted_user["email"], formatted_user["displayName"])
        return {
            "token": token,
            "user": formatted_user
        }


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return {
        "user": user
    }
