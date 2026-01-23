#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

SERVICE_DIR="$ROOT_DIR/deploy/bot-host/backtrader"

usage() {
  cat <<USAGE
Usage: $(basename "$0") <command>

Note: This service runs on the bot-host VM via docker-compose (built locally).

Commands:
  vm-build     Rebuild backtrader image on the bot host VM
  vm-logs      Tail recent backtrader logs on the bot host VM
  vm-restart   Restart backtrader container on the bot host VM
  local        Run locally (python app.py)

Env:
  BOT_HOST_NAME         VM name (default: relayorb-bot-host)
  BOT_HOST_ZONE         VM zone (default: us-west1-b)
USAGE
}

bot_host_name=${BOT_HOST_NAME:-relayorb-bot-host}
bot_host_zone=${BOT_HOST_ZONE:-us-west1-b}
require_us_west1_zone "$bot_host_zone"

command=${1:-}
case "$command" in
  vm-build)
    require_cmd gcloud
    gcloud compute ssh "$bot_host_name" --zone "$bot_host_zone" \
      --command "cd /opt/relayorb/deploy/bot-host && sudo docker compose build backtrader"
    ;;
  vm-logs)
    require_cmd gcloud
    gcloud compute ssh "$bot_host_name" --zone "$bot_host_zone" \
      --command "sudo docker logs --tail 200 bot-host-backtrader-1"
    ;;
  vm-restart)
    require_cmd gcloud
    gcloud compute ssh "$bot_host_name" --zone "$bot_host_zone" \
      --command "cd /opt/relayorb/deploy/bot-host && sudo docker compose up -d --build backtrader"
    ;;
  local)
    (cd "$SERVICE_DIR" && python app.py)
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
