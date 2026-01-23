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
