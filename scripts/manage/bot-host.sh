#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

COMPOSE_FILE="$ROOT_DIR/deploy/bot-host/docker-compose.yml"
PROJECT_NAME=${COMPOSE_PROJECT_NAME:-relayorb}

usage() {
  cat <<USAGE
Usage: $(basename "$0") <command>

Commands:
  up          Start bot-host stack
  down        Stop bot-host stack
  restart     Restart bot-host stack
  logs        Tail bot-host logs
  pull        Pull latest images
  ps          Show container status
  config      Show resolved docker-compose config

Env (set before running commands):
  MARKET_DATA_GATEWAY_URL   Market data gateway base URL (required)
  MARKET_DATA_GATEWAY_AUTH  true/false (default: true)
  REDIS_URL                 Redis connection URL (default: redis://redis:6379)
  IBKR_ACCT1_USER           IBKR username for acct1 gateway
  IBKR_ACCT1_PASS           IBKR password for acct1 gateway
  IBKR_ACCT1_VNC_PASSWORD   Optional VNC password for acct1 gateway
  IBKR_ACCT2_USER           IBKR username for acct2 gateway
  IBKR_ACCT2_PASS           IBKR password for acct2 gateway
  IBKR_ACCT2_VNC_PASSWORD   Optional VNC password for acct2 gateway
USAGE
}

command=${1:-}
compose=$(compose_cmd)

case "$command" in
  up)
    $compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
    ;;
  down)
    $compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
    ;;
  restart)
    $compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" restart
    ;;
  logs)
    $compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f --tail "${LOG_LIMIT:-200}"
    ;;
  pull)
    $compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" pull
    ;;
  ps)
    $compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
    ;;
  config)
    $compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" config
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
