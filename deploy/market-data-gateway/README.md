# Market Data Gateway

Single entry point for market data vendor calls (FMP, Binance, CoinGecko, Marketaux).

Set `MARKET_DATA_GATEWAY_URL` in other services to point at this service.

## Environment

- `FMP_API_KEY` (required for `/v1/fmp/*`)
- `MARKETAUX_API_KEY` (required for `/v1/marketaux/news`)
- `FMP_BASE_URL` (optional)
- `FMP_STABLE_BASE_URL` (optional)
- `BINANCE_BASE_URL` (optional)
- `COINGECKO_BASE_URL` (optional)
- `MARKETAUX_BASE_URL` (optional)
- `MDG_CACHE_TTL_MS` (default: 15000)
- `MDG_CANDLES_TTL_MS` (default: 60000)
- `MDG_MARKETS_TTL_MS` (default: 60000)
- `MDG_NEWS_TTL_MS` (default: 120000)
- `MDG_STOCK_LIST_TTL_MS` (default: 21600000)
- `PORT` (default: 8080)

## Endpoints

- `GET /healthz` / `GET /readyz`
- `GET /ping/fmp`
- `GET /ping/binance`
- `GET /ping/coingecko`
- `GET /ping/marketaux`
- `GET /v1/fmp/quote?symbol=...&assetClass=stock|forex|crypto`
- `GET /v1/fmp/candles?symbol=...&assetClass=stock|forex|crypto&interval=15min&limit=120`
- `GET /v1/fmp/stock-list`
- `GET /v1/binance/ticker?symbol=BTCUSDT`
- `GET /v1/binance/klines?symbol=BTCUSDT&interval=1m&limit=2`
- `GET /v1/coingecko/markets?vs_currency=usd&order=volume_desc&per_page=50&page=1&price_change_percentage=1h,24h,7d`
- `GET /v1/marketaux/news?symbols=AAPL,TSLA&entity_types=equity&limit=20`
