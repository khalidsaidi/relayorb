# Market Data Gateway Endpoint Audit

## Gateway URL
All services should use `MARKET_DATA_GATEWAY_URL` environment variable.

## Active Endpoints

| Endpoint | Used By | Status |
|----------|---------|--------|
| `/v1/fmp/candles` | market-intel, signal-evaluator, chart-proxy, frontend | Active |
| `/v1/fmp/quote` | price-streamer, frontend | Active |
| `/v1/fmp/quotes` | price-streamer | Active |
| `/v1/fmp/crypto` | market-intel | Active |
| `/v1/fmp/stock-list` | market-intel | Active |
| `/v1/fmp/news` | market-intel | Active |
| `/v1/fmp/profile` | market-intel, frontend | Active |
| `/v1/fmp/shares-float` | market-intel | Active |
| `/v1/fmp/grades-consensus` | market-intel | Active |
| `/v1/fmp/biggest-gainers` | market-intel | Active |
| `/v1/fmp/biggest-losers` | market-intel | Active |
| `/v1/fmp/most-actives` | market-intel | Active |
| `/v1/fmp/price-target` | frontend | Active |
| `/v1/fmp/ratings-snapshot` | frontend | Active |
| `/v1/fmp/search-symbol` | frontend | Active |
| `/v1/fmp/search-name` | frontend | Active |
| `/v1/fmp/indicators` | frontend | Active |
| `/v1/marketaux/news` | market-intel | Active |

## Service Configuration

| Service | Config Variable | File |
|---------|-----------------|------|
| market-intel | `MARKET_DATA_GATEWAY_URL` | deploy/market-intel/src/index.js |
| price-streamer | `MARKET_DATA_GATEWAY_URL` | deploy/price-streamer/src/index.js |
| signal-evaluator | `MARKET_DATA_GATEWAY_URL` | deploy/signal-evaluator/src/index.js |
| chart-proxy | `MARKET_DATA_GATEWAY_URL` | deploy/chart-proxy/src/index.js |
| backtrader | `MARKET_DATA_GATEWAY_URL` | deploy/bot-host/backtrader/datafeeds.py |
| frontend | `VITE_MARKET_DATA_GATEWAY_URL` | src/features/market/use-fmp-data.ts |

## Notes
- All services consistently use the same environment variable
- Frontend uses Vite prefix (`VITE_`) for client-side access
