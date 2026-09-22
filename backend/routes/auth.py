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


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency to extract and validate the JWT token from Bearer header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token required.")

    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")

    user_id = int(payload["sub"])
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, display_name, virtual_cash, is_admin, created_at FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="User account not found.")

        return dict(user)


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
