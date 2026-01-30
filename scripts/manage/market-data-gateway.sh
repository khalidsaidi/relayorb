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
  ALPACA_API_KEY         Optional Alpaca API key for intraday candles
  ALPACA_API_SECRET      Optional Alpaca API secret for intraday candles
  ALPACA_DATA_BASE_URL   Optional Alpaca data base URL
  POLYGON_API_KEY        Optional Polygon API key for intraday candles
  POLYGON_BASE_URL       Optional Polygon base URL
  TIINGO_API_KEY         Optional Tiingo API key for intraday candles
  TIINGO_BASE_URL        Optional Tiingo base URL
  INTRINIO_API_KEY       Optional Intrinio API key for intraday candles
  INTRINIO_BASE_URL      Optional Intrinio base URL
  MDG_PROVIDER_ROTATION  Optional provider rotation strategy (round_robin/off)
  MDG_PROVIDER_COOLDOWN_MS         Optional provider cooldown (ms)
  MDG_RATE_LIMIT_COOLDOWN_MS       Optional rate-limit cooldown (ms)
  MDG_CORS_ORIGINS                 Optional comma-separated browser origins
  MDG_RATE_LIMIT_ENABLED           true/false (default: true)
  MDG_RATE_LIMIT_WINDOW_MS         Rate limit window (ms)
  MDG_RATE_LIMIT_MAX               Max requests per window
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
    if [ -n "${ALPACA_API_KEY:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|ALPACA_API_KEY=${ALPACA_API_KEY}"
      else
        envs="ALPACA_API_KEY=${ALPACA_API_KEY}"
      fi
    fi
    if [ -n "${ALPACA_API_SECRET:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|ALPACA_API_SECRET=${ALPACA_API_SECRET}"
      else
        envs="ALPACA_API_SECRET=${ALPACA_API_SECRET}"
      fi
    fi
    if [ -n "${ALPACA_DATA_BASE_URL:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|ALPACA_DATA_BASE_URL=${ALPACA_DATA_BASE_URL}"
      else
        envs="ALPACA_DATA_BASE_URL=${ALPACA_DATA_BASE_URL}"
      fi
    fi
    if [ -n "${POLYGON_API_KEY:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|POLYGON_API_KEY=${POLYGON_API_KEY}"
      else
        envs="POLYGON_API_KEY=${POLYGON_API_KEY}"
      fi
    fi
    if [ -n "${POLYGON_BASE_URL:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|POLYGON_BASE_URL=${POLYGON_BASE_URL}"
      else
        envs="POLYGON_BASE_URL=${POLYGON_BASE_URL}"
      fi
    fi
    if [ -n "${TIINGO_API_KEY:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|TIINGO_API_KEY=${TIINGO_API_KEY}"
      else
        envs="TIINGO_API_KEY=${TIINGO_API_KEY}"
      fi
    fi
    if [ -n "${TIINGO_BASE_URL:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|TIINGO_BASE_URL=${TIINGO_BASE_URL}"
      else
        envs="TIINGO_BASE_URL=${TIINGO_BASE_URL}"
      fi
    fi
    if [ -n "${INTRINIO_API_KEY:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|INTRINIO_API_KEY=${INTRINIO_API_KEY}"
      else
        envs="INTRINIO_API_KEY=${INTRINIO_API_KEY}"
      fi
    fi
    if [ -n "${INTRINIO_BASE_URL:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|INTRINIO_BASE_URL=${INTRINIO_BASE_URL}"
      else
        envs="INTRINIO_BASE_URL=${INTRINIO_BASE_URL}"
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
    if [ -n "${MDG_PROVIDER_ROTATION:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|MDG_PROVIDER_ROTATION=${MDG_PROVIDER_ROTATION}"
      else
        envs="MDG_PROVIDER_ROTATION=${MDG_PROVIDER_ROTATION}"
      fi
    fi
    if [ -n "${MDG_PROVIDER_COOLDOWN_MS:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|MDG_PROVIDER_COOLDOWN_MS=${MDG_PROVIDER_COOLDOWN_MS}"
      else
        envs="MDG_PROVIDER_COOLDOWN_MS=${MDG_PROVIDER_COOLDOWN_MS}"
      fi
    fi
    if [ -n "${MDG_RATE_LIMIT_COOLDOWN_MS:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|MDG_RATE_LIMIT_COOLDOWN_MS=${MDG_RATE_LIMIT_COOLDOWN_MS}"
      else
        envs="MDG_RATE_LIMIT_COOLDOWN_MS=${MDG_RATE_LIMIT_COOLDOWN_MS}"
      fi
    fi
    if [ -n "${MDG_CORS_ORIGINS:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|MDG_CORS_ORIGINS=${MDG_CORS_ORIGINS}"
      else
        envs="MDG_CORS_ORIGINS=${MDG_CORS_ORIGINS}"
      fi
    fi
    if [ -n "${MDG_RATE_LIMIT_ENABLED:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|MDG_RATE_LIMIT_ENABLED=${MDG_RATE_LIMIT_ENABLED}"
      else
        envs="MDG_RATE_LIMIT_ENABLED=${MDG_RATE_LIMIT_ENABLED}"
      fi
    fi
    if [ -n "${MDG_RATE_LIMIT_WINDOW_MS:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|MDG_RATE_LIMIT_WINDOW_MS=${MDG_RATE_LIMIT_WINDOW_MS}"
      else
        envs="MDG_RATE_LIMIT_WINDOW_MS=${MDG_RATE_LIMIT_WINDOW_MS}"
      fi
    fi
    if [ -n "${MDG_RATE_LIMIT_MAX:-}" ]; then
      if [ -n "$envs" ]; then
        envs="${envs}|MDG_RATE_LIMIT_MAX=${MDG_RATE_LIMIT_MAX}"
      else
        envs="MDG_RATE_LIMIT_MAX=${MDG_RATE_LIMIT_MAX}"
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
