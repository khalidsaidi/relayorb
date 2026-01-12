# Market Intel Worker (Cloud Run Job)

This worker pulls market data on a schedule, merges it with bot signals, and writes ranked `market/hotTrades`, `market/trending`, and `market/popular` docs into Firestore.

## Data sources
- Crypto: FMP quotes/candles + CoinGecko (via market-data-gateway)
- Stocks/TSX/FX: Live price snapshots from Redis (price-streamer), with Firestore fallback
- News/Sentiment: Marketaux (via market-data-gateway, optional)

## Universe controls
The worker reads `market/universe` to prioritize watchlists and optional trending picks:
- `mode` (global, or per-asset `crypto.mode` / `stocks.mode` / `forex.mode`)
  - `movers_only`
  - `universe_only`
  - `movers_plus_universe`
  - `movers_filtered_by_universe`
  - `weighted_union` (union + score boost for watchlisted symbols)
- `crypto.symbols` (BTC/USDT, ETH/USDT)
- `stocks.symbols` (AAPL, MSFT, NVDA)
- `forex.pairs` (EUR/USD, USD/JPY)

## Intel controls
Use `market/controls` to tune cadence without redeploys:
- `llmIntervalMinutes`
- `enableLLM`
- `dipHorizon` (`1h`, `24h`, `7d`)
- `riskProfile` (`conservative`, `balanced`, `aggressive`)
- `assetFocus` (array of `crypto`, `stock`, `forex`)
- `primaryAssets` (object with `crypto`, `stocks`, `forex` arrays)
- `trendHorizon` (`15m`, `1h`, `24h`, `7d`)
- `trendWeights` (object with `momentum`, `volume`, `signals`, `news` weights)
- `botWeights` (object keyed by bot ID or `engine:<name>` to scale signal influence)
- `autoTuneEnabled` (bool, auto-adjust trend weights using accuracy)
- `autoTuneWithAI` (bool, AI nudging for weight adjustments)
- `autoTuneIntervalHours` (number, default 6)

Example `botWeights`:
```json
{
  "engine:freqtrade": 1.2,
  "engine:backtrader": 0.8,
  "backtrader-forex": 0.7
}
```

## Environment variables
- `FIREBASE_PROJECT_ID` (optional, defaults to Cloud Run project)
- `MARKET_DATA_GATEWAY_URL` (required, centralized market data service)
- `REDIS_URL` (recommended, hot price store for movers)
- `REDIS_PREFIX` (default: `relayorb`)
- `REDIS_LATEST_MAX_AGE_MS` (default: 120000)
- `REDIS_EVENT_CHANNEL` (optional; defaults to `<prefix>:events`)
- `BATCH_COLLECTION` (default: `batches`)
- `CANDIDATE_PUBLISH_LIMIT` (default: 150)
- `RUN_ID` (optional; tag for logs/metadata and batch ID override)
- `FIRESTORE_RUN_FIELD` (default: `runId`)
- `HOT_TRADES_LIMIT` (default: 12)
- `BOT_SIGNAL_LOOKBACK_MINUTES` (default: 360)
- `SIGNAL_DECAY_HALF_LIFE_MINUTES` (default: 60)
- `SIGNAL_RECENT_MINUTES` (default: 30)
- `SIGNAL_MIN_RECENT` (default: 2)
- `CRYPTO_LIMIT` (default: 40)
- `FX_PAIRS` (default: `USD/JPY,USD/EUR,USD/GBP,USD/CHF,USD/CAD`)
- `MARKETAUX_LIMIT` (default: 40)
- `MARKETAUX_SYMBOL_LIMIT` (default: 25)
- `NEWS_INTERVAL_MINUTES` (default: 30)
- `OPENAI_API_KEY` (optional, for LLM summaries)
- `OPENAI_MODEL` (default: gpt-4o-mini)
- `LLM_INTERVAL_MINUTES` (default: 30)
- `MIN_ACCURACY_SIGNALS` (default: 12)
- `AUTO_TUNE_ENABLED` (default: true)
- `AUTO_TUNE_INTERVAL_HOURS` (default: 6)
- `AUTO_TUNE_MAX_DELTA` (default: 12)
- `STOCK_WATCHLIST_LIMIT` (default: 5)
- `SYMBOL_CACHE_DAYS` (default: 7)
- `SYMBOL_CACHE_MAX` (default: 12000)
- `POPULAR_PER_CLASS` (default: 12)
- `TREND_LIMIT` (default: 8)
- `EMIT_MARKET_SIGNALS` (default: true)
- `MARKET_SIGNAL_LIMIT` (default: 3 per asset class)
- `MARKET_SIGNAL_BACKFILL_MINUTES` (default: 70)
- `MOVER_WINDOW_MINUTES` (default: 15)
- `SNAPSHOT_CHUNK_SIZE` (default: 250)
- `SNAPSHOT_KEEP` (default: 6)
- `MOVER_TOP_LIMIT` (default: 200)
- `MOVER_ENRICH_LIMIT` (default: 50)
- `MOVER_MIN_PRICE` (default: 1)
- `MOVER_MIN_VOLUME` (default: 50000)
- `WATCHLIST_SCORE_BOOST` (default: 4)
- `STOCK_CHANGE_SCALE` (default: 5)
- `FX_CHANGE_SCALE` (default: 0.3)
- `CRYPTO_CHANGE_SCALE` (default: 2)
- `RECOMMENDATION_LIMIT` (default: 50)

