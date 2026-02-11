from __future__ import annotations

import json
from typing import Any, Literal

import pandas as pd
import tvscreener as tvs
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field as PydanticField
from tvscreener import BondField, CoinField, CryptoField, ForexField, FuturesField, StockField
from tvscreener.field import Market
from tvscreener.field.presets import ALL_PRESETS, get_preset, list_presets
from tvscreener.filter import FilterOperator

app = FastAPI(
    title="RelayOrb TVScreener API",
    version="0.1.0",
    description="HTTP wrapper for deepentropy/tvscreener with field discovery, presets, custom queries, and movers.",
)

AssetType = Literal["stock", "crypto", "forex", "bond", "futures", "coin"]
DiscoveryType = Literal["gainers", "losers", "active"]

FILTER_OP_MAP: dict[str, FilterOperator] = {
    ">=": FilterOperator.ABOVE_OR_EQUAL,
    ">": FilterOperator.ABOVE,
    "<=": FilterOperator.BELOW_OR_EQUAL,
    "<": FilterOperator.BELOW,
    "==": FilterOperator.EQUAL,
    "!=": FilterOperator.NOT_EQUAL,
    "in_range": FilterOperator.IN_RANGE,
    "not_in_range": FilterOperator.NOT_IN_RANGE,
    "match": FilterOperator.MATCH,
    "crosses": FilterOperator.CROSSES,
    "crosses_up": FilterOperator.CROSSES_UP,
    "crosses_down": FilterOperator.CROSSES_DOWN,
}

ASSET_CONFIG: dict[str, dict[str, Any]] = {
    "stock": {"field_class": StockField, "screener_class": tvs.StockScreener},
    "crypto": {"field_class": CryptoField, "screener_class": tvs.CryptoScreener},
    "forex": {"field_class": ForexField, "screener_class": tvs.ForexScreener},
    "bond": {"field_class": BondField, "screener_class": tvs.BondScreener},
    "futures": {"field_class": FuturesField, "screener_class": tvs.FuturesScreener},
    "coin": {"field_class": CoinField, "screener_class": tvs.CoinScreener},
}

DEFAULT_FIELDS: dict[str, list[str]] = {
    "stock": ["NAME", "PRICE", "CHANGE_PERCENT", "VOLUME", "MARKET_CAPITALIZATION", "SECTOR"],
    "crypto": ["NAME", "PRICE", "CHANGE_PERCENT", "VOLUME_24H_IN_USD", "MARKET_CAPITALIZATION"],
    "forex": ["NAME", "PRICE", "CHANGE_PERCENT", "VOLUME"],
    "bond": ["NAME", "CLOSE", "CHANGE", "VOLUME"],
    "futures": ["NAME", "CLOSE", "CHANGE", "VOLUME"],
    "coin": ["NAME", "CLOSE", "CHANGE", "VOLUME"],
}

DISCOVERY_SORT: dict[str, dict[str, str]] = {
    "stock": {"gainers": "CHANGE_PERCENT", "losers": "CHANGE_PERCENT", "active": "VOLUME"},
    "crypto": {"gainers": "CHANGE_PERCENT", "losers": "CHANGE_PERCENT", "active": "VOLUME_24H_IN_USD"},
    "forex": {"gainers": "CHANGE_PERCENT", "losers": "CHANGE_PERCENT", "active": "VOLUME"},
    "bond": {"gainers": "CHANGE", "losers": "CHANGE", "active": "VOLUME"},
    "futures": {"gainers": "CHANGE", "losers": "CHANGE", "active": "VOLUME"},
    "coin": {"gainers": "CHANGE", "losers": "CHANGE", "active": "VOLUME"},
}


class FilterCondition(BaseModel):
    field: str
    op: Literal[
        ">=",
        ">",
        "<=",
        "<",
        "==",
        "!=",
        "in_range",
        "not_in_range",
        "match",
        "crosses",
        "crosses_up",
        "crosses_down",
    ] = ">="
    value: Any


class QueryRequest(BaseModel):
    asset_type: AssetType = "stock"
    fields: list[str] | None = None
    filters: list[FilterCondition] | None = None
    sort_by: str | None = None
    ascending: bool = False
    limit: int = PydanticField(default=50, ge=1, le=500)
    offset: int = PydanticField(default=0, ge=0)
    market: str | None = "AMERICA"
    search: str | None = None


