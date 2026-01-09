"""
Data feed providers for Backtrader
"""

import backtrader as bt
from datetime import datetime, timedelta
import requests
import os
import logging

logger = logging.getLogger(__name__)

FMP_BASE_URL = "https://financialmodelingprep.com/stable"


def parse_fmp_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
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
    api_key = os.environ.get("FMP_API_KEY")
    if not api_key:
        return None

    interval = map_fmp_interval(timeframe)
    normalized = normalize_fmp_symbol(symbol, asset_class)
    if not normalized:
        return None

    url = f"{FMP_BASE_URL}/historical-chart/{interval}"
    params = {
        "symbol": normalized,
        "apikey": api_key,
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        if response.status_code != 200:
            return None
        data = response.json()
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
            logger.warning(f"No FMP bars retrieved for {symbol}")
            return None

        if len(bars) < 20:
            logger.warning(f"Insufficient FMP data for {symbol}: {len(bars)} bars")
            return None

        import pandas as pd
        df = pd.DataFrame(bars)
        df.set_index("datetime", inplace=True)
        df = df[["open", "high", "low", "close", "volume"]]

        try:
            datafeed = bt.feeds.PandasData(dataname=df)
            logger.info(f"Created FMP datafeed for {symbol} with {len(df)} bars")
            return datafeed
        except Exception as e:
            logger.error(f"Error creating FMP datafeed for {symbol}: {e}", exc_info=True)
            return None
    except Exception as e:
        logger.error(f"Error fetching FMP data: {e}")
        return None

def get_alpha_vantage_data(symbol: str, timeframe: str = '1d', days: int = 100):
    """Get data from Alpha Vantage API"""
    api_key = os.environ.get('ALPHAVANTAGE_API_KEY')
    if not api_key:
        return None
    
    function_map = {
        '1d': 'TIME_SERIES_DAILY',
        '1w': 'TIME_SERIES_WEEKLY',
    }
    
    function = function_map.get(timeframe, 'TIME_SERIES_DAILY')
    url = f"https://www.alphavantage.co/query"
    params = {
        'function': function,
        'symbol': symbol,
        'apikey': api_key,
        'outputsize': 'full' if days > 100 else 'compact'
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if 'Error Message' in data or 'Note' in data:
            return None
        
        series_key = 'Time Series (Daily)' if 'Time Series (Daily)' in data else 'Weekly Time Series'
        if series_key not in data:
            return None
        
        time_series = data[series_key]
        
        import pandas as pd
        bars = []
        for date_str, values in sorted(time_series.items()):
            dt = datetime.strptime(date_str, '%Y-%m-%d')
            bars.append({
                'datetime': dt,
                'open': float(values['1. open']),
                'high': float(values['2. high']),
                'low': float(values['3. low']),
                'close': float(values['4. close']),
                'volume': int(float(values['5. volume']))
            })
        
        bars.reverse()
        if not bars:
            logger.warning(f"No bars retrieved for {symbol}")
            return None
        
        if len(bars) < 20:  # Need at least 20 bars for indicators
            logger.warning(f"Insufficient data for {symbol}: {len(bars)} bars")
            return None
        
        # Create DataFrame with datetime as index
        df = pd.DataFrame(bars)
        df.set_index('datetime', inplace=True)
        
        # Ensure DataFrame columns are in the correct order for Backtrader
        df = df[['open', 'high', 'low', 'close', 'volume']]
        
        # Create Backtrader data feed from pandas DataFrame
        # PandasData automatically detects columns named: open, high, low, close, volume
        # It uses the index as datetime by default
        try:
            datafeed = bt.feeds.PandasData(dataname=df)
            logger.info(f"Created datafeed for {symbol} with {len(df)} bars")
            return datafeed
        except Exception as e:
            logger.error(f"Error creating Backtrader datafeed for {symbol}: {e}", exc_info=True)
            return None
        
    except Exception as e:
        logger.error(f"Error fetching Alpha Vantage data: {e}")
        return None


def normalize_fx_pair(symbol: str):
    if not symbol:
        return None
    normalized = str(symbol).upper().replace(' ', '').replace('-', '/')
    if '/' in normalized:
        parts = [part for part in normalized.split('/') if part]
        if len(parts) == 2 and len(parts[0]) == 3 and len(parts[1]) == 3:
            return parts[0], parts[1]
    if len(normalized) == 6:
        return normalized[:3], normalized[3:]
    return None


def get_alpha_vantage_fx_data(pair: str, timeframe: str = '1d', days: int = 100):
    """Get FX data from Alpha Vantage API"""
    api_key = os.environ.get('ALPHAVANTAGE_API_KEY')
    if not api_key:
        return None

    parsed = normalize_fx_pair(pair)
    if not parsed:
        logger.warning(f"Invalid FX pair format: {pair}")
        return None

    base, quote = parsed
    function_map = {
        '1d': 'FX_DAILY',
        '1w': 'FX_WEEKLY',
    }

    function = function_map.get(timeframe, 'FX_DAILY')
    url = f"https://www.alphavantage.co/query"
    params = {
        'function': function,
        'from_symbol': base,
        'to_symbol': quote,
        'apikey': api_key,
        'outputsize': 'full' if days > 100 else 'compact'
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()

        if 'Error Message' in data or 'Note' in data:
            return None

        series_key = None
        if 'Time Series FX (Daily)' in data:
            series_key = 'Time Series FX (Daily)'
        elif 'Time Series FX (Weekly)' in data:
            series_key = 'Time Series FX (Weekly)'

        if not series_key:
            return None

        time_series = data[series_key]

        import pandas as pd
        bars = []
        for date_str, values in sorted(time_series.items()):
            dt = datetime.strptime(date_str, '%Y-%m-%d')
            bars.append({
                'datetime': dt,
                'open': float(values['1. open']),
                'high': float(values['2. high']),
                'low': float(values['3. low']),
                'close': float(values['4. close']),
                'volume': 0
            })

        bars.reverse()
        if not bars:
            logger.warning(f"No FX bars retrieved for {pair}")
            return None

        if len(bars) < 20:
            logger.warning(f"Insufficient FX data for {pair}: {len(bars)} bars")
            return None

        df = pd.DataFrame(bars)
        df.set_index('datetime', inplace=True)
        df = df[['open', 'high', 'low', 'close', 'volume']]

        try:
            datafeed = bt.feeds.PandasData(dataname=df)
            logger.info(f"Created FX datafeed for {pair} with {len(df)} bars")
            return datafeed
        except Exception as e:
            logger.error(f"Error creating FX datafeed for {pair}: {e}", exc_info=True)
            return None

    except Exception as e:
        logger.error(f"Error fetching Alpha Vantage FX data: {e}")
        return None


def get_datafeed(symbol: str, asset_class: str, timeframe: str = '1d'):
    """Get appropriate data feed"""
    fmp_feed = get_fmp_data(symbol, asset_class, timeframe)
    if fmp_feed is not None:
        return fmp_feed
    if asset_class == 'forex':
        return get_alpha_vantage_fx_data(symbol, timeframe)
    return get_alpha_vantage_data(symbol, timeframe)
