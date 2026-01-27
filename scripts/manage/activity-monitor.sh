#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

FUNCTION_DIR="$ROOT_DIR/deploy/activity-monitor"

usage() {
  cat <<USAGE
Usage: $(basename "$0") <command>

Deploys two Firebase functions:
  - activityMonitor: Scheduled (every 1 min) to boost market-intel when users active
  - turnoverControlsTrigger: Firestore trigger on market/controls changes

Commands:
  deploy       Deploy all Firebase functions
  logs         Tail function logs (all or specify FUNCTION_NAME)
  emulate      Run firebase emulators for functions

Env:
  FUNCTION_NAME  Specific function for logs (default: all)
USAGE
}

command=${1:-}
case "$command" in
  deploy)
    require_cmd firebase
    project=$(require_project_id)
    if [ -n "${FUNCTION_NAME:-}" ]; then
      (cd "$FUNCTION_DIR" && firebase deploy --only "functions:${FUNCTION_NAME}" --project "$project")
    else
      (cd "$FUNCTION_DIR" && firebase deploy --only functions --project "$project")
    fi
    ;;
  logs)
    require_cmd firebase
    project=$(require_project_id)
    if [ -n "${FUNCTION_NAME:-}" ]; then
      (cd "$FUNCTION_DIR" && firebase functions:log --only "$FUNCTION_NAME" --project "$project")
    else
      (cd "$FUNCTION_DIR" && firebase functions:log --project "$project")
    fi
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
