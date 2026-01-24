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
import base64
import json
import time
import threading
import queue
import re

try:
    from google.cloud import firestore
except Exception:  # pragma: no cover - optional dependency
    firestore = None

logger = logging.getLogger(__name__)

FMP_BASE_URL = "https://financialmodelingprep.com/stable"
METADATA_IDENTITY_URL = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity"
METADATA_HEADERS = {"Metadata-Flavor": "Google"}
_gateway_token = {"value": None, "exp": 0.0}
_price_streamer_cache = {"updated_at": 0.0, "items": {}}
_price_streamer_lock = threading.Lock()
_firestore_client = None

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


def normalize_price_streamer_symbol(symbol: str, asset_class: str):
    if not symbol:
        return None
    cleaned = str(symbol).strip().upper()
    if not cleaned:
        return None

    if asset_class == "stock":
        cleaned = re.sub(r"[^A-Z0-9.-]", "", cleaned)
        if not cleaned or not re.search(r"[A-Z]", cleaned):
            return None
        return cleaned.replace("/", "").replace("-", "")

    if asset_class == "forex":
        if "/" in cleaned or "-" in cleaned:
            parts = cleaned.replace("-", "/").split("/")
            if len(parts) >= 2 and parts[0] and parts[1]:
                return f"{parts[0][:3]}/{parts[1][:3]}"
        compact = re.sub(r"[^A-Z]", "", cleaned)
        if len(compact) >= 6:
            return f"{compact[:3]}/{compact[3:6]}"
        return None

    # crypto
    if "/" in cleaned:
        base, quote = cleaned.split("/", 1)
        if base and quote:
            return f"{base}/{quote}"
    cleaned = cleaned.replace("-", "")
    quotes = ["USDT", "USDC", "USD", "BTC", "ETH", "EUR", "GBP", "JPY"]
    for quote in quotes:
        if cleaned.endswith(quote) and len(cleaned) > len(quote):
            base = cleaned[: -len(quote)]
            return f"{base}/{quote}"
    return cleaned if cleaned else None


def timeframe_to_seconds(timeframe: str):
    mapping = {
        "1min": 60,
        "1m": 60,
        "5m": 300,
        "5min": 300,
        "15m": 900,
        "15min": 900,
        "30m": 1800,
        "30min": 1800,
        "1h": 3600,
        "1hour": 3600,
        "4h": 14400,
        "4hour": 14400,
        "1d": 86400,
        "1day": 86400,
        "1w": 604800,
        "1week": 604800,
    }
    return mapping.get(str(timeframe).lower(), 60)


def _decode_jwt_exp(token: str):
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return 0.0
        payload = parts[1]
        padding = "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload + padding)
        data = json.loads(decoded.decode("utf-8"))
        return float(data.get("exp", 0))
    except Exception:
        return 0.0


def get_gateway_token(audience: str):
    if not audience:
        return None
    now = time.time()
    if _gateway_token["value"] and _gateway_token["exp"] - 60 > now:
        return _gateway_token["value"]
    try:
        response = requests.get(
            METADATA_IDENTITY_URL,
            headers=METADATA_HEADERS,
            params={"audience": audience, "format": "full"},
            timeout=3,
        )
        if response.status_code != 200:
            logger.error("Metadata identity token request failed: %s", response.status_code)
            return None
        token = response.text.strip()
        if not token:
            return None
        _gateway_token["value"] = token
        _gateway_token["exp"] = _decode_jwt_exp(token)
        return token
    except Exception as e:
        logger.error("Metadata identity token fetch failed: %s", e)
        return None


def resolve_gateway_audience(gateway_url: str):
    override = os.environ.get("MARKET_DATA_GATEWAY_AUDIENCE", "").strip()
    if override:
        return override
    return gateway_url


def fetch_gateway_json(path: str, params: dict):
    gateway_url = os.environ.get("MARKET_DATA_GATEWAY_URL", "").rstrip("/")
    if not gateway_url:
        return None
    headers = {}
    auth_enabled = os.environ.get("MARKET_DATA_GATEWAY_AUTH", "true").lower() not in ("false", "0")
    if auth_enabled:
        token = get_gateway_token(resolve_gateway_audience(gateway_url))
        if token:
            headers["Authorization"] = f"Bearer {token}"
    try:
        response = requests.get(
            f"{gateway_url}{path}",
            params=params,
            headers=headers,
            timeout=10,
        )
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        logger.error("Gateway request failed (%s): %s", path, e)
    return None