## Symbol cache
The job refreshes a global stock ticker list via the market-data-gateway (FMP stock list) and
stores it in `market_symbols_stocks`. The UI uses this collection for ticker search.

## Snapshot storage
When Redis is configured, 15-minute mover snapshots are read from the Redis snapshot ring buffer.
If Redis is not configured, snapshots fall back to Firestore chunked collections (`market_snapshots_us`,
`market_snapshots_tsx`, `market_snapshots_fx`) and are pruned to `SNAPSHOT_KEEP`.

## Optional market-intel signals
When enabled, the worker emits a small batch of synthetic signal docs under
`bots/market-intel/signals` so accuracy panels can cover stocks and FX even before
native bot adapters support them.

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
```

4) Build & deploy:
```bash
docker build -t gcr.io/relayorb/market-intel ./deploy/market-intel
docker push gcr.io/relayorb/market-intel

gcloud run jobs create relayorb-market-intel \
  --image gcr.io/relayorb/market-intel \
  --region us-west1 \
  --service-account relayorb-market-intel@relayorb.iam.gserviceaccount.com \
  --set-env-vars HOT_TRADES_LIMIT=12,BOT_SIGNAL_LOOKBACK_MINUTES=360,FX_PAIRS=USD/JPY,USD/EUR,USD/GBP,USD/CHF,USD/CAD,MARKET_DATA_GATEWAY_URL=https://YOUR-GATEWAY-URL,REDIS_URL=redis://YOUR-REDIS:6379 \
  --set-secrets OPENAI_API_KEY=relayorb-openai-key:latest \
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
MARKET_DATA_GATEWAY_URL=... REDIS_URL=redis://localhost:6379 OPENAI_API_KEY=... npm start
```

## Notes
- Stock/TSX/FX movers require Redis hot prices (price-streamer should be running).
- LLM summaries are only added when `OPENAI_API_KEY` is set.
- Auto-tune adjusts trend weights using evaluator accuracy; AI only writes explanations.
- When `RUN_ID` is set and `e2e_runs/{RUN_ID}.testMode` is true, movers/candidates are restricted to `restrictMarkets` and `restrictSymbols`.
- Firestore output:
  - `market/hotTrades` (ranked trade list + meta)
  - `market/trending` (trending list by horizon + score components)
  - `market/popular` (intelligence-driven popular assets per class)
  - `market/candidates` (latest candidate batch for bot triggers)
  - `batches/{batchId}` (durable batch record for missed triggers)
  - `market/prices_snapshot` (latest spot price snapshot for tracked symbols)
  - `market/movers` (15m movers by market from live price snapshots)
  - `market_symbols_stocks` (cached global ticker list)
  - `market/symbolCache` (cache metadata)
  - `bots/market-intel/signals` (optional synthetic signal stream)
