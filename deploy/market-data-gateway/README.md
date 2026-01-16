# Market Data Gateway

Single entry point for market data vendor calls (FMP, Marketaux).

Set `MARKET_DATA_GATEWAY_URL` in other services to point at this service.

## Environment

- `FMP_API_KEY` (required for `/v1/fmp/*`)
- `MARKETAUX_API_KEY` (required for `/v1/marketaux/news`)
- `FMP_BASE_URL` (optional)
- `FMP_STABLE_BASE_URL` (optional)
- `MARKETAUX_BASE_URL` (optional)
- `MDG_CACHE_TTL_MS` (default: 15000)
- `MDG_CANDLES_TTL_MS` (default: 60000)
- `MDG_MARKETS_TTL_MS` (default: 60000)
- `MDG_NEWS_TTL_MS` (default: 120000)
- `MDG_STOCK_LIST_TTL_MS` (default: 21600000)
- `MDG_CRYPTO_QUOTE_CONCURRENCY` (default: 6)
- `PORT` (default: 8080)

## Endpoints

- `GET /healthz` / `GET /readyz`
- `GET /ping/fmp`
- `GET /ping/marketaux`
- `GET /v1/fmp/quote?symbol=...&assetClass=stock|forex|crypto`
- `GET /v1/fmp/quotes?symbols=...&assetClass=stock|forex|crypto`
- `GET /v1/fmp/candles?symbol=...&assetClass=stock|forex|crypto&interval=15min&limit=120`
- `GET /v1/fmp/stock-list`
- `GET /v1/fmp/biggest-gainers?limit=100`
- `GET /v1/fmp/biggest-losers?limit=100`
- `GET /v1/fmp/most-actives?limit=100`
- `GET /v1/fmp/search-symbol?query=...`
- `GET /v1/fmp/search-name?query=...`
- `GET /v1/fmp/crypto?limit=50`
- `GET /v1/fmp/indicators?symbol=...&indicator=rsi&period=20&timeframe=15min&limit=100`
- `GET /v1/fmp/profile?symbol=...`
- `GET /v1/fmp/news?symbol=...&limit=20`
- `GET /v1/fmp/price-target?symbol=...`
- `GET /v1/fmp/ratings-snapshot?symbol=...`
- `GET /v1/fmp/ratings-historical?symbol=...`
- `GET /v1/fmp/grades?symbol=...`
- `GET /v1/fmp/grades-historical?symbol=...`
- `GET /v1/fmp/grades-consensus?symbol=...`
- `GET /v1/marketaux/news?symbols=AAPL,TSLA&entity_types=equity&limit=20`
