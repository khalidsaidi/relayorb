"""
Data feed providers for Backtrader
Supports: FMP (stocks/forex), CoinGecko (crypto)
"""

import backtrader as bt
from datetime import datetime, timedelta
import requests
import os
import logging
import pandas as pd
import time
import threading

logger = logging.getLogger(__name__)

FMP_BASE_URL = "https://financialmodelingprep.com/stable"
COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3"

# Rate limiting for CoinGecko (30 calls/minute for free tier)
_coingecko_lock = threading.Lock()
_coingecko_last_call = 0
_coingecko_min_interval = 2.5  # seconds between calls (24 calls/minute)

# Simple in-memory cache for CoinGecko data (1 hour TTL)
_coingecko_cache = {}
_coingecko_cache_ttl = 3600  # 1 hour


def _coingecko_rate_limit():
    """Enforce rate limiting for CoinGecko API"""
    global _coingecko_last_call
    with _coingecko_lock:
        elapsed = time.time() - _coingecko_last_call
        if elapsed < _coingecko_min_interval:
            time.sleep(_coingecko_min_interval - elapsed)
        _coingecko_last_call = time.time()


def _get_cached_coingecko(cache_key):
    """Get cached CoinGecko data if still valid"""
    if cache_key in _coingecko_cache:
        entry = _coingecko_cache[cache_key]
        if time.time() - entry["timestamp"] < _coingecko_cache_ttl:
            return entry["data"]
    return None


def _set_cached_coingecko(cache_key, data):
    """Cache CoinGecko data"""
    _coingecko_cache[cache_key] = {
        "data": data,
        "timestamp": time.time(),
    }

# CoinGecko symbol to ID mapping for common cryptos
COINGECKO_ID_MAP = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "XRP": "ripple",
    "ADA": "cardano",
    "DOGE": "dogecoin",
    "SOL": "solana",
    "DOT": "polkadot",
    "MATIC": "matic-network",
    "POL": "matic-network",
    "LTC": "litecoin",
    "SHIB": "shiba-inu",
    "TRX": "tron",
    "AVAX": "avalanche-2",
    "LINK": "chainlink",
    "ATOM": "cosmos",
    "UNI": "uniswap",
    "XLM": "stellar",
    "ETC": "ethereum-classic",
    "BCH": "bitcoin-cash",
    "ALGO": "algorand",
    "VET": "vechain",
    "FIL": "filecoin",
    "HBAR": "hedera-hashgraph",
    "ICP": "internet-computer",
    "NEAR": "near",
    "APT": "aptos",
    "ARB": "arbitrum",
    "OP": "optimism",
    "SUI": "sui",
    "SEI": "sei-network",
    "INJ": "injective-protocol",
    "PEPE": "pepe",
    "WLD": "worldcoin-wld",
    "BONK": "bonk",
    "FLOKI": "floki",
    "RENDER": "render-token",
    "FET": "fetch-ai",
    "GRT": "the-graph",
    "IMX": "immutable-x",
    "SAND": "the-sandbox",
    "MANA": "decentraland",
    "AXS": "axie-infinity",
    "APE": "apecoin",
    "CRV": "curve-dao-token",
    "AAVE": "aave",
    "MKR": "maker",
    "SNX": "havven",
    "COMP": "compound-governance-token",
    "LDO": "lido-dao",
    "RPL": "rocket-pool",
    "RUNE": "thorchain",
    "DASH": "dash",
    "ZEC": "zcash",
    "XMR": "monero",
    "BNB": "binancecoin",
    "USDT": "tether",
    "USDC": "usd-coin",
    "DAI": "dai",
    "BUSD": "binance-usd",
    "TUSD": "true-usd",
    "WBTC": "wrapped-bitcoin",
    "WETH": "weth",
    "STETH": "staked-ether",
    "ENS": "ethereum-name-service",
    "QNT": "quant-network",
    "EGLD": "elrond-erd-2",
    "XTZ": "tezos",
    "THETA": "theta-token",
    "EOS": "eos",
    "IOTA": "iota",
    "NEO": "neo",
    "KCS": "kucoin-shares",
    "CRO": "crypto-com-chain",
    "FTM": "fantom",
    "KAVA": "kava",
    "ZIL": "zilliqa",
    "MINA": "mina-protocol",
    "ROSE": "oasis-network",
    "ONE": "harmony",
    "GMT": "stepn",
    "GALA": "gala",
    "ENJ": "enjincoin",
    "CHZ": "chiliz",
    "BAT": "basic-attention-token",
    "1INCH": "1inch",
    "SUSHI": "sushi",
    "YFI": "yearn-finance",
    "CAKE": "pancakeswap-token",
    "PENGU": "pudgy-penguins",
    "ENA": "ethena",
    "IP": "story-protocol",
}


