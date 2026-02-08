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
# IMPORTANT: We default to `127.0.0.1` so both HTTP and HMR use Windows->WSL localhost forwarding (when enabled).
# You can override with `VITE_HMR_HOST=<wsl-ip>` if you need HMR reachable from another device on your LAN.
if [[ -z "${VITE_HMR_HOST:-}" ]]; then
  export VITE_HMR_HOST="127.0.0.1"
fi
export VITE_HMR_CLIENT_PORT="$PORT"

if [[ -n "$WSL_IP" ]]; then
  echo "Dev server URLs:"
  echo "  Windows : http://localhost:${PORT}/"
  echo "            (Recommended for Firebase Google sign-in. Avoid 127.0.0.1/WSL IP unless you added them as authorized domains.)"
  echo "  Windows : http://127.0.0.1:${PORT}/"
  echo "            (Fallback if your browser resolves localhost to IPv6 ::1. Note: Google sign-in may fail with auth/unauthorized-domain unless 127.0.0.1 is in Firebase Auth > Authorized domains.)"
  echo "  Windows : http://${WSL_IP}:${PORT}/"
  echo "            (Network URL. Google sign-in will fail unless this IP is an authorized domain; prefer localhost.)"
else
  echo "Dev server URL: http://127.0.0.1:${PORT}/"
fi
echo "HMR websocket: ws://${VITE_HMR_HOST}:${VITE_HMR_CLIENT_PORT}/"

exec vite --host 0.0.0.0 --port "$PORT" --strictPort --clearScreen false
