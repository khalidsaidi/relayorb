#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

SERVICE_NAME=${SERVICE_NAME:-relayorb-refresh}
SERVICE_DIR="$ROOT_DIR/deploy/refresh-service"
REGION=$(resolve_region)
ALLOW_UNAUTHENTICATED=${ALLOW_UNAUTHENTICATED:-true}
ORB_RUNNER_SERVICE_NAME=${ORB_RUNNER_SERVICE_NAME:-relayorb-orb-runner}

usage() {
  cat <<USAGE
Usage: $(basename "$0") <command>

Service:
  relayorb-refresh (UI proxy for /v1/* market data)

Commands:
  build        Build container image via Cloud Build
  deploy       Deploy Cloud Run service
  logs         Tail recent logs
  local        Run locally (npm run start)
  image        Print resolved image name

Env:
  ALLOW_CREATE           Create the service if it does not exist (default: false)
  ALLOW_UNAUTHENTICATED  Keep service public (default: true)
  ORB_RUNNER_URL         ORB runner base URL (auto-resolved if unset)
  ORB_RUNNER_AUTH        true/false (default: true)
  ORB_RUNNER_AUDIENCE    Optional audience override for ID token
  ORB_RUNNER_SERVICE_NAME  Cloud Run service name (default: relayorb-orb-runner)
USAGE
}

command=${1:-}
resolve_orb_runner_url() {
  if [ -n "${ORB_RUNNER_URL:-}" ]; then
    echo "$ORB_RUNNER_URL"
    return
  fi
  require_cmd gcloud
  gcloud run services describe "$ORB_RUNNER_SERVICE_NAME" --region "$REGION" \
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

build_env_vars() {
  local url auth envs audience
  url=$(require_orb_runner_url)
  auth=$(resolve_orb_runner_auth)
  envs="ORB_RUNNER_URL=${url},ORB_RUNNER_AUTH=${auth}"
  audience="${ORB_RUNNER_AUDIENCE:-}"
  if [ -n "$audience" ]; then
    envs="${envs},ORB_RUNNER_AUDIENCE=${audience}"
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
