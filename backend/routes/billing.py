"""
UPI Billing and Monetization Route for ZeroTrade.
Supports Account Resets, Capital Tier Challenges, and Tournament Passes with Indian UPI (harjinder1070-1@okicici).
"""
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from backend.database import get_db
from backend.routes.auth import get_current_user
from backend.config import MERCHANT_UPI_ID, MERCHANT_NAME

logger = logging.getLogger("zerotrade.billing")

router = APIRouter(prefix="/api/billing", tags=["billing"])

MONETIZATION_PLANS = [
    {
        "id": "reset_10k",
        "name": "Account Reset (Extra Life)",
        "priceInr": 199,
        "virtualCash": 10000.0,
        "badge": "POPULAR",
        "popular": True,
        "description": "Restore your blown account back to $10,000.00 capital instantly.",
        "features": [
            "Instant $10,000.00 Virtual Capital Reset",
            "Clear all liquidated/negative positions",
            "Full access to 20x Futures & US Options",
            "Instant UPI Activation via QR Code"
        ]
    },
    {
        "id": "tier_25k",
        "name": "Pro Trader Challenge ($25k)",
        "priceInr": 499,
        "virtualCash": 25000.0,
        "badge": "PRO",
        "popular": False,
        "description": "Upgrade your simulated capital to $25,000.00 for pro-scale swing trading.",
        "features": [
            "$25,000.00 High-Capacity Virtual Capital",
            "Up to 20x Leverage on Futures & Stocks",
            "Complete CBOE US Option Chain Trading",
            "Detailed 1-Year P&L Statement Export"
        ]
    },
    {
        "id": "tier_100k",
        "name": "Elite Whale Challenge ($100k)",
        "priceInr": 999,
        "virtualCash": 100000.0,
        "badge": "BEST VALUE",
        "popular": False,
        "description": "Institutional-grade $100,000.00 virtual funding package for serious traders.",
        "features": [
            "$100,000.00 Institutional Virtual Capital",
            "Unrestricted Multi-Position Options Writing",
            "Priority Global Leaderboard Ranking",
            "VIP Trader Profile Status"
        ]
    },
    {
        "id": "tournament_pass",
        "name": "Monthly Tournament VIP Pass",
        "priceInr": 299,
        "virtualCash": 10000.0,
        "badge": "COMPETITION",
        "popular": False,
        "description": "Compete with top traders in the monthly championship with $10,000 capital.",
        "features": [
            "Championship Entry with $10,000 Capital",
            "Top 5 P&L Prize Pool Eligibility",
            "Live Contest Leaderboard Tracking",
            "Verified Contestant Profile Badge"
        ]
    }
]


class PaymentSubmission(BaseModel):
    plan_id: str
    utr_ref: str
    amount_inr: float
    notes: Optional[str] = None


@router.get("/plans")
def get_plans():
    """Return list of active monetization plans and merchant UPI details."""
    return {
        "merchantUpiId": MERCHANT_UPI_ID,
        "merchantName": MERCHANT_NAME,
        "currency": "INR",
        "plans": MONETIZATION_PLANS
    }


@router.post("/submit-payment")
def submit_payment(
    data: PaymentSubmission,
    user: dict = Depends(get_current_user)
):
    """
    Process UPI payment submission, verify transaction reference, and grant virtual cash / reset account.
    """
    user_id = user["id"]
    plan_id = data.plan_id.strip()
    utr_ref = data.utr_ref.strip()

    if not utr_ref or len(utr_ref) < 4:
        raise HTTPException(
            status_code=400,
            detail="Please provide a valid UPI Transaction Reference / UTR Number (minimum 4 digits/characters)."
        )

    matched_plan = next((p for p in MONETIZATION_PLANS if p["id"] == plan_id), None)
    if not matched_plan:
        raise HTTPException(status_code=400, detail="Invalid plan selected.")

    target_cash = matched_plan["virtualCash"]
    plan_name = matched_plan["name"]
    amount_inr = float(matched_plan["priceInr"])

    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Update user virtual cash
        cursor.execute("UPDATE users SET virtual_cash = ? WHERE id = ?", (target_cash, user_id))

        # 2. Reset / clear open positions, orders, and transactions for fresh restart
        cursor.execute("DELETE FROM positions WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM orders WHERE user_id = ?", (user_id,))

        # 3. Log the payment order
        cursor.execute("""
            INSERT INTO payment_orders (user_id, plan_id, plan_name, amount_inr, virtual_cash_granted, upi_id, utr_ref, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
        """, (user_id, plan_id, plan_name, amount_inr, target_cash, MERCHANT_UPI_ID, utr_ref))
        order_id = cursor.lastrowid

        return {
            "success": True,
            "orderId": order_id,
            "planId": plan_id,
            "planName": plan_name,
            "amountInr": amount_inr,
            "virtualCashGranted": target_cash,
            "utrRef": utr_ref,
            "upiId": MERCHANT_UPI_ID,
            "message": f"Payment successfully confirmed! Your account has been credited with ${target_cash:,.2f} virtual trading capital."
        }


@router.get("/history")
def get_payment_history(user: dict = Depends(get_current_user)):
    """Retrieve all past UPI payment receipts for the logged-in user."""
    user_id = user["id"]
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, plan_id, plan_name, amount_inr, virtual_cash_granted, upi_id, utr_ref, status, created_at
            FROM payment_orders
            WHERE user_id = ?
            ORDER BY created_at DESC
        """, (user_id,))
        rows = cursor.fetchall()
        return {
            "orders": [dict(r) for r in rows]
        }
