#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

SERVICE_NAME=${SERVICE_NAME:-relayorb-market-data-gateway}
SERVICE_DIR="$ROOT_DIR/deploy/market-data-gateway"
REGION=$(resolve_region)
ALLOW_UNAUTHENTICATED=${ALLOW_UNAUTHENTICATED:-false}

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
  ALLOW_CREATE           Create the service if it does not exist (default: false)
  ALLOW_UNAUTHENTICATED  Make service public (default: false)
  FINNHUB_API_KEY        Optional Finnhub key for fallback stock quotes
  FINNHUB_BASE_URL       Optional Finnhub base URL override
USAGE
}

command=${1:-}
case "$command" in
  build)
    build_image "$SERVICE_DIR" "$(resolve_image "$SERVICE_NAME")"
    ;;
  deploy)
    envs=""
    if [ -n "${FINNHUB_API_KEY:-}" ]; then
      envs="FINNHUB_API_KEY=${FINNHUB_API_KEY}"
    fi
    if [ -n "${STOCKDATA_API_KEY:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|STOCKDATA_API_KEY=${STOCKDATA_API_KEY}"
      else
        envs="STOCKDATA_API_KEY=${STOCKDATA_API_KEY}"
      fi
    fi
    if [ -n "${TWELVEDATA_API_KEY:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|TWELVEDATA_API_KEY=${TWELVEDATA_API_KEY}"
      else
        envs="TWELVEDATA_API_KEY=${TWELVEDATA_API_KEY}"
      fi
    fi
    if [ -n "${ALPHAVANTAGE_API_KEY:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|ALPHAVANTAGE_API_KEY=${ALPHAVANTAGE_API_KEY}"
      else
        envs="ALPHAVANTAGE_API_KEY=${ALPHAVANTAGE_API_KEY}"
      fi
    fi
    if [ -n "${FINNHUB_BASE_URL:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|FINNHUB_BASE_URL=${FINNHUB_BASE_URL}"
      else
        envs="FINNHUB_BASE_URL=${FINNHUB_BASE_URL}"
      fi
    fi
    if [ -n "${STOCKDATA_BASE_URL:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|STOCKDATA_BASE_URL=${STOCKDATA_BASE_URL}"
      else
        envs="STOCKDATA_BASE_URL=${STOCKDATA_BASE_URL}"
      fi
    fi
    if [ -n "${TWELVEDATA_BASE_URL:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|TWELVEDATA_BASE_URL=${TWELVEDATA_BASE_URL}"
      else
        envs="TWELVEDATA_BASE_URL=${TWELVEDATA_BASE_URL}"
      fi
    fi
    if [ -n "${ALPHAVANTAGE_BASE_URL:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|ALPHAVANTAGE_BASE_URL=${ALPHAVANTAGE_BASE_URL}"
      else
        envs="ALPHAVANTAGE_BASE_URL=${ALPHAVANTAGE_BASE_URL}"
      fi
    fi
    deploy_run_service "$SERVICE_NAME" "$(resolve_image "$SERVICE_NAME")" "$REGION" "$ALLOW_UNAUTHENTICATED" "$envs"
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
