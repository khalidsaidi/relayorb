#!/usr/bin/env bash
set -euo pipefail

#
# NOTE (WSL on Windows):
# We want the dev server reachable from Windows while preserving Firebase Google sign-in.
# Google sign-in requires using an authorized domain, which typically includes `localhost` but NOT your WSL IP.
#
# Default to Vite's conventional port (5173). Override with `VITE_DEV_PORT=...` if it conflicts.
PORT="${VITE_DEV_PORT:-5173}"

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
  echo "            (Should work now that Vite binds IPv4. Prefer localhost for Firebase sign-in.)"
  echo "  Windows : http://${WSL_IP}:${PORT}/"
  echo "            (Network URL. Google sign-in will fail unless this IP is an authorized domain; prefer localhost.)"
else
  echo "Dev server URL: http://127.0.0.1:${PORT}/"
fi
echo "HMR websocket: ws://${VITE_HMR_HOST}:${VITE_HMR_CLIENT_PORT}/"

# Bind to IPv4 "any" for maximum compatibility with Windows<->WSL localhost forwarding.
# In practice, Windows browsers often try IPv6 first for `localhost`; if that fails they fall back
# to IPv4. Binding to `0.0.0.0` ensures the IPv4 fallback works.
exec vite --host 0.0.0.0 --port "$PORT" --strictPort --clearScreen false