def fetch_fmp_candles(symbol: str, asset_class: str, timeframe: str = "1d", days: int = 100):
    interval = map_fmp_interval(timeframe)
    normalized = normalize_fmp_symbol(symbol, asset_class)
    if not normalized:
        return None
    payload = None
    payload = fetch_gateway_json(
        "/v1/fmp/candles",
        {
            "symbol": normalized,
            "assetClass": asset_class,
            "interval": interval,
            "limit": days,
        },
    )

    if payload is None:
        api_key = os.environ.get("FMP_API_KEY")
        if not api_key:
            return None
        try:
            if interval in ("1day", "1week"):
                response = requests.get(
                    f"{FMP_BASE_URL}/historical-price-eod/full",
                    params={"symbol": normalized, "apikey": api_key},
                    timeout=10,
                )
            else:
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

    if isinstance(payload, dict):
        data = payload.get("candles") or payload.get("historical") or payload.get("data")
    else:
        data = payload
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

    return bars


def get_fmp_data(symbol: str, asset_class: str, timeframe: str = "1d", days: int = 100):
    bars = fetch_fmp_candles(symbol, asset_class, timeframe, days)
    if not bars:
        return None

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


def get_firestore_client():
    global _firestore_client
    if _firestore_client:
        return _firestore_client
    if not firestore:
        return None
    project_id = (
        os.environ.get("FIREBASE_PROJECT_ID")
        or os.environ.get("GOOGLE_CLOUD_PROJECT")
        or os.environ.get("GCLOUD_PROJECT")
        or "relayorb"
    )
    try:
        _firestore_client = firestore.Client(project=project_id)
        return _firestore_client
    except Exception as err:
        logger.warning("Firestore client init failed: %s", err)
        return None


def get_price_streamer_snapshot(doc_path: str, cache_ttl: float = 1.0):
    client = get_firestore_client()
    if not client or not doc_path:
        return None

    now = time.time()
    with _price_streamer_lock:
        cached_age = now - _price_streamer_cache["updated_at"]
        if cached_age >= 0 and cached_age < max(cache_ttl, 0.1):
            return _price_streamer_cache["items"]

    try:
        doc = client.document(doc_path).get()
        data = doc.to_dict() if doc.exists else {}
        items = {}
        for item in data.get("items", []) if isinstance(data, dict) else []:
            asset_class = item.get("assetClass")
            symbol = item.get("symbol")
            if not asset_class or not symbol:
                continue
            key = f"{asset_class}:{symbol}"
            items[key] = item
        with _price_streamer_lock:
            _price_streamer_cache["updated_at"] = now
            _price_streamer_cache["items"] = items
        return items
    except Exception as err:
        logger.warning("Price streamer snapshot failed: %s", err)
        return None


def get_price_streamer_quote(symbol: str, asset_class: str, cache_ttl: float = 1.0):
    doc_path = os.environ.get("PRICE_STREAMER_DOC_PATH", "market/prices")
    snapshot = get_price_streamer_snapshot(doc_path, cache_ttl)
    if not snapshot:
        return None
    normalized = normalize_price_streamer_symbol(symbol, asset_class)
    if not normalized:
        return None
    key = f"{asset_class}:{normalized}"
    entry = snapshot.get(key)
    if not entry:
        return None
    price = entry.get("price")
    if price is None:
        return None
    return {
        "price": float(price),
        "bid": entry.get("bid"),
        "ask": entry.get("ask"),
        "volume": entry.get("volume"),
        "updatedAt": entry.get("updatedAt") or entry.get("updated_at"),
        "source": "price_streamer",
    }


def get_gateway_quote(symbol: str, asset_class: str):
    normalized = normalize_fmp_symbol(symbol, asset_class)
    if not normalized:
        return None
    payload = fetch_gateway_json(
        "/v1/fmp/quote",
        {"symbol": normalized, "assetClass": asset_class},
    )
    if not payload or not isinstance(payload, dict):
        return None
    price = payload.get("price")
    if price is None:
        return None
    return {
        "price": float(price),
        "bid": payload.get("bid"),
        "ask": payload.get("ask"),
        "volume": payload.get("volume"),
        "updatedAt": payload.get("timestamp") or payload.get("updatedAt"),
        "source": payload.get("source") or "gateway",
    }


