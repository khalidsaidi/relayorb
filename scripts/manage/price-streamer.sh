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
  FIREBASE_PROJECT_ID            Optional Firebase project override for Firestore
  PRICE_STREAM_ENABLED           true/false to enable websocket streaming
  PRICE_STREAM_PROVIDER          Stream provider id (e.g. finnhub)
  PRICE_STREAM_URL               WebSocket URL for streaming
  PRICE_STREAM_URLS              Comma-separated WebSocket URLs for failover
  PRICE_STREAM_PROVIDERS         Optional provider list aligned with URL list
  PRICE_STREAMS                  Generic stream names (comma-separated)
  PRICE_STREAM_MAX_SYMBOLS       Cap for symbol subscriptions
  PRICE_STREAM_MAX_SYMBOLS_FINNHUB    Provider cap override
  PRICE_STREAM_MAX_SYMBOLS_TWELVEDATA Provider cap override
  PRICE_STREAM_MAX_SYMBOLS_ALPACA     Provider cap override
  PRICE_STREAM_FILTER_ENABLED    true/false to filter stream symbols by watchlist
  PRICE_STREAM_FAILOVER_COOLDOWN_MS  Cooldown between stream provider failovers
  PRICE_STALE_MS                Price staleness threshold (ms)
  PRICE_POLL_STALE_MS           Poll staleness threshold (ms)
  PRICE_HEARTBEAT_STALE_MS      Heartbeat staleness threshold (ms)
  ALPACA_API_KEY                 Optional Alpaca API key for WS auth
  ALPACA_API_SECRET              Optional Alpaca API secret for WS auth
  REMOVE_ENV_VARS                Comma-separated env vars to remove at deploy
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
  if [ -n "${PRICE_STREAM_ENABLED:-}" ]; then
    envs="${envs}|PRICE_STREAM_ENABLED=${PRICE_STREAM_ENABLED}"
  fi
  if [ -n "${PRICE_STREAM_PROVIDER:-}" ]; then
    envs="${envs}|PRICE_STREAM_PROVIDER=${PRICE_STREAM_PROVIDER}"
  fi
  if [ -n "${PRICE_STREAM_URL:-}" ]; then
    envs="${envs}|PRICE_STREAM_URL=${PRICE_STREAM_URL}"
  fi
  if [ -n "${PRICE_STREAM_URLS:-}" ]; then
    envs="${envs}|PRICE_STREAM_URLS=${PRICE_STREAM_URLS}"
  fi
  if [ -n "${PRICE_STREAM_PROVIDERS:-}" ]; then
    envs="${envs}|PRICE_STREAM_PROVIDERS=${PRICE_STREAM_PROVIDERS}"
  fi
  if [ -n "${PRICE_STREAMS:-}" ]; then
    envs="${envs}|PRICE_STREAMS=${PRICE_STREAMS}"
  fi
  if [ -n "${PRICE_STREAM_MAX_SYMBOLS:-}" ]; then
    envs="${envs}|PRICE_STREAM_MAX_SYMBOLS=${PRICE_STREAM_MAX_SYMBOLS}"
  fi
  if [ -n "${PRICE_STREAM_MAX_SYMBOLS_FINNHUB:-}" ]; then
    envs="${envs}|PRICE_STREAM_MAX_SYMBOLS_FINNHUB=${PRICE_STREAM_MAX_SYMBOLS_FINNHUB}"
  fi
  if [ -n "${PRICE_STREAM_MAX_SYMBOLS_TWELVEDATA:-}" ]; then
    envs="${envs}|PRICE_STREAM_MAX_SYMBOLS_TWELVEDATA=${PRICE_STREAM_MAX_SYMBOLS_TWELVEDATA}"
  fi
  if [ -n "${PRICE_STREAM_MAX_SYMBOLS_ALPACA:-}" ]; then
    envs="${envs}|PRICE_STREAM_MAX_SYMBOLS_ALPACA=${PRICE_STREAM_MAX_SYMBOLS_ALPACA}"
  fi
  if [ -n "${PRICE_STREAM_FILTER_ENABLED:-}" ]; then
    envs="${envs}|PRICE_STREAM_FILTER_ENABLED=${PRICE_STREAM_FILTER_ENABLED}"
  fi
  if [ -n "${PRICE_STREAM_FAILOVER_COOLDOWN_MS:-}" ]; then
    envs="${envs}|PRICE_STREAM_FAILOVER_COOLDOWN_MS=${PRICE_STREAM_FAILOVER_COOLDOWN_MS}"
  fi
  if [ -n "${PRICE_STALE_MS:-}" ]; then
    envs="${envs}|PRICE_STALE_MS=${PRICE_STALE_MS}"
  fi
  if [ -n "${PRICE_POLL_STALE_MS:-}" ]; then
    envs="${envs}|PRICE_POLL_STALE_MS=${PRICE_POLL_STALE_MS}"
  fi
  if [ -n "${PRICE_HEARTBEAT_STALE_MS:-}" ]; then
    envs="${envs}|PRICE_HEARTBEAT_STALE_MS=${PRICE_HEARTBEAT_STALE_MS}"
  fi
  if [ -n "${FIREBASE_PROJECT_ID:-}" ]; then
    envs="${envs}|FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}"
  fi
  if [ -n "${ALPACA_API_KEY:-}" ]; then
    envs="${envs}|ALPACA_API_KEY=${ALPACA_API_KEY}"
  fi
  if [ -n "${ALPACA_API_SECRET:-}" ]; then
    envs="${envs}|ALPACA_API_SECRET=${ALPACA_API_SECRET}"
  fi
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
