#!/usr/bin/env bash
set -euo pipefail

# Manage the RelayOrb frontend dev server in a tmux session so it survives terminal/IDE restarts.
#
# Usage:
#   bash scripts/ui-dev.sh start [port]
#   bash scripts/ui-dev.sh stop
#   bash scripts/ui-dev.sh restart [port]
#   bash scripts/ui-dev.sh status
#   bash scripts/ui-dev.sh logs
#
# Notes (WSL):
# - The underlying dev command is `npm run dev`, which runs `scripts/dev-wsl.sh`.
# - Default port is set by `scripts/dev-wsl.sh` (defaults to 5300; override via `VITE_DEV_PORT`).

SESSION="relayorb_dev"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cmd="${1:-status}"
port="${2:-}"

has_session() {
  tmux has-session -t "$SESSION" 2>/dev/null
}

case "$cmd" in
  start)
    if has_session; then
      echo "Dev server already running (tmux session: $SESSION)."
      exit 0
    fi
    if [[ -n "$port" ]]; then
      tmux new -d -s "$SESSION" "cd '$ROOT_DIR' && VITE_DEV_PORT='$port' npm run dev"
      echo "Dev server started (tmux session: $SESSION, port: $port)."
    else
      tmux new -d -s "$SESSION" "cd '$ROOT_DIR' && npm run dev"
      echo "Dev server started (tmux session: $SESSION)."
    fi
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
    "$0" start "${port:-}"
    ;;

  status)
    if has_session; then
      echo "Dev server running (tmux session: $SESSION)."
      # Best-effort port detection (prints common ports).
      for p in 5300 5173 5170; do
        (lsof -nP -iTCP:${p} -sTCP:LISTEN 2>/dev/null || true) | sed -n '1,3p'
      done
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
    echo "Usage: bash scripts/ui-dev.sh {start|stop|restart|status|logs} [port]"
    exit 2
    ;;
esac
