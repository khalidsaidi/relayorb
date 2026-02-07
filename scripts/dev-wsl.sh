#!/usr/bin/env bash
set -euo pipefail

PORT="${VITE_DEV_PORT:-5173}"

WSL_IP="$(ip -4 addr show eth0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 | head -n 1 || true)"
# When the UI is opened from Windows, Vite's HMR websocket can fail if it ends up using IPv6 `localhost` (`::1`).
# Default to an explicit IPv4 host for HMR.
#
# IMPORTANT: We default to the WSL IPv4 (when available). This avoids Windows->WSL port-forward edge cases where HTTP works
# but the HMR websocket fails (and Vite reports "failed to connect to websocket").
# You can override with `VITE_HMR_HOST=<ip>` if you need HMR reachable from another device on your LAN.
if [[ -z "${VITE_HMR_HOST:-}" ]]; then
  if [[ -n "$WSL_IP" ]]; then
    export VITE_HMR_HOST="$WSL_IP"
  else
    export VITE_HMR_HOST="127.0.0.1"
  fi
fi
export VITE_HMR_CLIENT_PORT="$PORT"

if [[ -n "$WSL_IP" ]]; then
  echo "Dev server URLs:"
  echo "  WSL     : http://127.0.0.1:${PORT}/"
  echo "  Windows : http://${WSL_IP}:${PORT}/"
  echo "           (WSL localhost-forwarding to Windows 127.0.0.1 may be disabled; WSL IP is the reliable option.)"
else
  echo "Dev server URL: http://127.0.0.1:${PORT}/"
fi
echo "HMR websocket: ws://${VITE_HMR_HOST}:${VITE_HMR_CLIENT_PORT}/"

exec vite --host 0.0.0.0 --port "$PORT" --strictPort --clearScreen false
