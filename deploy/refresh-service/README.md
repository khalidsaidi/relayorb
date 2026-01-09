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
  --set-env-vars FIREBASE_PROJECT_ID=relayorb,REFRESH_REGION=us-west1,ADMIN_ALLOWLIST=khalidsaidi66@gmail.com,REFRESH_JOBS=relayorb-market-intel,relayorb-signal-evaluator \
  --set-secrets OPENAI_API_KEY=relayorb-openai-key:latest,TAVILY_API_KEY=relayorb-tavily-key:latest,SERP_API_KEY=relayorb-serpapi-key:latest
```

Set `VITE_REFRESH_URL` to the Cloud Run service URL in your app environment.

## Endpoints
- `POST /refresh` (starts jobs)
- `POST /advice` (per-trade AI recommendation)