def _asset_config(asset_type: AssetType) -> dict[str, Any]:
    return ASSET_CONFIG[asset_type]


def _field_enum(field_name: str, asset_type: AssetType):
    cfg = _asset_config(asset_type)
    field_class = cfg["field_class"]
    normalized = field_name.upper().replace(" ", "_")
    if hasattr(field_class, normalized):
        return getattr(field_class, normalized)
    results = field_class.search(normalized)
    return results[0] if results else None


def _field_info(field: Any) -> dict[str, Any]:
    raw = field.value if isinstance(field.value, tuple) else ()
    return {
        "name": field.name,
        "label": field.label,
        "api_field": field.field_name,
        "format": field.format,
        "is_technical": bool(raw[3]) if len(raw) > 3 else bool(getattr(field, "interval", False)),
        "has_history": bool(getattr(field, "historical", False)),
    }


def _rows_from_df(df: pd.DataFrame) -> list[dict[str, Any]]:
    if df is None or df.empty:
        return []
    safe = df.where(pd.notna(df), None)
    records = safe.to_dict(orient="records")
    # Ensure numpy/pandas scalars are JSON-safe.
    return json.loads(json.dumps(records, default=str))


def _resolve_market(market: str | None) -> Market | None:
    if not market:
        return None
    token = market.strip().upper()
    if token in Market.__members__:
        return Market[token]
    for item in Market:
        if item.value.lower() == market.strip().lower():
            return item
    return None


def _apply_query(req: QueryRequest):
    cfg = _asset_config(req.asset_type)
    screener = cfg["screener_class"]()
    warnings: list[str] = []

    if req.asset_type == "stock":
        resolved_market = _resolve_market(req.market)
        if resolved_market and hasattr(screener, "set_markets"):
            try:
                screener.set_markets(resolved_market)
            except Exception as exc:  # pragma: no cover - defensive
                warnings.append(f"market ignored: {exc}")

    if req.search:
        screener.search(req.search)

    requested_fields = req.fields or DEFAULT_FIELDS[req.asset_type]
    resolved_fields = []
    for name in requested_fields:
        enum_field = _field_enum(name, req.asset_type)
        if enum_field is None:
            warnings.append(f"unknown field: {name}")
            continue
        resolved_fields.append(enum_field)
    if resolved_fields:
        screener.select(*resolved_fields)

    if req.filters:
        for cond in req.filters:
            enum_field = _field_enum(cond.field, req.asset_type)
            if enum_field is None:
                warnings.append(f"unknown filter field: {cond.field}")
                continue
            op = FILTER_OP_MAP.get(cond.op)
            if op is None:
                warnings.append(f"unknown operator: {cond.op}")
                continue
            if cond.op in {"in_range", "not_in_range"} and not isinstance(cond.value, (list, tuple)):
                warnings.append(f"{cond.field} expects [min,max] for {cond.op}")
                continue
            try:
                screener.where(enum_field, op, cond.value)
            except Exception as exc:
                warnings.append(f"filter rejected ({cond.field}): {exc}")

    if req.sort_by:
        sort_field = _field_enum(req.sort_by, req.asset_type)
        if sort_field is None:
            warnings.append(f"unknown sort field: {req.sort_by}")
        else:
            screener.sort_by(sort_field, ascending=req.ascending)

    start = req.offset
    end = req.offset + req.limit
    screener.set_range(start, end)

    try:
        df = screener.get()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"tvscreener query failed: {exc}") from exc

    return {
        "asset_type": req.asset_type,
        "market": req.market,
        "rows": _rows_from_df(df.head(req.limit)),
        "count": int(df.shape[0]),
        "columns": list(df.columns),
        "warnings": warnings,
    }


@app.get("/")
def root():
    return {
        "service": "tvscreener",
        "status": "ok",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "hint": "Use /api/v1/query for generic screening or /api/v1/fields/search to discover fields.",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "tvscreener",
        "version": "0.1.0",
        "supported_assets": list(ASSET_CONFIG.keys()),
    }


