# Refresh Service (Cloud Run)

HTTP endpoint that triggers the market-intel + signal-evaluator Cloud Run jobs on demand,
plus an AI advice endpoint for per-trade explanations.
The UI calls this with the Firebase ID token and the service verifies the admin allowlist.

## Environment variables
- `FIREBASE_PROJECT_ID` (default: relayorb)
- `REFRESH_REGION` (default: us-west1)
- `REFRESH_JOBS` (default: relayorb-market-intel,relayorb-signal-evaluator)
- `ADMIN_ALLOWLIST` (comma-separated emails)
- `CORS_ORIGIN` (default: `*`)
- `OPENAI_API_KEY` (required for /advice)
- `OPENAI_MODEL` (default: gpt-4o-mini)
- `TAVILY_API_KEY` (optional, for web search - recommended)
- `SERP_API_KEY` (optional, fallback for web search)
- `REDIS_URL` (optional; enables Redis event listener)
- `REDIS_PREFIX` (default: relayorb)
- `REDIS_EVENT_CHANNEL` (default: `<prefix>:events`)
- `REDIS_EVENT_ENABLED` (default: true)
- `REDIS_EVENT_DEBOUNCE_MS` (default: 60000)
- `REDIS_EVENT_JOBS` (default: relayorb-signal-evaluator)
- `BATCH_COLLECTION` (default: `batches`)
- `BATCH_CONSUMER_ID` (default: `refresh-service`)
- `BATCH_POLL_ENABLED` (default: true)
- `BATCH_POLL_INTERVAL_MS` (default: 60000)
- `BATCH_POLL_LIMIT` (default: 3)
- `MARKET_INTEL_JOB` (default: relayorb-market-intel)
- `PIPELINE_EVENTS_ENABLED` (default: true)
- `PIPELINE_EVENTS_STREAM` (optional override for Redis stream)
- `PIPELINE_EVENTS_MAXLEN` (default: 20000)
- `PIPELINE_EVENTS_RUN_ENV` (default: prod)

## Deploy
```bash
gcloud iam service-accounts create relayorb-refresh \
  --display-name "RelayOrb Refresh"

gcloud projects add-iam-policy-binding relayorb \
  --member="serviceAccount:relayorb-refresh@relayorb.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding relayorb \
  --member="serviceAccount:relayorb-refresh@relayorb.iam.gserviceaccount.com" \
  --role="roles/run.developer"

docker build -t gcr.io/relayorb/refresh-service ./deploy/refresh-service
docker push gcr.io/relayorb/refresh-service

gcloud run deploy relayorb-refresh \
  --image gcr.io/relayorb/refresh-service \
  --region us-west1 \
  --allow-unauthenticated \
  --service-account relayorb-refresh@relayorb.iam.gserviceaccount.com \
  --set-env-vars FIREBASE_PROJECT_ID=relayorb,REFRESH_REGION=us-west1,ADMIN_ALLOWLIST=khalidsaidi66@gmail.com,REFRESH_JOBS=relayorb-market-intel,relayorb-signal-evaluator,REDIS_URL=redis://10.19.89.107:6379 \
  --set-secrets OPENAI_API_KEY=relayorb-openai-key:latest,TAVILY_API_KEY=relayorb-tavily-key:latest,SERP_API_KEY=relayorb-serpapi-key:latest
```

If using Redis events, add a VPC connector and set min instances to keep the listener alive:
```bash
gcloud run services update relayorb-refresh \
  --region us-west1 \
  --vpc-connector relayorb-vpc-connector \
  --vpc-egress private-ranges-only \
  --min-instances 1
```

Set `VITE_REFRESH_URL` to the Cloud Run service URL in your app environment.

## Endpoints
- `GET /health` (basic health)
- `GET /readyz` (readiness alias)
- `POST /refresh` (starts jobs)
- `POST /admin/scanOnce` (triggers market-intel with `RUN_ID`)
- `POST /advice` (per-trade AI recommendation)
- `GET /ops/events` (SSE pipeline events stream; requires auth)
- `GET /ops/events/search` (filtered history for batchId/symbolKey/edgeKey; requires auth)