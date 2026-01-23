#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

JOB_NAME=${JOB_NAME:-relayorb-market-intel}
JOB_DIR="$ROOT_DIR/deploy/market-intel"
REGION=$(resolve_region)

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
  ALLOW_CREATE           Create the job if it does not exist (default: false)
  JOB_TASKS              Override tasks count for deploy (optional)
  JOB_MAX_RETRIES         Override max retries for deploy (optional)
USAGE
}

command=${1:-}
case "$command" in
  build)
    build_image "$JOB_DIR" "$(resolve_image "$JOB_NAME")"
    ;;
  deploy)
    deploy_run_job "$JOB_NAME" "$(resolve_image "$JOB_NAME")" "$REGION"
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
