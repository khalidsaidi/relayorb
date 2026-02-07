#!/usr/bin/env bash
set -euo pipefail

PORT="${VITE_DEV_PORT:-5173}"

WSL_IP="$(ip -4 addr show eth0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 | head -n 1 || true)"
# When the UI is opened from Windows, Vite's HMR websocket can fail if it ends up using IPv6 `localhost` (`::1`).
# Default to an explicit IPv4 host for HMR. Prefer the WSL IP (works from Windows without relying on localhost forwarding),
# but allow override with `VITE_HMR_HOST=<ip>`.
if [[ -z "${VITE_HMR_HOST:-}" ]]; then
  if [[ -n "$WSL_IP" ]]; then
    export VITE_HMR_HOST="$WSL_IP"
  else
    export VITE_HMR_HOST="127.0.0.1"
  fi
fi

if [[ -n "$WSL_IP" ]]; then
  echo "Dev server URLs:"
  echo "  Windows: http://127.0.0.1:${PORT}/"
  echo "  WSL IP : http://${WSL_IP}:${PORT}/"
else
  echo "Dev server URL: http://127.0.0.1:${PORT}/"
fi

exec vite --host 0.0.0.0 --port "$PORT" --strictPort --clearScreen false
