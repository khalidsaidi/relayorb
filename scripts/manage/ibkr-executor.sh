#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

SERVICE_DIR="$ROOT_DIR/deploy/ibkr-executor"
REGION=$(resolve_region)
ALLOW_UNAUTHENTICATED=${ALLOW_UNAUTHENTICATED:-false}

usage() {
  cat <<USAGE
Usage: $(basename "$0") <command> [acct1|acct2|acct3]

Commands:
  build        Build container image via Cloud Build
  vm-logs      Tail recent executor logs on the bot host VM
  vm-restart   Restart executor containers on the bot host VM
  local        Run locally (npm run start) with BROKER_ACCOUNT_KEY
  image        Print resolved image name

Env:
  ACCOUNT               Default account if not passed (acct1/acct2/acct3)
  BROKER_ACCOUNT_KEY    For local runs
  BOT_HOST_NAME         VM name (default: relayorb-bot-host)
  BOT_HOST_ZONE         VM zone (default: us-west1-b)
USAGE
}

command=${1:-}
account=${ACCOUNT:-${2:-}}

resolve_service_name() {
  local acct="$1"
  if [ -z "$acct" ]; then
    echo ""; return
  fi
  echo "ibkr-executor-${acct}"
}

bot_host_name=${BOT_HOST_NAME:-relayorb-bot-host}
bot_host_zone=${BOT_HOST_ZONE:-us-west1-b}
require_us_west1_zone "$bot_host_zone"

case "$command" in
  build)
    build_image "$SERVICE_DIR" "$(resolve_image "relayorb-ibkr-executor")"
    ;;
  vm-logs)
    if [ -z "$account" ]; then
      echo "Account required (acct1/acct2/acct3)." >&2
      usage
      exit 1
    fi
    require_cmd gcloud
    gcloud compute ssh "$bot_host_name" --zone "$bot_host_zone" \
      --command "sudo docker logs --tail 200 bot-host-ibkr-executor-${account}-1"
    ;;
  vm-restart)
    require_cmd gcloud
    gcloud compute ssh "$bot_host_name" --zone "$bot_host_zone" \
      --command "cd /opt/relayorb/deploy/bot-host && sudo docker compose up -d ibkr-executor-acct1 ibkr-executor-acct2 ibkr-executor-acct3"
    ;;
  local)
    if [ -z "${BROKER_ACCOUNT_KEY:-}" ]; then
      echo "Set BROKER_ACCOUNT_KEY for local runs." >&2
      exit 1
    fi
    run_local_node "$SERVICE_DIR"
    ;;
  image)
    resolve_image "relayorb-ibkr-executor"
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
