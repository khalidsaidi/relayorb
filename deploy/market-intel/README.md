# Market Intel Worker (Cloud Run Job)

This worker pulls market data on a schedule, merges it with bot signals, and writes ranked `market/hotTrades` and `market/popular` docs into Firestore.

## Data sources (free tiers)
- Crypto: CoinGecko (no key)
- Stocks: Alpha Vantage (free key)
- Forex: exchangerate.host (no key)

## Universe controls
The worker reads `market/universe` to prioritize watchlists and optional trending picks:
- `crypto.symbols` (BTC/USDT, ETH/USDT)
- `stocks.symbols` (AAPL, MSFT, NVDA)
- `forex.pairs` (EUR/USD, USD/JPY)
- `includeTrending` flags per asset class

## Intel controls
Use `market/controls` to tune cadence without redeploys:
- `llmIntervalMinutes`
- `enableLLM`
- `dipHorizon` (`1h`, `24h`, `7d`)
- `riskProfile` (`conservative`, `balanced`, `aggressive`)
- `assetFocus` (array of `crypto`, `stock`, `forex`)
- `primaryAssets` (object with `crypto`, `stocks`, `forex` arrays)

## Environment variables
- `FIREBASE_PROJECT_ID` (optional, defaults to Cloud Run project)
- `HOT_TRADES_LIMIT` (default: 12)
- `BOT_SIGNAL_LOOKBACK_MINUTES` (default: 360)
- `CRYPTO_LIMIT` (default: 40)
- `CRYPTO_EXCHANGE` (default: binance)
- `FX_PAIRS` (default: `USD/JPY,USD/EUR,USD/GBP,USD/CHF,USD/CAD`)
- `ALPHAVANTAGE_API_KEY` (required for stocks)
- `OPENAI_API_KEY` (optional, for LLM summaries)
- `OPENAI_MODEL` (default: gpt-4o-mini)
- `LLM_INTERVAL_MINUTES` (default: 30)
- `STOCK_WATCHLIST_LIMIT` (default: 5)
- `POPULAR_PER_CLASS` (default: 12)

## Deploy (Cloud Run Job)
> Run these from repo root with `gcloud` configured.

1) Create a service account:
```bash
gcloud iam service-accounts create relayorb-market-intel \
  --display-name "RelayOrb Market Intel"
```

2) Grant access:
```bash
gcloud projects add-iam-policy-binding relayorb \
  --member="serviceAccount:relayorb-market-intel@relayorb.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding relayorb \
  --member="serviceAccount:relayorb-market-intel@relayorb.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

3) Create secrets (run locally; replace placeholders):
```bash
echo "<OPENAI_API_KEY>" | gcloud secrets create relayorb-openai-key --data-file=-

echo "<ALPHAVANTAGE_API_KEY>" | gcloud secrets create relayorb-alphavantage-key --data-file=-
```

4) Build & deploy:
```bash
docker build -t gcr.io/relayorb/market-intel ./deploy/market-intel
docker push gcr.io/relayorb/market-intel

gcloud run jobs create relayorb-market-intel \
  --image gcr.io/relayorb/market-intel \
  --region us-west1 \
  --service-account relayorb-market-intel@relayorb.iam.gserviceaccount.com \
  --set-env-vars HOT_TRADES_LIMIT=12,BOT_SIGNAL_LOOKBACK_MINUTES=360,CRYPTO_EXCHANGE=binance,FX_PAIRS=USD/JPY,USD/EUR,USD/GBP,USD/CHF,USD/CAD \
  --set-secrets OPENAI_API_KEY=relayorb-openai-key:latest,ALPHAVANTAGE_API_KEY=relayorb-alphavantage-key:latest \
  --memory 512Mi
```

5) Allow Scheduler to invoke the job:
```bash
gcloud run jobs add-iam-policy-binding relayorb-market-intel \
  --region us-west1 \
  --member="serviceAccount:relayorb-market-intel@relayorb.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

6) Create a scheduler job (every 5 minutes):
```bash
gcloud scheduler jobs create http relayorb-market-intel \
  --location us-west1 \
  --schedule "*/5 * * * *" \
  --uri "https://run.googleapis.com/apis/run.googleapis.com/v1/namespaces/relayorb/jobs/relayorb-market-intel:run" \
  --http-method POST \
  --oidc-service-account-email relayorb-market-intel@relayorb.iam.gserviceaccount.com
```

## Local run (optional)
```bash
cd deploy/market-intel
ALPHAVANTAGE_API_KEY=... OPENAI_API_KEY=... npm start
```

## Notes
- If `ALPHAVANTAGE_API_KEY` is missing, stock data is skipped.
- LLM summaries are only added when `OPENAI_API_KEY` is set.
- Firestore output:
  - `market/hotTrades` (ranked trade list + meta)
  - `market/popular` (intelligence-driven popular assets per class)
