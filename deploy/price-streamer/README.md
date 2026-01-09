# Price Streamer (Live Prices Service)

Long-running service that pushes near real-time prices into Firestore `market/prices`.
It uses Binance WebSocket for crypto (falls back to FMP polling if blocked) and FMP polling for stocks/FX.

## Environment variables
- `FIREBASE_PROJECT_ID` (optional; defaults to Cloud Run project)
- `FMP_API_KEY` (required for stocks/FX)
- `BINANCE_WS_BASE` (optional; default: `wss://stream.binance.com:9443`)
- `WATCHLIST_REFRESH_MS` (default: 60000)
- `CRYPTO_POLL_MS` (default: 15000)
- `STOCK_POLL_MS` (default: 15000)
- `FOREX_POLL_MS` (default: 15000)
- `PRICE_WRITE_MS` (default: 2000)
- `PRICE_HISTORY_MINUTES` (default: 10; used for 1m/5m deltas + volatility)
- `PRICE_STREAM_MAX_SYMBOLS` (default: 120 per asset class)
- `PORT` (default: 8080, health endpoint listener)

## Watchlist sources
- `market/hotTrades` (always streamed)
- `market/actionBoard` (always streamed)
- Open paper positions (collection group `positions`)
- `market/universe` (only when mode includes the universe)
- `market/streamSymbols` (UI-driven display list)

## Firestore output
- `market/prices` with `items` array and `updatedAt`.
- Each item includes `change1m`, `change5m`, `volatility1m`, `volatility5m`, and `spreadPct` when available.

## Health check
`GET /healthz` returns a small JSON payload with watchlist counts and last write time.

## Local run
```bash
cd deploy/price-streamer
FIREBASE_PROJECT_ID=relayorb FMP_API_KEY=... npm start
```
