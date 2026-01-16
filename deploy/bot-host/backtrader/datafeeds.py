"""
Data feed providers for Backtrader
Supports: FMP (stocks/forex/crypto)
"""

import backtrader as bt
from datetime import datetime
import requests
import os
import logging
import pandas as pd

logger = logging.getLogger(__name__)

FMP_BASE_URL = "https://financialmodelingprep.com/stable"

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

def get_datafeed(symbol: str, asset_class: str, timeframe: str = '1d'):
    """Get appropriate data feed based on asset class"""
    return get_fmp_data(symbol, asset_class, timeframe)
