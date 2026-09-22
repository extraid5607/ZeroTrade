"""
Configuration settings for ZeroTrade.
Supports loading from environment variables and .env file.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# Server Config
PORT = int(os.getenv("PORT", 8000))
SECRET_KEY = os.getenv("SECRET_KEY", "zerotrade_super_secret_jwt_key_2026_zeroboss")
ACCESS_TOKEN_EXPIRE_DAYS = 30
INITIAL_VIRTUAL_CASH = float(os.getenv("INITIAL_VIRTUAL_CASH", 10000.00))
MERCHANT_UPI_ID = os.getenv("MERCHANT_UPI_ID", "harjinder1070-1@okicici").strip()
MERCHANT_NAME = os.getenv("MERCHANT_NAME", "ZeroVega").strip()

# Upstream Providers
# 1. US Stocks (Alpaca)
ALPACA_API_KEY = os.getenv("ALPACA_API_KEY", "").strip()
ALPACA_SECRET_KEY = os.getenv("ALPACA_SECRET_KEY", "").strip()
ALPACA_DATA_ENDPOINT = os.getenv("ALPACA_DATA_ENDPOINT", "https://data.alpaca.markets/v2").strip()
ALPACA_WS_ENDPOINT = os.getenv("ALPACA_WS_ENDPOINT", "wss://stream.data.alpaca.markets/v2/iex").strip()

# 2. Crypto (Binance)
BINANCE_REST_ENDPOINT = os.getenv("BINANCE_REST_ENDPOINT", "https://api.binance.com/api/v3").strip()
BINANCE_WS_ENDPOINT = os.getenv("BINANCE_WS_ENDPOINT", "wss://stream.binance.com:9443/ws").strip()

# 3. Forex (Twelve Data)
# IMPORTANT: Free tier allows up to 8 API calls/minute and is strictly for
# development/educational purposes. Upgrade to a paid commercial tier for production!
TWELVE_DATA_API_KEY = os.getenv("TWELVE_DATA_API_KEY", "").strip()

# Database
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
SQLITE_DB_PATH = str(DATA_DIR / "zerotrade.db")
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

DEFAULT_INDICES = [
    {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "display": "S&P 500 (SPY)", "category": "index", "currency": "USD", "basePrice": 761.70},
    {"symbol": "QQQ", "name": "Invesco QQQ Trust (Nasdaq 100)", "display": "Nasdaq 100 (QQQ)", "category": "index", "currency": "USD", "basePrice": 721.45},
    {"symbol": "^GSPC", "name": "S&P 500 Index", "display": "S&P 500 Index", "category": "index", "currency": "USD", "basePrice": 7650.50},
    {"symbol": "^IXIC", "name": "Nasdaq Composite", "display": "Nasdaq Composite", "category": "index", "currency": "USD", "basePrice": 26522.50},
]

# Configurable Instrument Catalogs
DEFAULT_STOCKS = [
    {"symbol": "AAPL", "name": "Apple Inc.", "category": "stock", "currency": "USD", "basePrice": 224.50},
    {"symbol": "TSLA", "name": "Tesla Inc.", "category": "stock", "currency": "USD", "basePrice": 248.30},
    {"symbol": "NVDA", "name": "NVIDIA Corp.", "category": "stock", "currency": "USD", "basePrice": 118.80},
    {"symbol": "MSFT", "name": "Microsoft Corp.", "category": "stock", "currency": "USD", "basePrice": 428.10},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "category": "stock", "currency": "USD", "basePrice": 186.40},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "category": "stock", "currency": "USD", "basePrice": 162.70},
    {"symbol": "META", "name": "Meta Platforms Inc.", "category": "stock", "currency": "USD", "basePrice": 512.90},
    {"symbol": "AMD", "name": "Advanced Micro Devices", "category": "stock", "currency": "USD", "basePrice": 154.20},
]

DEFAULT_CRYPTO = [
    {"symbol": "BTCUSDT", "name": "Bitcoin / USDT", "display": "BTC/USDT", "category": "crypto", "currency": "USDT", "basePrice": 63400.00},
    {"symbol": "ETHUSDT", "name": "Ethereum / USDT", "display": "ETH/USDT", "category": "crypto", "currency": "USDT", "basePrice": 2620.00},
    {"symbol": "SOLUSDT", "name": "Solana / USDT", "display": "SOL/USDT", "category": "crypto", "currency": "USDT", "basePrice": 145.50},
    {"symbol": "BNBUSDT", "name": "BNB / USDT", "display": "BNB/USDT", "category": "crypto", "currency": "USDT", "basePrice": 585.00},
    {"symbol": "XRPUSDT", "name": "Ripple / USDT", "display": "XRP/USDT", "category": "crypto", "currency": "USDT", "basePrice": 0.5890},
    {"symbol": "DOGEUSDT", "name": "Dogecoin / USDT", "display": "DOGE/USDT", "category": "crypto", "currency": "USDT", "basePrice": 0.1085},
    {"symbol": "ADAUSDT", "name": "Cardano / USDT", "display": "ADA/USDT", "category": "crypto", "currency": "USDT", "basePrice": 0.3540},
    {"symbol": "AVAXUSDT", "name": "Avalanche / USDT", "display": "AVAX/USDT", "category": "crypto", "currency": "USDT", "basePrice": 27.80},
]

DEFAULT_FOREX = [
    {"symbol": "EUR/USD", "name": "Euro / US Dollar", "category": "forex", "currency": "USD", "basePrice": 1.1160},
    {"symbol": "GBP/USD", "name": "British Pound / US Dollar", "category": "forex", "currency": "USD", "basePrice": 1.3320},
    {"symbol": "USD/JPY", "name": "US Dollar / Japanese Yen", "category": "forex", "currency": "JPY", "basePrice": 143.85},
    {"symbol": "USD/INR", "name": "US Dollar / Indian Rupee", "category": "forex", "currency": "INR", "basePrice": 83.55},
    {"symbol": "AUD/USD", "name": "Australian Dollar / US Dollar", "category": "forex", "currency": "USD", "basePrice": 0.6810},
    {"symbol": "USD/CAD", "name": "US Dollar / Canadian Dollar", "category": "forex", "currency": "CAD", "basePrice": 1.3570},
]
