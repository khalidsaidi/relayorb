#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

SERVICE_NAME=${SERVICE_NAME:-relayorb-price-streamer}
SERVICE_DIR="$ROOT_DIR/deploy/price-streamer"
REGION=$(resolve_region)
ALLOW_UNAUTHENTICATED=${ALLOW_UNAUTHENTICATED:-false}
GATEWAY_SERVICE_NAME=${GATEWAY_SERVICE_NAME:-relayorb-market-data-gateway}

usage() {
  cat <<USAGE
Usage: $(basename "$0") <command>

Commands:
  build        Build container image via Cloud Build
  deploy       Deploy Cloud Run service
  logs         Tail recent logs
  local        Run locally (npm run start)
  image        Print resolved image name

Env:
  ALLOW_CREATE                   Create the service if it does not exist (default: false)
  ALLOW_UNAUTHENTICATED          Make service public (default: false)
  MARKET_DATA_GATEWAY_URL        Gateway base URL (auto-resolved if unset)
  MARKET_DATA_GATEWAY_AUTH       true/false (default: true)
  MARKET_DATA_GATEWAY_AUDIENCE   Optional audience override for ID token
  GATEWAY_SERVICE_NAME           Cloud Run service to resolve URL from
USAGE
}

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
  local url auth envs audience
  url=$(require_gateway_url)
  auth=$(resolve_gateway_auth)
  envs="MARKET_DATA_GATEWAY_URL=${url}|MARKET_DATA_GATEWAY_AUTH=${auth}"
  audience="${MARKET_DATA_GATEWAY_AUDIENCE:-}"
  if [ -z "$audience" ]; then
    audience="$url"
  fi
  envs="${envs}|MARKET_DATA_GATEWAY_AUDIENCE=${audience}"
  echo "$envs"
}

command=${1:-}
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
