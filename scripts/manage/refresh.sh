#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

SERVICE_NAME=${SERVICE_NAME:-relayorb-refresh}
SERVICE_DIR="$ROOT_DIR/deploy/refresh-service"
REGION=$(resolve_region)
ALLOW_UNAUTHENTICATED=${ALLOW_UNAUTHENTICATED:-false}
ORB_RUNNER_SERVICE_NAME=${ORB_RUNNER_SERVICE_NAME:-relayorb-orb-runner}
MARKET_DATA_GATEWAY_SERVICE_NAME=${MARKET_DATA_GATEWAY_SERVICE_NAME:-relayorb-market-data-gateway}
SERVICE_MIN_INSTANCES=${SERVICE_MIN_INSTANCES:-0}
SERVICE_MAX_INSTANCES=${SERVICE_MAX_INSTANCES:-2}
SERVICE_CONCURRENCY=${SERVICE_CONCURRENCY:-80}
SERVICE_CPU=${SERVICE_CPU:-1}
SERVICE_MEMORY=${SERVICE_MEMORY:-512Mi}
SERVICE_TIMEOUT=${SERVICE_TIMEOUT:-60}

usage() {
  cat <<USAGE
Usage: $(basename "$0") <command>

Service:
  relayorb-refresh (UI proxy for /v1/* market data)

Commands:
  build        Build container image via Cloud Build
  deploy       Deploy Cloud Run service
  logs         Tail recent logs
  health       Fetch /health with an identity token
  local        Run locally (npm run start)
  image        Print resolved image name

Env:
  ALLOW_CREATE           Create the service if it does not exist (default: false)
  ALLOW_UNAUTHENTICATED  Keep service public (default: false)
  ORB_RUNNER_URL         ORB runner base URL (auto-resolved if unset)
  ORB_RUNNER_AUTH        true/false (default: true)
  ORB_RUNNER_AUDIENCE    Optional audience override for ID token
  ORB_RUNNER_SERVICE_NAME  Cloud Run service name (default: relayorb-orb-runner)
  MARKET_DATA_GATEWAY_URL       Market data gateway base URL (auto-resolved if unset)
  MARKET_DATA_GATEWAY_AUTH      true/false (default: true)
  MARKET_DATA_GATEWAY_AUDIENCE  Optional audience override for ID token
  MARKET_DATA_GATEWAY_SERVICE_NAME  Cloud Run service name (default: relayorb-market-data-gateway)
  CORS_ORIGINS            Allowed browser origins (comma-separated)
  CORS_ORIGIN             Allowed browser origin (legacy)
  REFRESH_RATE_LIMIT_ENABLED    true/false (default: true)
  REFRESH_RATE_LIMIT_WINDOW_MS  Rate limit window (ms)
  REFRESH_RATE_LIMIT_MAX        Max requests per window
  ADMIN_ALLOWLIST         Comma-separated admin emails allowed to call this service
USAGE
}

command=${1:-}
resolve_orb_runner_url() {
  if [ -n "${ORB_RUNNER_URL:-}" ]; then
    echo "$ORB_RUNNER_URL"
    return
  fi
  require_cmd gcloud
  gcloud run services describe "$ORB_RUNNER_SERVICE_NAME" --project "$(require_project_id)" --region "$REGION" \
    --format="value(status.url)" 2>/dev/null || true
}

resolve_service_url() {
  require_cmd gcloud
  gcloud run services describe "$SERVICE_NAME" --project "$(require_project_id)" --region "$REGION" \
    --format="value(status.url)" 2>/dev/null || true
}

require_orb_runner_url() {
  local url
  url=$(resolve_orb_runner_url)
  if [ -z "$url" ]; then
    echo "ORB_RUNNER_URL is required (or set ORB_RUNNER_SERVICE_NAME)." >&2
    exit 1
  fi
  echo "$url"
}

resolve_orb_runner_auth() {
  if [ -n "${ORB_RUNNER_AUTH:-}" ]; then
    echo "$ORB_RUNNER_AUTH"
  else
    echo "true"
  fi
}

resolve_market_data_gateway_url() {
  if [ -n "${MARKET_DATA_GATEWAY_URL:-}" ]; then
    echo "$MARKET_DATA_GATEWAY_URL"
    return
  fi
  require_cmd gcloud
  gcloud run services describe "$MARKET_DATA_GATEWAY_SERVICE_NAME" --project "$(require_project_id)" --region "$REGION" \
    --format="value(status.url)" 2>/dev/null || true
}

resolve_market_data_gateway_auth() {
  if [ -n "${MARKET_DATA_GATEWAY_AUTH:-}" ]; then
    echo "$MARKET_DATA_GATEWAY_AUTH"
  else
    echo "true"
  fi
}

build_env_vars() {
  local url auth envs audience gateway_url gateway_auth gateway_audience cors_origin allowlist cors_origins
  url=$(require_orb_runner_url)
  auth=$(resolve_orb_runner_auth)
  envs="ORB_RUNNER_URL=${url}|ORB_RUNNER_AUTH=${auth}"
  audience="${ORB_RUNNER_AUDIENCE:-}"
  if [ -n "$audience" ]; then
    envs="${envs}|ORB_RUNNER_AUDIENCE=${audience}"
  fi
  gateway_url=$(resolve_market_data_gateway_url)
  if [ -n "$gateway_url" ]; then
    envs="${envs}|MARKET_DATA_GATEWAY_URL=${gateway_url}"
  fi
  gateway_auth=$(resolve_market_data_gateway_auth)
  if [ -n "$gateway_auth" ]; then
    envs="${envs}|MARKET_DATA_GATEWAY_AUTH=${gateway_auth}"
  fi
  gateway_audience="${MARKET_DATA_GATEWAY_AUDIENCE:-}"
  if [ -z "$gateway_audience" ]; then
    gateway_audience="$gateway_url"
  fi
  envs="${envs}|MARKET_DATA_GATEWAY_AUDIENCE=${gateway_audience}"
  cors_origins="${CORS_ORIGINS:-}"
  cors_origin="${CORS_ORIGIN:-}"
  if [ -n "$cors_origins" ]; then
    envs="${envs}|CORS_ORIGINS=${cors_origins}"
  elif [ -n "$cors_origin" ]; then
    envs="${envs}|CORS_ORIGIN=${cors_origin}"
  fi
  if [ -n "${REFRESH_RATE_LIMIT_ENABLED:-}" ]; then
    envs="${envs}|REFRESH_RATE_LIMIT_ENABLED=${REFRESH_RATE_LIMIT_ENABLED}"
  fi
  if [ -n "${REFRESH_RATE_LIMIT_WINDOW_MS:-}" ]; then
    envs="${envs}|REFRESH_RATE_LIMIT_WINDOW_MS=${REFRESH_RATE_LIMIT_WINDOW_MS}"
  fi
  if [ -n "${REFRESH_RATE_LIMIT_MAX:-}" ]; then
    envs="${envs}|REFRESH_RATE_LIMIT_MAX=${REFRESH_RATE_LIMIT_MAX}"
  fi
  allowlist="${ADMIN_ALLOWLIST:-}"
  if [ -n "$allowlist" ]; then
    envs="${envs}|ADMIN_ALLOWLIST=${allowlist}"
  fi
  echo "$envs"
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
