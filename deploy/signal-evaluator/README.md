# Signal Evaluator Worker (Cloud Run Job)

This worker evaluates bot signals against real market prices and writes accuracy metrics
to Firestore so the UI can display prediction accuracy and best-performing bots.

## Data sources
- Crypto: Binance public klines (no key)
- Stocks: FMP daily + intraday (primary), Alpha Vantage fallback
- Forex: FMP daily + intraday (primary), Alpha Vantage intraday + frankfurter.app daily fallback

## Firestore output
- `bots/{botId}/signals/{signalId}`: `evaluation` field with horizon results
- `analytics/signalPerformance`: aggregate accuracy + top bots by horizon
- `analytics/signalPerformance`: asset-class + symbol rankings by horizon
- `bots/{botId}/analytics/signalPerformance`: per-bot accuracy + symbol rankings

## Environment variables
- `FIREBASE_PROJECT_ID` (optional, defaults to Cloud Run project)
- `FMP_API_KEY` (required for FMP snapshots)
- `ALPHAVANTAGE_API_KEY` (optional fallback)
- `ALPHAVANTAGE_THROTTLE_MS` (default: 12000, protects free-tier rate limits)
- `EVAL_LOOKBACK_HOURS` (default: 168) signals scanned per run
- `EVAL_MAX_SIGNALS` (default: 120) max signals evaluated per run
- `EVAL_AGG_LOOKBACK_DAYS` (default: 30) lookback window for accuracy stats
- `EVAL_AGG_MAX_SIGNALS` (default: 600) max signals scanned for aggregation
- `EVAL_MIN_BOT_SIGNALS` (default: 3) minimum per-bot count to rank
- `EVAL_MIN_SYMBOL_SIGNALS` (default: 5) minimum per-symbol count to rank
- `EVAL_SYMBOL_RESULT_LIMIT` (default: 8) max symbols to include in rankings
- `EVAL_MAX_STOCK_SYMBOLS` (default: 8) cap Alpha Vantage symbols per run
- `EVAL_MAX_FX_PAIRS` (default: 8) cap Alpha Vantage FX pairs per run

## Deploy (Cloud Run Job)
> Run these from repo root with `gcloud` configured.

```bash
docker build -t gcr.io/relayorb/signal-evaluator ./deploy/signal-evaluator
docker push gcr.io/relayorb/signal-evaluator

gcloud run jobs create relayorb-signal-evaluator \
  --image gcr.io/relayorb/signal-evaluator \
  --region us-west1 \
  --service-account relayorb-market-intel@relayorb.iam.gserviceaccount.com \
  --set-secrets FMP_API_KEY=relayorb-fmp-key:latest,ALPHAVANTAGE_API_KEY=relayorb-alphavantage-key:latest \
  --set-env-vars EVAL_LOOKBACK_HOURS=168,EVAL_MAX_SIGNALS=120,EVAL_AGG_LOOKBACK_DAYS=30
```

## Local run (optional)
```bash
cd deploy/signal-evaluator
FMP_API_KEY=... ALPHAVANTAGE_API_KEY=... npm start
```
