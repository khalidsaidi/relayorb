#!/usr/bin/env bash
set -euo pipefail

# Manage the RelayOrb frontend dev server in a tmux session so it survives terminal/IDE restarts.
#
# Usage:
#   bash scripts/ui-dev.sh start
#   bash scripts/ui-dev.sh stop
#   bash scripts/ui-dev.sh restart
#   bash scripts/ui-dev.sh status
#   bash scripts/ui-dev.sh logs
#
# Notes (WSL):
# - The underlying dev command is `npm run dev`, which runs `scripts/dev-wsl.sh`.
# - Default port is set by `scripts/dev-wsl.sh` to 5170 to avoid common Windows excluded port ranges (5171-5270).

SESSION="relayorb_dev"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cmd="${1:-status}"

has_session() {
  tmux has-session -t "$SESSION" 2>/dev/null
}

case "$cmd" in
  start)
    if has_session; then
      echo "Dev server already running (tmux session: $SESSION)."
      exit 0
    fi
    tmux new -d -s "$SESSION" "cd '$ROOT_DIR' && npm run dev"
    echo "Dev server started (tmux session: $SESSION)."
    ;;

  stop)
    if has_session; then
      tmux kill-session -t "$SESSION"
      echo "Dev server stopped (tmux session: $SESSION)."
    else
      echo "Dev server not running (tmux session: $SESSION not found)."
    fi
    ;;

  restart)
    "$0" stop
    "$0" start
    ;;

  status)
    if has_session; then
      echo "Dev server running (tmux session: $SESSION)."
      # Best-effort port detection (prints any LISTEN on 5170/5173).
      (lsof -nP -iTCP:5170 -sTCP:LISTEN 2>/dev/null || true) | sed -n '1,3p'
      (lsof -nP -iTCP:5173 -sTCP:LISTEN 2>/dev/null || true) | sed -n '1,3p'
      echo
      tmux capture-pane -pt "$SESSION" | tail -n 20
    else
      echo "Dev server not running (tmux session: $SESSION not found)."
      exit 1
    fi
    ;;

  logs)
    if has_session; then
      tmux capture-pane -pt "$SESSION"
    else
      echo "Dev server not running (tmux session: $SESSION not found)."
      exit 1
    fi
    ;;

  *)
    echo "Unknown command: $cmd"
    echo "Usage: bash scripts/ui-dev.sh {start|stop|restart|status|logs}"
    exit 2
    ;;
esac