@app.get("/api/v1/asset-types")
def asset_types():
    return {
        "assets": [
            {"id": k, "label": k.title()} for k in ASSET_CONFIG.keys()
        ]
    }


@app.get("/api/v1/markets")
def markets():
    return {
        "markets": [{"name": m.name, "value": m.value} for m in Market]
    }


@app.get("/api/v1/fields/search")
def fields_search(
    q: str = Query(..., min_length=1),
    asset_type: AssetType = "stock",
    limit: int = Query(default=50, ge=1, le=500),
):
    field_class = _asset_config(asset_type)["field_class"]
    fields = field_class.search(q)
    return {
        "asset_type": asset_type,
        "query": q,
        "count": len(fields[:limit]),
        "results": [_field_info(f) for f in fields[:limit]],
    }


@app.get("/api/v1/fields/categories")
def fields_categories(asset_type: AssetType = "stock"):
    keywords = [
        "price",
        "volume",
        "market_cap",
        "sector",
        "earnings",
        "dividend",
        "rsi",
        "macd",
        "moving_average",
        "bollinger",
        "recommend",
    ]
    field_class = _asset_config(asset_type)["field_class"]
    grouped: dict[str, list[dict[str, Any]]] = {}
    for keyword in keywords:
        matches = field_class.search(keyword)[:8]
        if not matches:
            continue
        grouped[keyword] = [_field_info(m) for m in matches]
    return {"asset_type": asset_type, "categories": grouped}


@app.get("/api/v1/presets")
def presets(include_fields: bool = False):
    names = sorted(list_presets())
    if not include_fields:
        return {"count": len(names), "presets": names}

    detailed = []
    for name in names:
        items = get_preset(name)
        detailed.append(
            {
                "name": name,
                "fields": [{"name": f.name, "label": f.label, "api_field": f.field_name} for f in items],
            }
        )
    return {"count": len(detailed), "presets": detailed}


@app.get("/api/v1/presets/{preset_name}")
def preset_by_name(preset_name: str):
    if preset_name not in ALL_PRESETS:
        raise HTTPException(status_code=404, detail=f"Unknown preset: {preset_name}")
    preset = get_preset(preset_name)
    return {
        "name": preset_name,
        "count": len(preset),
        "fields": [{"name": f.name, "label": f.label, "api_field": f.field_name} for f in preset],
    }


@app.post("/api/v1/query")
def query(req: QueryRequest):
    return _apply_query(req)


@app.get("/api/v1/discovery/{kind}")
def discovery(
    kind: DiscoveryType,
    asset_type: AssetType = "stock",
    market: str = "AMERICA",
    limit: int = Query(default=50, ge=1, le=300),
):
    sort_field = DISCOVERY_SORT[asset_type][kind]
    req = QueryRequest(
        asset_type=asset_type,
        market=market,
        limit=limit,
        sort_by=sort_field,
        ascending=(kind == "losers"),
        fields=DEFAULT_FIELDS[asset_type],
    )
    return _apply_query(req)


@app.get("/api/v1/stocks/search")
def stocks_search(
    min_price: float | None = None,
    max_price: float | None = None,
    min_market_cap: float | None = None,
    max_market_cap: float | None = None,
    search: str | None = None,
    market: str = "AMERICA",
    limit: int = Query(default=100, ge=1, le=300),
):
    filters: list[FilterCondition] = []
    if min_price is not None:
        filters.append(FilterCondition(field="PRICE", op=">=", value=min_price))
    if max_price is not None:
        filters.append(FilterCondition(field="PRICE", op="<=", value=max_price))
    if min_market_cap is not None:
        filters.append(FilterCondition(field="MARKET_CAPITALIZATION", op=">=", value=min_market_cap))
    if max_market_cap is not None:
        filters.append(FilterCondition(field="MARKET_CAPITALIZATION", op="<=", value=max_market_cap))

    req = QueryRequest(
        asset_type="stock",
        market=market,
        search=search,
        limit=limit,
        fields=DEFAULT_FIELDS["stock"],
        filters=filters or None,
        sort_by="MARKET_CAPITALIZATION",
        ascending=False,
    )
    return _apply_query(req)
