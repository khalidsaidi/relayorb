#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

FUNCTION_NAME=${FUNCTION_NAME:-chartProxy}
FUNCTION_DIR="$ROOT_DIR/deploy/chart-proxy"

usage() {
  cat <<USAGE
Usage: $(basename "$0") <command>

Commands:
  deploy       Deploy Firebase function (HTTP)
  logs         Tail function logs
  emulate      Run firebase emulators for functions
USAGE
}

command=${1:-}
case "$command" in
  deploy)
    require_cmd firebase
    project=$(require_project_id)
    (cd "$FUNCTION_DIR" && firebase deploy --only functions:"$FUNCTION_NAME" --project "$project")
    ;;
  logs)
    require_cmd firebase
    project=$(require_project_id)
    (cd "$FUNCTION_DIR" && firebase functions:log --only "$FUNCTION_NAME" --project "$project")
    ;;
  emulate)
    require_cmd firebase
    project=$(require_project_id)
    (cd "$FUNCTION_DIR" && firebase emulators:start --only functions --project "$project")
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
