# Signal Evaluator Worker (Cloud Run Job)

This worker evaluates bot signals against real market prices and writes accuracy metrics
to Firestore so the UI can display prediction accuracy and best-performing bots.

## Data sources
- Crypto: Binance klines via market-data-gateway
- Stocks: FMP daily + intraday via market-data-gateway
- Forex: FMP daily + intraday via market-data-gateway
- Live snapshot: Redis `prices:latest` (fallback to Firestore `market/prices`)

## Firestore output
- `bots/{botId}/signals/{signalId}`: `evaluation` field with horizon results
- `analytics/signalPerformance`: aggregate accuracy + top bots by horizon
- `analytics/signalPerformance`: asset-class + symbol rankings by horizon
- `bots/{botId}/analytics/signalPerformance`: per-bot accuracy + symbol rankings

## Environment variables
- `FIREBASE_PROJECT_ID` (optional, defaults to Cloud Run project)
- `MARKET_DATA_GATEWAY_URL` (required, centralized market data service)
- `REDIS_URL` (recommended, hot price store)
- `REDIS_PREFIX` (default: `relayorb`)
- `REDIS_LATEST_MAX_AGE_MS` (default: 120000)
- `EVAL_LOOKBACK_HOURS` (default: 168) signals scanned per run
- `EVAL_MAX_SIGNALS` (default: 120) max signals evaluated per run
- `EVAL_AGG_LOOKBACK_DAYS` (default: 30) lookback window for accuracy stats
- `EVAL_AGG_MAX_SIGNALS` (default: 600) max signals scanned for aggregation
- `EVAL_MIN_BOT_SIGNALS` (default: 3) minimum per-bot count to rank
- `EVAL_MIN_SYMBOL_SIGNALS` (default: 5) minimum per-symbol count to rank
- `EVAL_SYMBOL_RESULT_LIMIT` (default: 8) max symbols to include in rankings
- `EVAL_MAX_STOCK_SYMBOLS` (default: 8) cap symbols per run
- `EVAL_MAX_FX_PAIRS` (default: 8) cap FX pairs per run
- `RUN_ID` (optional; tag for logs/metadata)
- `FIRESTORE_RUN_FIELD` (default: `runId`)

## Deploy (Cloud Run Job)
> Run these from repo root with `gcloud` configured.

```bash
docker build -t gcr.io/relayorb/signal-evaluator ./deploy/signal-evaluator
docker push gcr.io/relayorb/signal-evaluator

gcloud run jobs create relayorb-signal-evaluator \
  --image gcr.io/relayorb/signal-evaluator \
  --region us-west1 \
  --service-account relayorb-market-intel@relayorb.iam.gserviceaccount.com \
  --set-env-vars MARKET_DATA_GATEWAY_URL=https://YOUR-GATEWAY-URL,REDIS_URL=redis://YOUR-REDIS:6379,EVAL_LOOKBACK_HOURS=168,EVAL_MAX_SIGNALS=120,EVAL_AGG_LOOKBACK_DAYS=30
```

## Local run (optional)
```bash
cd deploy/signal-evaluator
MARKET_DATA_GATEWAY_URL=... REDIS_URL=redis://localhost:6379 npm start
```