def parse_fmp_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        try:
            ts = value / 1000 if value > 1_000_000_000_000 else value
            return datetime.fromtimestamp(ts)
        except (OSError, ValueError):
            return None
    raw = str(value).replace("Z", "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def map_fmp_interval(timeframe: str):
    mapping = {
        "1min": "1min",
        "5m": "5min",
        "5min": "5min",
        "15m": "15min",
        "15min": "15min",
        "30m": "30min",
        "30min": "30min",
        "1h": "1hour",
        "1hour": "1hour",
        "4h": "4hour",
        "4hour": "4hour",
        "1d": "1day",
        "1day": "1day",
        "1w": "1week",
        "1week": "1week",
    }
    return mapping.get(timeframe, "1day")


def normalize_fmp_symbol(symbol: str, asset_class: str):
    if not symbol:
        return None
    cleaned = str(symbol).upper().strip()
    if not cleaned:
        return None
    cleaned = cleaned.replace(" ", "")
    if asset_class == "forex":
        return cleaned.replace("/", "").replace("-", "")
    return cleaned


def get_fmp_data(symbol: str, asset_class: str, timeframe: str = "1d", days: int = 100):
    interval = map_fmp_interval(timeframe)
    normalized = normalize_fmp_symbol(symbol, asset_class)
    if not normalized:
        return None
    gateway_url = os.environ.get("MARKET_DATA_GATEWAY_URL", "").rstrip("/")
    payload = None
    if gateway_url:
        try:
            response = requests.get(
                f"{gateway_url}/v1/fmp/candles",
                params={
                    "symbol": normalized,
                    "assetClass": asset_class,
                    "interval": interval,
                    "limit": days,
                },
                timeout=10,
            )
            if response.status_code == 200:
                payload = response.json()
        except Exception as e:
            logger.error(f"Gateway candle fetch failed for {symbol}: {e}")
            return None

    if payload is None:
        api_key = os.environ.get("FMP_API_KEY")
        if not api_key:
            return None
        try:
            response = requests.get(
                f"{FMP_BASE_URL}/historical-chart/{interval}",
                params={"symbol": normalized, "apikey": api_key},
                timeout=10,
            )
            if response.status_code != 200:
                return None
            payload = response.json()
        except Exception as e:
            logger.error(f"Error fetching FMP data: {e}")
            return None

    data = payload.get("candles") if isinstance(payload, dict) else payload
    if not isinstance(data, list) or not data:
        return None

    bars = []
    for entry in data:
        dt = parse_fmp_datetime(entry.get("date") or entry.get("time") or entry.get("timestamp"))
        if not dt:
            continue
        try:
            open_px = float(entry.get("open"))
            high_px = float(entry.get("high"))
            low_px = float(entry.get("low"))
            close_px = float(entry.get("close"))
        except (TypeError, ValueError):
            continue
        volume = entry.get("volume")
        try:
            volume = int(float(volume)) if volume is not None else 0
        except (TypeError, ValueError):
            volume = 0
        bars.append(
            {
                "datetime": dt,
                "open": open_px,
                "high": high_px,
                "low": low_px,
                "close": close_px,
                "volume": volume,
            }
        )

    bars.sort(key=lambda item: item["datetime"])
    if days and days > 0:
        bars = bars[-days:]

    if not bars:
        logger.warning(f"No bars retrieved for {symbol}")
        return None

    if len(bars) < 20:
        logger.warning(f"Insufficient data for {symbol}: {len(bars)} bars")
        return None

    import pandas as pd
    df = pd.DataFrame(bars)
    df.set_index("datetime", inplace=True)
    df = df[["open", "high", "low", "close", "volume"]]

    try:
        datafeed = bt.feeds.PandasData(dataname=df)
        logger.info(f"Created datafeed for {symbol} with {len(df)} bars")
        return datafeed
    except Exception as e:
        logger.error(f"Error creating Backtrader datafeed for {symbol}: {e}", exc_info=True)
        return None

def normalize_crypto_symbol(symbol: str):
    """Extract base currency from crypto pair (e.g., BTC/USD -> BTC)"""
    if not symbol:
        return None
    cleaned = str(symbol).upper().strip()
    # Remove quote currency
    for suffix in ["/USD", "/USDT", "/EUR", "/GBP", "-USD", "-USDT", "USD", "USDT"]:
        if cleaned.endswith(suffix):
            cleaned = cleaned[:-len(suffix)]
            break
    return cleaned.strip("/- ")


def get_coingecko_id(symbol: str):
    """Get CoinGecko ID from symbol"""
    base = normalize_crypto_symbol(symbol)
    if not base:
        return None
    # Check direct mapping
    if base in COINGECKO_ID_MAP:
        return COINGECKO_ID_MAP[base]
    # Try lowercase as ID
    return base.lower()


def map_coingecko_days(timeframe: str):
    """Map timeframe to CoinGecko days parameter"""
    # CoinGecko granularity is auto-determined by days:
    # 1-2 days: 5-minute
    # 3-90 days: hourly
    # 90+ days: daily
    mapping = {
        "1m": 1,      # 5-min granularity
        "5m": 1,      # 5-min granularity
        "15m": 2,     # 5-min granularity
        "30m": 2,     # 5-min granularity
        "1h": 30,     # hourly granularity
        "4h": 60,     # hourly granularity
        "1d": 180,    # daily granularity
        "1w": 365,    # daily granularity
    }
    return mapping.get(timeframe, 90)


def get_coingecko_data(symbol: str, timeframe: str = "1d", days: int = None):
    """Fetch OHLCV data from CoinGecko with rate limiting and caching"""
    coin_id = get_coingecko_id(symbol)
    if not coin_id:
        logger.warning(f"Could not resolve CoinGecko ID for {symbol}")
        return None
    
    if days is None:
        days = map_coingecko_days(timeframe)
    
    # Check cache first
    cache_key = f"{coin_id}:{days}"
    cached_bars = _get_cached_coingecko(cache_key)
    if cached_bars is not None:
        logger.info(f"Using cached CoinGecko data for {symbol}")
        df = pd.DataFrame(cached_bars)
        df.set_index("datetime", inplace=True)
        df = df[["open", "high", "low", "close", "volume"]]
        return bt.feeds.PandasData(dataname=df)
    
    try:
        # Apply rate limiting before making request
        _coingecko_rate_limit()
        
        # CoinGecko OHLC endpoint
        response = requests.get(
            f"{COINGECKO_BASE_URL}/coins/{coin_id}/ohlc",
            params={
                "vs_currency": "usd",
                "days": days,
            },
            headers={"Accept": "application/json"},
            timeout=15,
        )
        
        if response.status_code == 429:
            logger.warning(f"CoinGecko rate limited for {symbol}, will retry later")
            return None
        
        if response.status_code != 200:
            logger.warning(f"CoinGecko returned {response.status_code} for {coin_id}")
            return None
        
        data = response.json()
        if not isinstance(data, list) or not data:
            logger.warning(f"No CoinGecko data for {coin_id}")
            return None
        
        # CoinGecko OHLC format: [timestamp, open, high, low, close]
        bars = []
        for entry in data:
            if not isinstance(entry, list) or len(entry) < 5:
                continue
            try:
                ts = entry[0] / 1000  # Convert ms to seconds
                dt = datetime.fromtimestamp(ts)
                bars.append({
                    "datetime": dt,
                    "open": float(entry[1]),
                    "high": float(entry[2]),
                    "low": float(entry[3]),
                    "close": float(entry[4]),
                    "volume": 0,  # CoinGecko OHLC doesn't include volume
                })
            except (TypeError, ValueError, IndexError) as e:
                continue
        
        if not bars:
            logger.warning(f"No valid bars from CoinGecko for {symbol}")
            return None
        
        bars.sort(key=lambda x: x["datetime"])
        
        if len(bars) < 20:
            logger.warning(f"Insufficient CoinGecko data for {symbol}: {len(bars)} bars")
            return None
        
        # Cache the bars
        _set_cached_coingecko(cache_key, bars)
        
        df = pd.DataFrame(bars)
        df.set_index("datetime", inplace=True)
        df = df[["open", "high", "low", "close", "volume"]]
        
        datafeed = bt.feeds.PandasData(dataname=df)
        logger.info(f"Created CoinGecko datafeed for {symbol} ({coin_id}) with {len(df)} bars")
        return datafeed
        
    except Exception as e:
        logger.error(f"Error fetching CoinGecko data for {symbol}: {e}")
        return None


def get_datafeed(symbol: str, asset_class: str, timeframe: str = '1d'):
    """Get appropriate data feed based on asset class"""
    if asset_class == "crypto":
        # Try CoinGecko first for crypto
        cg_feed = get_coingecko_data(symbol, timeframe)
        # Use `is not None` to avoid triggering backtrader's __bool__ method
        if cg_feed is not None:
            return cg_feed
        # Fall back to FMP for crypto
        logger.info(f"Falling back to FMP for crypto {symbol}")
        return get_fmp_data(symbol, asset_class, timeframe)
    else:
        # Use FMP for stocks and forex
        return get_fmp_data(symbol, asset_class, timeframe)
