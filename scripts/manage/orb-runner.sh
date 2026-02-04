#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

SERVICE_NAME=${SERVICE_NAME:-relayorb-orb-runner}
SERVICE_DIR="$ROOT_DIR/deploy/orb-runner"
REGION=$(resolve_region)
ALLOW_UNAUTHENTICATED=${ALLOW_UNAUTHENTICATED:-false}
GATEWAY_SERVICE_NAME=${GATEWAY_SERVICE_NAME:-relayorb-market-data-gateway}
SERVICE_MIN_INSTANCES=${SERVICE_MIN_INSTANCES:-0}
SERVICE_MAX_INSTANCES=${SERVICE_MAX_INSTANCES:-1}
SERVICE_CONCURRENCY=${SERVICE_CONCURRENCY:-1}
SERVICE_CPU=${SERVICE_CPU:-1}
SERVICE_MEMORY=${SERVICE_MEMORY:-1Gi}
SERVICE_TIMEOUT=${SERVICE_TIMEOUT:-900}

usage() {
  cat <<USAGE
Usage: $(basename "$0") <command>

Commands:
  build        Build container image via Cloud Build
  deploy       Deploy Cloud Run service (sets gateway env vars)
  logs         Tail recent logs
  health       Fetch /health with an identity token
  local        Run locally (will refuse outside GCE/Cloud Run)
  image        Print resolved image name

Env:
  MARKET_DATA_GATEWAY_URL        Gateway base URL (auto-resolved if unset)
  MARKET_DATA_GATEWAY_AUTH       true/false (default: true)
  MARKET_DATA_GATEWAY_AUDIENCE   Optional audience override for ID token
  FIREBASE_PROJECT_ID            Optional Firebase project override for Firestore
  ORB_REQUESTED_BY_UID           Approved UID to attach to ORB requests
  ORB_CORS_ORIGINS               Comma-separated allowed browser origins
  ORB_RATE_LIMIT_ENABLED         true/false (default: true)
  ORB_RATE_LIMIT_WINDOW_MS       Rate limit window (ms)
  ORB_RATE_LIMIT_MAX             Max requests per window
  GATEWAY_SERVICE_NAME           Cloud Run service to resolve URL from
  ALLOW_CREATE                   Create the service if it does not exist
  ALLOW_UNAUTHENTICATED          Make service public (default: false)
USAGE
}

command=${1:-}

resolve_gateway_url() {
  if [ -n "${MARKET_DATA_GATEWAY_URL:-}" ]; then
    echo "$MARKET_DATA_GATEWAY_URL"
    return
  fi
  require_cmd gcloud
  gcloud run services describe "$GATEWAY_SERVICE_NAME" --project "$(require_project_id)" --region "$REGION" \
    --format="value(status.url)" 2>/dev/null || true
}

require_gateway_url() {
  local url
  url=$(resolve_gateway_url)
  if [ -z "$url" ]; then
    echo "MARKET_DATA_GATEWAY_URL is required (or set GATEWAY_SERVICE_NAME)." >&2
    exit 1
  fi
  echo "$url"
}

resolve_gateway_auth() {
  if [ -n "${MARKET_DATA_GATEWAY_AUTH:-}" ]; then
    echo "$MARKET_DATA_GATEWAY_AUTH"
  else
    echo "true"
  fi
}

build_env_vars() {
  local url auth envs audience requested_by
  url=$(require_gateway_url)
  auth=$(resolve_gateway_auth)
  envs="MARKET_DATA_GATEWAY_URL=${url}|MARKET_DATA_GATEWAY_AUTH=${auth}"
  audience="${MARKET_DATA_GATEWAY_AUDIENCE:-}"
  if [ -z "$audience" ]; then
    audience="$url"
  fi
  envs="${envs}|MARKET_DATA_GATEWAY_AUDIENCE=${audience}"
  if [ -n "${FIREBASE_PROJECT_ID:-}" ]; then
    envs="${envs}|FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}"
  fi
  requested_by="${ORB_REQUESTED_BY_UID:-}"
  if [ -n "$requested_by" ]; then
    envs="${envs}|ORB_REQUESTED_BY_UID=${requested_by}"
  fi
  if [ -n "${ORB_CORS_ORIGINS:-}" ]; then
    envs="${envs}|ORB_CORS_ORIGINS=${ORB_CORS_ORIGINS}"
  fi
  if [ -n "${ORB_RATE_LIMIT_ENABLED:-}" ]; then
    envs="${envs}|ORB_RATE_LIMIT_ENABLED=${ORB_RATE_LIMIT_ENABLED}"
  fi
  if [ -n "${ORB_RATE_LIMIT_WINDOW_MS:-}" ]; then
    envs="${envs}|ORB_RATE_LIMIT_WINDOW_MS=${ORB_RATE_LIMIT_WINDOW_MS}"
  fi
  if [ -n "${ORB_RATE_LIMIT_MAX:-}" ]; then
    envs="${envs}|ORB_RATE_LIMIT_MAX=${ORB_RATE_LIMIT_MAX}"
  fi
  echo "$envs"
}

resolve_service_url() {
  require_cmd gcloud
  gcloud run services describe "$SERVICE_NAME" --project "$(require_project_id)" --region "$REGION" \
    --format="value(status.url)" 2>/dev/null || true
}

case "$command" in
  build)
    build_image "$SERVICE_DIR" "$(resolve_image "$SERVICE_NAME")"
    ;;
  deploy)
    deploy_run_service "$SERVICE_NAME" "$(resolve_image "$SERVICE_NAME")" "$REGION" \
      "$ALLOW_UNAUTHENTICATED" "$(build_env_vars)"
    ;;
  logs)
    service_logs "$SERVICE_NAME" "$REGION"
    ;;
  health)
    require_cmd curl
    require_cmd gcloud
    url=$(resolve_service_url)
    if [ -z "$url" ]; then
      echo "Service URL not found for $SERVICE_NAME in $REGION." >&2
      exit 1
    fi
    curl -sS -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
      "${url}/health"
    echo
    ;;
  local)
    run_local_node "$SERVICE_DIR"
    ;;
  image)
    resolve_image "$SERVICE_NAME"
    ;;
  -h|--help|help|"")
    usage
    ;;
  *)
    echo "Unknown command: $command" >&2
    usage
    exit 1
    ;;
esac
