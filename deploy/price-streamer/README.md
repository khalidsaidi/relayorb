# Price Streamer (Live Prices Service)

Long-running service that pushes near real-time prices into Redis (hot store) and Firestore `market/prices`.
It uses Binance WebSocket for crypto and the market-data-gateway for FMP quotes (fallbacks to direct FMP if no gateway is configured).

## Environment variables
- `FIREBASE_PROJECT_ID` (optional; defaults to Cloud Run project)
- `MARKET_DATA_GATEWAY_URL` (recommended for centralized market data)
- `FMP_API_KEY` (optional fallback for stocks/FX when no gateway)
- `BINANCE_WS_BASE` (optional; default: `wss://stream.binance.com:9443`)
- `REDIS_URL` (recommended for hot prices + snapshots)
- `REDIS_PREFIX` (default: `relayorb`)
- `REDIS_LATEST_TTL_SECONDS` (default: 120)
- `REDIS_SNAPSHOT_TTL_SECONDS` (default: 1800)
- `REDIS_SNAPSHOT_MS` (default: 60000)
- `WATCHLIST_REFRESH_MS` (default: 60000)
- `CRYPTO_POLL_MS` (default: 15000)
- `STOCK_POLL_MS` (default: 15000)
- `FOREX_POLL_MS` (default: 15000)
- `PRICE_WRITE_MS` (default: 2000)
- `PRICE_HISTORY_MINUTES` (default: 10; used for 1m/5m deltas + volatility)
- `PRICE_STREAM_MAX_SYMBOLS` (default: 120 per asset class)
- `PORT` (default: 8080, health endpoint listener)
- `RUN_ID` (optional; tag for logs/metadata)
- `FIRESTORE_RUN_FIELD` (default: `runId`)

## Watchlist sources
- `market/hotTrades` (always streamed)
- `market/actionBoard` (always streamed)
- Open paper positions (collection group `positions`)
- `market/universe` (only when mode includes the universe)
- `market/streamSymbols` (UI-driven display list)

## Redis output
- `prices:latest` JSON payload with `items` array and `updatedAt`.
- `prices:snapshot:{timestamp}` ring buffer for 15m mover windows.
- `prices:snapshots` sorted set index.

## Firestore output
- `market/prices` with `items` array and `updatedAt`.
- Each item includes `change1m`, `change5m`, `volatility1m`, `volatility5m`, and `spreadPct` when available.

## Health check
`GET /healthz` or `GET /readyz` returns a small JSON payload with watchlist counts and last write time.

## Local run
```bash
cd deploy/price-streamer
FIREBASE_PROJECT_ID=relayorb MARKET_DATA_GATEWAY_URL=... REDIS_URL=redis://localhost:6379 FMP_API_KEY=... npm start
```
