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
# When the UI is opened from Windows, Vite's HMR websocket must use a hostname that Windows can route
# through WSL's localhost-forwarding. In practice on WSL2 this is `localhost`, not `127.0.0.1`.
#
# You can override with `VITE_HMR_HOST=<wsl-ip>` if you need HMR reachable from another device on your LAN.
if [[ -z "${VITE_HMR_HOST:-}" ]]; then
  export VITE_HMR_HOST="localhost"
fi
export VITE_HMR_CLIENT_PORT="$PORT"

if [[ -n "$WSL_IP" ]]; then
  echo "Dev server URLs:"
  echo "  Windows : http://localhost:${PORT}/"
  echo "            (Recommended for Firebase Google sign-in. Avoid 127.0.0.1/WSL IP unless you added them as authorized domains.)"
  echo "  Windows : http://127.0.0.1:${PORT}/"
  echo "            (NOTE: On many WSL2 setups this does NOT forward to WSL. Prefer localhost.)"
  echo "  Windows : http://${WSL_IP}:${PORT}/"
  echo "            (Network URL. Google sign-in will fail unless this IP is an authorized domain; prefer localhost.)"
else
  echo "Dev server URL: http://127.0.0.1:${PORT}/"
fi
echo "HMR websocket: ws://${VITE_HMR_HOST}:${VITE_HMR_CLIENT_PORT}/"

# Bind to IPv6 "any" so Windows browsers that resolve `localhost` to `::1` can still reach the dev server.
# With `net.ipv6.bindv6only=0` (default on Ubuntu/WSL), this also accepts IPv4.
exec vite --host :: --port "$PORT" --strictPort --clearScreen false
