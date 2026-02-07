#!/usr/bin/env bash
set -euo pipefail

#
# NOTE (WSL on Windows):
# Some Windows setups reserve/exclude TCP port ranges that can prevent WSL "localhost forwarding" from working
# on certain ports. We've observed an excluded range covering 5171-5270, which includes Vite's default 5173.
# When that happens, Windows cannot reach `http://127.0.0.1:5173/` even though the server is running in WSL.
#
# Default to 5170 (outside that common excluded range) so Windows `localhost` works out-of-the-box.
# You can still override with `VITE_DEV_PORT=5173`, but Windows localhost forwarding may fail.
PORT="${VITE_DEV_PORT:-5170}"

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
  echo "  Windows : http://127.0.0.1:${PORT}/"
  echo "            (If this fails: Windows may have excluded this port; use the WSL IP below or pick another port.)"
  echo "  Windows : http://${WSL_IP}:${PORT}/"
else
  echo "Dev server URL: http://127.0.0.1:${PORT}/"
fi
echo "HMR websocket: ws://${VITE_HMR_HOST}:${VITE_HMR_CLIENT_PORT}/"

exec vite --host 0.0.0.0 --port "$PORT" --strictPort --clearScreen false
