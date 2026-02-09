#!/usr/bin/env bash
set -euo pipefail

#
# NOTE (WSL on Windows):
# We want the dev server reachable from Windows while preserving Firebase Google sign-in.
# Google sign-in requires using an authorized domain, which typically includes `localhost` but NOT your WSL IP.
#
# Windows/WSL note:
# Some Windows installs reserve/exclude a TCP port range that includes Vite's default 5173, which breaks
# Windows -> WSL localhost forwarding even though the server is running in WSL.
#
# Default to a "boring" port that is typically safe. Override with `VITE_DEV_PORT=...` if you prefer 5173.
PORT="${VITE_DEV_PORT:-5300}"

WSL_IP="$(ip -4 addr show eth0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 | head -n 1 || true)"
# When the UI is opened from Windows, Vite's HMR websocket should target an IPv4 loopback hostname to avoid
# environments where `localhost` resolves to IPv6 first (which can cause WS HMR to fail while HTTP still loads).
#
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
