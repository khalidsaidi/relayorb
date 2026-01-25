#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

JOB_NAME=${JOB_NAME:-relayorb-market-intel}
JOB_DIR="$ROOT_DIR/deploy/market-intel"
REGION=$(resolve_region)
GATEWAY_SERVICE_NAME=${GATEWAY_SERVICE_NAME:-relayorb-market-data-gateway}

usage() {
  cat <<USAGE
Usage: $(basename "$0") <command>

Commands:
  build        Build container image via Cloud Build
  deploy       Deploy Cloud Run job
  run          Execute Cloud Run job now
  logs         Tail recent logs
  local        Run locally (npm run start)
  image        Print resolved image name

Env:
  ALLOW_CREATE                   Create the job if it does not exist (default: false)
  JOB_TASKS                      Override tasks count for deploy (optional)
  JOB_MAX_RETRIES                Override max retries for deploy (optional)
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
  gcloud run services describe "$GATEWAY_SERVICE_NAME" --region "$REGION" \
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
  envs="MARKET_DATA_GATEWAY_URL=${url},MARKET_DATA_GATEWAY_AUTH=${auth}"
  audience="${MARKET_DATA_GATEWAY_AUDIENCE:-}"
  if [ -n "$audience" ]; then
    envs="${envs},MARKET_DATA_GATEWAY_AUDIENCE=${audience}"
  fi
  echo "$envs"
}

command=${1:-}
case "$command" in
  build)
    build_image "$JOB_DIR" "$(resolve_image "$JOB_NAME")"
    ;;
  deploy)
    deploy_run_job "$JOB_NAME" "$(resolve_image "$JOB_NAME")" "$REGION" "$(build_env_vars)"
    ;;
  run)
    execute_run_job "$JOB_NAME" "$REGION"
    ;;
  logs)
    job_logs "$JOB_NAME" "$REGION"
    ;;
  local)
    run_local_node "$JOB_DIR"
    ;;
  image)
    resolve_image "$JOB_NAME"
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
