#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-relayorb-prod}"
REGION="${REGION:-us-central1}"
REPOSITORY="${REPOSITORY:-relayorb}"
SERVICE_NAME="${SERVICE_NAME:-relayorb-metrics-scraper-prod}"
SCRAPER_SA_ID="${SCRAPER_SA_ID:-relayorb-otel-scraper-sa}"
SCRAPER_SA="${SCRAPER_SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
GATEWAY_SERVICE_NAME="${GATEWAY_SERVICE_NAME:-relayorb-gateway-prod}"
REGISTRY_SERVICE_NAME="${REGISTRY_SERVICE_NAME:-relayorb-registry-prod}"
WORKER_SERVICE_NAME="${WORKER_SERVICE_NAME:-relayorb-rag-prod}"
GATEWAY_METRICS_SECRET="${GATEWAY_METRICS_SECRET:-relayorb-prod-gateway-metrics-token}"
REGISTRY_METRICS_SECRET="${REGISTRY_METRICS_SECRET:-relayorb-prod-registry-metrics-token}"
WORKER_METRICS_SECRET="${WORKER_METRICS_SECRET:-relayorb-prod-worker-metrics-token}"
BOOTSTRAP_IAM="${BOOTSTRAP_IAM:-0}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "missing required command: gcloud" >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "missing required command: docker" >&2
  exit 2
fi

if [ "${BOOTSTRAP_IAM}" = "1" ]; then
  if ! gcloud iam service-accounts describe "${SCRAPER_SA}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud iam service-accounts create "${SCRAPER_SA_ID}" \
      --project "${PROJECT_ID}" \
      --display-name "RelayOrb OTEL Scraper"
    for role in roles/monitoring.metricWriter roles/secretmanager.secretAccessor; do
      gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
        --member "serviceAccount:${SCRAPER_SA}" \
        --role "${role}" \
        --quiet >/dev/null
    done
  fi
fi

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet >/dev/null

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:$(date +%Y%m%d%H%M%S)"
docker build -f infra/gcp/otel/Dockerfile -t "${IMAGE}" .
docker push "${IMAGE}"

GATEWAY_URL="$(gcloud run services describe "${GATEWAY_SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)')"
REGISTRY_URL="$(gcloud run services describe "${REGISTRY_SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)')"
WORKER_URL="$(gcloud run services describe "${WORKER_SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)')"

gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --service-account "${SCRAPER_SA}" \
  --ingress internal \
  --no-allow-unauthenticated \
  --min-instances 1 \
  --max-instances 1 \
  --cpu 1 \
  --memory 512Mi \
  --no-cpu-throttling \
  --set-env-vars "GCP_PROJECT=${PROJECT_ID},GCP_REGION=${REGION},GATEWAY_BASE_URL=${GATEWAY_URL},REGISTRY_BASE_URL=${REGISTRY_URL},WORKER_BASE_URL=${WORKER_URL}" \
  --set-secrets "GATEWAY_METRICS_TOKEN=${GATEWAY_METRICS_SECRET}:latest,REGISTRY_METRICS_TOKEN=${REGISTRY_METRICS_SECRET}:latest,WORKER_METRICS_TOKEN=${WORKER_METRICS_SECRET}:latest"

echo "deployed ${SERVICE_NAME}"