class LivePriceData(bt.feeds.DataBase):
    params = (
        ("symbol", None),
        ("asset_class", "stock"),
        ("timeframe", "1m"),
        ("poll_interval", 5),
        ("history_days", 120),
        ("price_source", "price_streamer"),
        ("price_cache_ttl", 1.0),
    )

    def __init__(self):
        super().__init__()
        self._queue = queue.Queue()
        self._stop = threading.Event()
        self._worker = None
        self._current_bucket = None
        self._current_bar = None
        self._last_price = None
        self._bar_seconds = timeframe_to_seconds(self.p.timeframe)

    def islive(self):
        return True

    def start(self):
        super().start()
        self._seed_history()
        self._worker = threading.Thread(target=self._poll_loop, daemon=True)
        self._worker.start()

    def stop(self):
        self._stop.set()
        if self._worker:
            self._worker.join(timeout=2)
        super().stop()

    def _load(self):
        if self._stop.is_set():
            return False
        try:
            bar = self._queue.get(timeout=1.0)
        except queue.Empty:
            return None

        self.lines.datetime[0] = bt.date2num(bar["datetime"])
        self.lines.open[0] = bar["open"]
        self.lines.high[0] = bar["high"]
        self.lines.low[0] = bar["low"]
        self.lines.close[0] = bar["close"]
        self.lines.volume[0] = bar["volume"]
        return True

    def _seed_history(self):
        symbol = self.p.symbol
        if not symbol:
            return
        bars = fetch_fmp_candles(
            symbol,
            self.p.asset_class,
            self.p.timeframe,
            self.p.history_days,
        )
        if not bars:
            return
        if len(bars) > 1:
            for bar in bars[:-1]:
                self._queue.put(bar)
        last = bars[-1]
        self._last_price = last["close"]
        last_bucket = int(last["datetime"].timestamp() // self._bar_seconds) * self._bar_seconds
        self._current_bucket = last_bucket
        self._current_bar = {
            "datetime": datetime.utcfromtimestamp(last_bucket),
            "open": last["open"],
            "high": last["high"],
            "low": last["low"],
            "close": last["close"],
            "volume": last["volume"],
        }

    def _poll_loop(self):
        symbol = self.p.symbol
        if not symbol:
            return
        asset_class = self.p.asset_class
        poll_seconds = max(1, int(self.p.poll_interval))
        price_source = str(self.p.price_source or "price_streamer").lower()

        while not self._stop.is_set():
            quote = None
            if price_source in ("price_streamer", "streamer", "firestore"):
                quote = get_price_streamer_quote(
                    symbol,
                    asset_class,
                    cache_ttl=float(self.p.price_cache_ttl),
                )
            if not quote:
                quote = get_gateway_quote(symbol, asset_class)
            now = datetime.utcnow()
            if quote:
                price = quote.get("price")
                volume = quote.get("volume") or 0
                if price is not None:
                    self._last_price = float(price)
                    self._update_bar(now, float(price), volume)
            self._roll_forward(now)
            time.sleep(poll_seconds)

    def _update_bar(self, now: datetime, price: float, volume: float):
        bucket = int(now.timestamp() // self._bar_seconds) * self._bar_seconds
        if self._current_bucket is None:
            self._current_bucket = bucket
            self._current_bar = self._make_bar(bucket, price, volume)
            return
        if bucket == self._current_bucket:
            self._apply_tick(price, volume)
            return
        if bucket > self._current_bucket:
            self._flush_current_bar()
            self._fill_gaps(self._current_bucket + self._bar_seconds, bucket)
            self._current_bucket = bucket
            self._current_bar = self._make_bar(bucket, price, volume)

    def _roll_forward(self, now: datetime):
        if self._current_bucket is None:
            return
        target_bucket = int(now.timestamp() // self._bar_seconds) * self._bar_seconds
        if target_bucket <= self._current_bucket:
            return
        self._flush_current_bar()
        self._fill_gaps(self._current_bucket + self._bar_seconds, target_bucket)
        self._current_bucket = target_bucket
        if self._last_price is not None:
            self._current_bar = self._make_bar(target_bucket, self._last_price, 0)

    def _apply_tick(self, price: float, volume: float):
        if not self._current_bar:
            return
        self._current_bar["high"] = max(self._current_bar["high"], price)
        self._current_bar["low"] = min(self._current_bar["low"], price)
        self._current_bar["close"] = price
        self._current_bar["volume"] += int(volume or 0)

    def _make_bar(self, bucket: int, price: float, volume: float):
        return {
            "datetime": datetime.utcfromtimestamp(bucket),
            "open": price,
            "high": price,
            "low": price,
            "close": price,
            "volume": int(volume or 0),
        }

    def _flush_current_bar(self):
        if self._current_bar:
            self._queue.put(self._current_bar)
        self._current_bar = None

    def _fill_gaps(self, start_bucket: int, end_bucket: int):
        if self._last_price is None:
            return
        bucket = start_bucket
        while bucket < end_bucket:
            self._queue.put(self._make_bar(bucket, self._last_price, 0))
            bucket += self._bar_seconds

def get_datafeed(symbol: str, asset_class: str, timeframe: str = '1d', days: int = 100):
    """Get appropriate data feed based on asset class"""
    return get_fmp_data(symbol, asset_class, timeframe, days)


def get_live_datafeed(
    symbol: str,
    asset_class: str,
    timeframe: str = "1m",
    history_days: int = 120,
    poll_interval: int = 5,
    price_source: str = "price_streamer",
):
    return LivePriceData(
        symbol=symbol,
        asset_class=asset_class,
        timeframe=timeframe,
        history_days=history_days,
        poll_interval=poll_interval,
        price_source=price_source,
    )
