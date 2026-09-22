# ZeroVega 📈⚡

A high-performance institutional-grade simulated trading web terminal covering **US Stocks**, **CBOE F&O Option Chains**, **Crypto**, and **Forex** — built under the **ZeroBoss** ecosystem.

> [!WARNING]
> **SIMULATED TRADING ONLY — NO REAL MONEY INVOLVED**
> This platform is strictly for risk-free practice, strategy backtesting, algorithmic testing, and educational purposes. No orders ever reach an actual financial exchange. Virtual balances and profits have no real-world monetary value.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        UPSTREAM DATA PROVIDERS                         │
│  - US Stocks & Indices: Yahoo Finance / Alpaca (SPY, QQQ, AAPL, etc.)   │
│  - F&O Option Chains:   CBOE Official Strike Matrix + Real-time Greeks │
│  - Crypto:              Binance WebSocket Stream (BTC, ETH, SOL, etc.) │
│  - Forex:               Twelve Data / Interbank Feed (EUR/USD, USD/INR)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Single multiplexed connection
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  ZEROVEGA BACKEND (FastAPI + Uvicorn)                  │
│  - Security: Cryptographic PBKDF2 Password Hashing + Signed JWT Auth   │
│  - DataHub: Multiplexes & fans out price ticks to all browser clients  │
│  - Margin & Order Engine: 20x Futures Leverage, 10x Option Sell Margin │
│  - Database: SQLite (PostgreSQL compatible) Users, Orders, Settlements │
│  - Monetization: Instant UPI QR Codes (Merchant: harjinder1070-1@okicici)
│  - Static Mount: Directly serves compiled React Single-Page App        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ WebSocket Fan-Out (/ws/stream)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             FRONTEND CLIENT (React 19 + Tailwind + Canvas)             │
│  - Interactive Candlestick Chart with multi-timeframe indicators       │
│  - CBOE Option Chain with Delta, Gamma, Theta, Vega, IV calculations   │
│  - Zerodha Kite / Groww style Market & Limit Order Execution           │
│  - Portfolio with real-time unrealized/realized P&L & Day Settlement   │
│  - Verified 1-Year P&L Audit Statement & CSV export                    │
│  - Global Trader Leaderboard & UPI Capital Reset / Upgrade Modals      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Markets & Instruments Covered

| Category | Instruments | Execution & Margin Rules |
| :--- | :--- | :--- |
| **US Stocks & Indices** | `SPY`, `QQQ`, `AAPL`, `TSLA`, `NVDA`, `MSFT`, `AMZN`, `GOOGL`, `META`, `AMD` | Spot / Margin (Up to 20x Leverage) |
| **F&O Option Chains** | CBOE Strike Chains (`SPX`, `SPY`, `QQQ`, `AAPL`, `NVDA`, `TSLA`) | **Buying**: 100% Cash Margin<br>**Selling/Writing**: 10x Premium Margin |
| **Crypto** | `BTC/USDT`, `ETH/USDT`, `SOL/USDT`, `BNB/USDT`, `XRP/USDT`, `DOGE/USDT`, `ADA/USDT` | Spot / 20x Leverage Long & Short |
| **Forex** | `EUR/USD`, `GBP/USD`, `USD/JPY`, `USD/INR`, `AUD/USD`, `USD/CAD` | Up to 20x Leverage |

---

## 🛠️ Quick Start (Local Setup)

### 1. Requirements
- Python 3.10+
- Node.js 18+ and npm

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Install Dependencies & Build
```bash
# Backend dependencies
pip install -r requirements.txt

# Frontend dependencies & build
cd frontend
npm install
npm run build
cd ..
```

### 4. Run the Application
```bash
python run.py
```
Open your browser at: **`http://localhost:8000`**

*(Windows shortcut: You can also double-click `start.bat`)*

---

## ☁️ Deployment on Render (Single Web Service)

ZeroVega is pre-configured for zero-hassle single-service deployment on [Render](https://render.com) using the included `render.yaml` blueprint:

1. Push this repository to GitHub: `https://github.com/extraid5607/ZeroTrade`
2. In the Render Dashboard, click **New +** &rarr; **Blueprint** (or **Web Service**).
3. Connect your repository. Render will automatically read `render.yaml`:
   - **Environment**: Python
   - **Build Command**: `pip install -r requirements.txt && npm --prefix frontend install && npm --prefix frontend run build`
   - **Start Command**: `python run.py`
4. Click **Apply / Deploy**. The API, WebSocket feed, and React SPA will be live on your Render URL 24/7.

---

## 📄 License & Ecosystem
Part of the **ZeroBoss** ecosystem. Designed for modern multi-asset trading strategy development, education, and paper trading.
