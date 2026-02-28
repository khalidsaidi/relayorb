#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-relayorb-prod}"
REGION="${2:-us-central1}"
SCRAPER_SERVICE="${3:-relayorb-metrics-scraper-prod}"
GATEWAY_JOB="${4:-relayorb-gateway-prod}"
REGISTRY_JOB="${5:-relayorb-registry-prod}"
WORKER_JOB="${6:-relayorb-rag-prod}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-20}"
SLEEP_SECONDS="${SLEEP_SECONDS:-15}"

for cmd in gcloud curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd" >&2
    exit 2
  fi
done

log() {
  echo "[metrics-scraper-smoke] $*"
}

latest_revision() {
  gcloud run services describe "${SCRAPER_SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --format='value(status.latestReadyRevisionName)'
}

assert_scraper_ready() {
  local ready
  ready="$(gcloud run services describe "${SCRAPER_SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --format='json(status.conditions)' \
    | jq -r '[.status.conditions[]? | select(.type=="Ready")][0].status // "False"')"

  if [ "${ready}" != "True" ]; then
    log "scraper service is not ready"
    return 1
  fi
  log "scraper service is ready"
}

assert_no_recent_export_errors() {
  local revision
  revision="$(latest_revision)"
  if [ -z "${revision}" ]; then
    log "scraper has no latest ready revision"
    return 1
  fi

  local since
  since="$(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
  local logs
  logs="$(gcloud logging read \
    "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${SCRAPER_SERVICE}\" resource.labels.revision_name=\"${revision}\" severity>=ERROR timestamp>=\"${since}\"" \
    --project "${PROJECT_ID}" \
    --limit 20 \
    --format='value(textPayload,jsonPayload.message)' || true)"

  if [ -n "${logs}" ]; then
    log "found recent scraper errors for revision ${revision}"
    echo "${logs}" | sed -n '1,20p'
    return 1
  fi

  log "no recent scraper export errors on revision ${revision}"
}

metric_count_for_job() {
  local job="$1"
  local token end start filter response
  token="$(gcloud auth print-access-token)"
  end="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  start="$(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
  filter="metric.type=\"prometheus.googleapis.com/up/gauge\" AND resource.type=\"prometheus_target\" AND resource.labels.job=\"${job}\""
  response="$(curl -sS -G "https://monitoring.googleapis.com/v3/projects/${PROJECT_ID}/timeSeries" \
    -H "Authorization: Bearer ${token}" \
    --data-urlencode "filter=${filter}" \
    --data-urlencode "interval.startTime=${start}" \
    --data-urlencode "interval.endTime=${end}" \
    --data-urlencode "view=HEADERS" \
    --data-urlencode "pageSize=1")"
  echo "${response}" | jq '.timeSeries | length'
}

wait_for_job_series() {
  local job="$1"
  for attempt in $(seq 1 "${MAX_ATTEMPTS}"); do
    local count
    count="$(metric_count_for_job "${job}")"
    if [ "${count}" -gt 0 ]; then
      log "metrics series present for job=${job} (attempt ${attempt})"
      return 0
    fi
    log "waiting for metrics series job=${job} (attempt ${attempt}/${MAX_ATTEMPTS})"
    sleep "${SLEEP_SECONDS}"
  done

  log "metrics series not found for job=${job}"
  return 1
}

assert_scraper_ready
assert_no_recent_export_errors
wait_for_job_series "${GATEWAY_JOB}"
wait_for_job_series "${REGISTRY_JOB}"
wait_for_job_series "${WORKER_JOB}"
log "metrics scraper smoke checks passed"
